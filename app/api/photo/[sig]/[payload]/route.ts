import { NextResponse } from "next/server";
import { verifyPhoto } from "@/lib/foodPhoto";

/**
 * 음식 사진 중계. lib/foodPhoto.ts가 서명해 준 주소만 받아온다.
 *
 * 검색이 준 원본 주소를 <img>에 그대로 걸면 두 가지로 깨진다.
 * - http 주소가 섞여 있어 https 배포에서 브라우저가 막는다
 * - 블로그 이미지 서버 상당수가 외부에서 온 요청을 거부한다
 * 여기서 referer 없이 받아다 넘기면 둘 다 지나간다. 실패하면 카카오 썸네일로 한 번 더 시도한다.
 *
 * 서명이 없으면 누구나 이 서버로 아무 주소나 받아올 수 있다(공개 프록시). 그래서 먼저 검사한다.
 */

const MAX_BYTES = 8 * 1024 * 1024;

async function load(url: string): Promise<Response | null> {
  try {
    const res = await fetch(url, {
      headers: {
        // 검색 봇이 아닌 일반 접속으로 보이게. referer는 일부러 보내지 않는다
        "User-Agent": "Mozilla/5.0 (compatible; momchin/1.0)",
        Accept: "image/*",
      },
      signal: AbortSignal.timeout(6000),
      cache: "no-store",
    });
    if (!res.ok || !res.body) return null;

    const type = res.headers.get("content-type") ?? "";
    if (!type.startsWith("image/")) return null;

    if (Number(res.headers.get("content-length") ?? 0) > MAX_BYTES) return null;

    return res;
  } catch {
    return null;
  }
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ sig: string; payload: string }> },
) {
  const { sig, payload } = await params;

  const urls = verifyPhoto(payload, sig);
  if (!urls) {
    return NextResponse.json({ error: "서명이 맞지 않는 주소입니다." }, { status: 403 });
  }

  const [primary, fallback] = urls;
  const res = (await load(primary)) ?? (primary === fallback ? null : await load(fallback));
  // 사진 한 장 때문에 추천이 흔들리지는 않는다. 화면은 사진 자리만 비운다
  if (!res) return new NextResponse(null, { status: 404 });

  return new NextResponse(res.body, {
    headers: {
      "Content-Type": res.headers.get("content-type") ?? "image/jpeg",
      // 같은 사진을 다시 받아오지 않게 하루 캐시
      "Cache-Control": "public, max-age=86400, s-maxage=86400",
    },
  });
}
