import { createHmac, timingSafeEqual } from "node:crypto";
import type { FoodPhoto } from "./schema";

/**
 * 메뉴 이름으로 음식 사진 한 장을 찾아온다. 서버(app/api/*)에서만 쓴다.
 *
 * 카카오 이미지 검색은 근처 식당에 이미 쓰는 KAKAO_REST_KEY를 그대로 받는다.
 * 새 키를 받을 필요가 없다.
 */

interface KakaoImageDoc {
  collection: string;
  display_sitename: string;
  doc_url: string;
  image_url: string;
  thumbnail_url: string;
  width: number;
  height: number;
}

/** 검색 결과는 잘 바뀌지 않는다. 같은 메뉴를 다시 검색해 쿼터를 태우지 않게 잠깐 들고 있는다 */
const TTL_MS = 6 * 60 * 60 * 1000;
const cache = new Map<string, { at: number; photo: FoodPhoto | null }>();

/**
 * 사진마다 점수를 매겨 제일 그럴듯한 한 장을 고른다.
 * 검색 상위 결과에는 기사 캡처나 세로로 긴 블로그 이미지가 섞여 들어온다.
 */
function score(d: KakaoImageDoc): number {
  if (d.width < 200 || d.height < 200) return -1;

  const ratio = d.width / d.height;
  if (ratio < 0.6 || ratio > 2.4) return -1;

  let s = 0;
  // 카드가 가로형이라 가로 사진이 덜 잘린다
  s += ratio >= 1.1 && ratio <= 1.9 ? 30 : 10;
  // 블로그·카페 사진이 실제로 차려진 음식일 확률이 높다. etc는 기사 이미지가 많다
  s += d.collection === "blog" || d.collection === "cafe" ? 25 : 0;
  // 큰 사진일수록 확대했을 때 덜 뭉갠다. 다만 크기만으로 뒤집히지 않게 상한을 둔다
  s += Math.min(25, Math.round(Math.min(d.width, d.height) / 40));
  // 수천 픽셀짜리 원본은 받아오는 데만 오래 걸린다. 비슷하면 적당한 크기를 고른다
  if (Math.max(d.width, d.height) > 2000) s -= 15;
  return s;
}

/** 메뉴 이름 하나에 대한 사진. 못 찾거나 검색이 막히면 null (화면은 사진 없이 그려진다) */
async function searchOne(menu: string): Promise<FoodPhoto | null> {
  const query = menu.trim();
  if (!query || !process.env.KAKAO_REST_KEY) return null;

  const url =
    `https://dapi.kakao.com/v2/search/image` +
    `?query=${encodeURIComponent(query)}&size=20&sort=accuracy`;

  const res = await fetch(url, {
    headers: { Authorization: `KakaoAK ${process.env.KAKAO_REST_KEY}` },
    signal: AbortSignal.timeout(4000),
    cache: "no-store",
  });
  if (!res.ok) {
    console.error("[kakao image]", res.status, await res.text());
    return null;
  }

  const { documents = [] } = (await res.json()) as { documents?: KakaoImageDoc[] };
  const best = documents
    .map((d) => ({ d, s: score(d) }))
    .filter((x) => x.s >= 0)
    .sort((a, b) => b.s - a.s)[0]?.d;
  if (!best) return null;

  return {
    src: signPhoto(best.image_url, best.thumbnail_url),
    sourceUrl: best.doc_url,
    sourceName: best.display_sitename || "웹 검색",
  };
}

/**
 * 여러 메뉴의 사진을 한 번에. 같은 메뉴는 한 번만 검색한다.
 * 사진은 곁들이는 정보라, 실패해도 식당 추천 자체는 그대로 나가야 한다.
 */
export async function fetchFoodPhotos(menus: string[]): Promise<Map<string, FoodPhoto>> {
  const out = new Map<string, FoodPhoto>();
  const unique = [...new Set(menus.map((m) => m.trim()).filter(Boolean))];

  await Promise.all(
    unique.map(async (menu) => {
      const hit = cache.get(menu);
      if (hit && Date.now() - hit.at < TTL_MS) {
        if (hit.photo) out.set(menu, hit.photo);
        return;
      }
      try {
        const photo = await searchOne(menu);
        cache.set(menu, { at: Date.now(), photo });
        if (photo) out.set(menu, photo);
      } catch (e) {
        console.error("[foodPhoto]", menu, e);
      }
    }),
  );

  return out;
}

/* ---------- 프록시 주소 서명 ---------- */

/**
 * 검색이 돌려주는 원본 주소는 그대로 <img>에 걸 수 없다.
 * http 주소가 섞여 있어 https 배포에서 막히고, 블로그 이미지 서버는 외부 링크를 거부한다.
 * 그래서 /api/photo가 대신 받아다 흘려준다.
 *
 * 다만 그 라우트가 아무 주소나 받아주면 공개 프록시가 된다.
 * 카카오 검색이 준 주소라는 표시로 서명을 붙이고, 프록시는 서명이 맞을 때만 받아온다.
 */
function key(): string {
  return process.env.KAKAO_REST_KEY ?? "";
}

function sign(payload: string): string {
  return createHmac("sha256", key()).update(payload).digest("base64url");
}

function signPhoto(primary: string, fallback: string): string {
  const payload = Buffer.from(JSON.stringify([primary, fallback])).toString("base64url");
  // 쿼리 문자열이 아니라 경로로 넘긴다. next/image 최적화가 쿼리 붙은 로컬 경로를 받지 않는다
  return `/api/photo/${sign(payload)}/${payload}`;
}

/** 서명이 맞으면 [원본, 대체] 주소, 아니면 null */
export function verifyPhoto(payload: string, sig: string): [string, string] | null {
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;

  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!Array.isArray(parsed) || typeof parsed[0] !== "string") return null;
    return [parsed[0], typeof parsed[1] === "string" ? parsed[1] : parsed[0]];
  } catch {
    return null;
  }
}
