import { NextResponse } from "next/server";
import { generateJson, assertApiKey, friendlyError } from "@/lib/claude";
import { NearbySchema, type NearbyPick } from "@/lib/schema";
import { fetchFoodPhotos } from "@/lib/foodPhoto";
import {
  CUISINE_NOTE,
  cuisineKeyword,
  isPicked,
  matchesCuisine,
  type Cuisine,
} from "@/lib/cuisine";

export const maxDuration = 60;

interface KakaoDoc {
  place_name: string;
  category_name: string;
  road_address_name: string;
  address_name: string;
  distance: string;
  place_url: string;
  x: string;
  y: string;
}

const SYSTEM = `당신은 한국 음식에 밝은 영양 코치입니다.
실제로 존재하는 근처 식당 목록을 받아, 오늘 남은 예산에 맞는 곳을 골라 추천합니다.

규칙:
- placeName, categoryName, distanceM, placeUrl은 **받은 목록의 값을 그대로** 옮기세요. 지어내지 마세요.
- menu는 그 식당의 상호명과 카테고리로 미루어 "있을 법한 대표 메뉴"입니다. 실제 메뉴판이 아니라는 전제로 무난한 메뉴를 고르세요.
- 각 메뉴마다 **먹어도 되는 부분(eatPart)**과 **남겨야 하는 부분(avoidPart)**을 반드시 구분하세요.
  예: 국밥 -> "건더기와 고기" / "국물", 돈까스 -> "안쪽 고기" / "튀김옷과 소스",
      쌀국수 -> "면과 고기" / "국물", 김밥 -> "야채말이" / "단무지와 햄"
- fitScore는 오늘 남은 예산에 얼마나 잘 맞는지 1~5 사이의 숫자로 매기세요. 예산을 크게 넘기면 낮게 주세요.
- 최근에 먹은 음식이 주어지면 비슷한 것은 피하고, 그 며칠 동안 모자랐던 쪽(단백질, 채소)을 채우는 곳을 올려주세요.
- 목록에서 5~7곳만 골라 담으세요.
- 한국어 존댓말로 답하세요.`;

interface Body {
  lat?: number;
  lng?: number;
  keyword?: string;
  cuisine?: Cuisine;
  remaining?: { kcalLeft: number; proteinLeft: number } | null;
  /** 최근 며칠 먹은 음식 이름. 같은 것을 또 권하지 않게 하는 데 쓴다 */
  recentDishes?: string[];
}

async function searchKakao(url: string): Promise<KakaoDoc[] | { error: string; status: number }> {
  const res = await fetch(url, {
    headers: { Authorization: `KakaoAK ${process.env.KAKAO_REST_KEY}` },
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("[kakao]", res.status, text);
    return {
      error: `카카오 검색 실패 (${res.status}). REST API 키를 확인해주세요.`,
      status: 502,
    };
  }

  const json = (await res.json()) as { documents: KakaoDoc[] };
  return json.documents ?? [];
}

export async function POST(req: Request) {
  try {
    assertApiKey();
    if (!process.env.KAKAO_REST_KEY) {
      return NextResponse.json(
        { error: "KAKAO_REST_KEY가 설정되지 않았습니다. .env.local 또는 Vercel 환경변수를 확인하세요." },
        { status: 500 },
      );
    }

    const body = (await req.json()) as Body;
    const { lat, lng, keyword, remaining, recentDishes } = body;
    const cuisine: Cuisine = body.cuisine ?? "전체";
    const hasCoords = typeof lat === "number" && typeof lng === "number";

    if (!hasCoords && !(keyword && keyword.trim())) {
      return NextResponse.json({ error: "위치 또는 동네 이름이 필요합니다." }, { status: 400 });
    }

    /**
     * 갈래를 고르면 업종 코드가 아니라 그 말로 검색한다.
     * 좌표 검색(category.json)은 "음식점" 단위까지만 좁혀지기 때문이다.
     */
    function buildUrl(want: Cuisine): string {
      if (isPicked(want) && hasCoords) {
        return (
          `https://dapi.kakao.com/v2/local/search/keyword.json` +
          `?query=${encodeURIComponent(cuisineKeyword(want))}` +
          `&category_group_code=FD6&x=${lng}&y=${lat}&radius=1500&sort=distance&size=15`
        );
      }
      if (hasCoords) {
        return (
          `https://dapi.kakao.com/v2/local/search/category.json` +
          `?category_group_code=FD6&x=${lng}&y=${lat}&radius=1000&sort=distance&size=15`
        );
      }
      const q = isPicked(want)
        ? `${keyword!.trim()} ${cuisineKeyword(want)}`
        : `${keyword!.trim()} 맛집`;
      return (
        `https://dapi.kakao.com/v2/local/search/keyword.json` +
        `?query=${encodeURIComponent(q)}&category_group_code=FD6&size=15`
      );
    }

    let found = await searchKakao(buildUrl(cuisine));
    if (!Array.isArray(found)) {
      return NextResponse.json({ error: found.error }, { status: found.status });
    }

    // 그 갈래가 근처에 아예 없을 수 있다. 빈손으로 돌려보내는 대신 갈래를 풀고 다시 찾는다
    let fellBack = false;
    if (found.length === 0 && isPicked(cuisine)) {
      const retry = await searchKakao(buildUrl("전체"));
      if (!Array.isArray(retry)) {
        return NextResponse.json({ error: retry.error }, { status: retry.status });
      }
      found = retry;
      fellBack = true;
    }

    const all = found.map((d) => ({
      placeName: d.place_name,
      categoryName: d.category_name,
      distanceM: Number(d.distance) || 0,
      placeUrl: d.place_url,
      address: d.road_address_name || d.address_name,
    }));

    // 검색어로 좁혀도 엉뚱한 업종이 섞여 온다. 카테고리로 한 번 더 거른다
    let places = all;
    let note: string | null = null;

    if (isPicked(cuisine)) {
      const matched = all.filter((p) => matchesCuisine(p.categoryName, cuisine));
      if (!fellBack && matched.length >= 3) {
        places = matched;
      } else if (!fellBack && matched.length > 0) {
        places = all;
        note = `근처에 ${cuisine} 식당이 ${matched.length}곳뿐이라 다른 업종도 함께 살펴봤습니다.`;
      } else {
        places = all;
        note =
          all.length > 0
            ? `근처에서 ${cuisine} 식당을 찾지 못해 다른 업종에서 골랐습니다.`
            : "근처에서 식당을 찾지 못했습니다.";
      }
    }

    if (places.length === 0) {
      return NextResponse.json({ picks: [], note });
    }

    const budgetText = remaining
      ? `오늘 남은 예산: ${remaining.kcalLeft}kcal, 단백질 ${remaining.proteinLeft}g`
      : "목표가 아직 설정되지 않았습니다. 일반적인 건강 기준으로 골라주세요.";

    const wants = isPicked(cuisine)
      ? `오늘 먹고 싶은 갈래: ${cuisine}. ${CUISINE_NOTE[cuisine]}${
          note ? ` (${note} 목록에 다른 업종이 섞여 있으면 가장 가까운 쪽을 골라주세요.)` : ""
        }`
      : "";

    const recent =
      recentDishes && recentDishes.length > 0
        ? `최근 며칠 먹은 것: ${recentDishes.slice(0, 12).join(", ")}`
        : "";

    const result = await generateJson({
      system: SYSTEM,
      schema: NearbySchema,
      prompt: [
        budgetText,
        wants,
        recent,
        "",
        "아래는 실제 근처 식당 목록입니다. 이 중에서 골라주세요.",
        "",
        JSON.stringify(places, null, 2),
      ]
        .filter((line) => line !== "")
        .join("\n"),
    });

    // 모델이 고른 메뉴 이름으로 음식 사진을 붙인다.
    // 사진은 곁들이는 정보라, 검색이 막혀도 추천은 그대로 내보낸다.
    const photos = await fetchFoodPhotos(result.picks.map((p) => p.menu));
    const picks: NearbyPick[] = result.picks.map((p) => {
      const photo = photos.get(p.menu.trim());
      return photo ? { ...p, photo } : p;
    });

    return NextResponse.json({ picks, note });
  } catch (e) {
    console.error("[/api/nearby]", e);
    return NextResponse.json({ error: friendlyError(e) }, { status: 500 });
  }
}
