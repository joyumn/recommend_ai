import { NextResponse } from "next/server";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { anthropic, MODEL, assertApiKey } from "@/lib/anthropic";
import { NearbySchema } from "@/lib/schema";

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
- fitScore는 오늘 남은 예산에 얼마나 잘 맞는지 1~5로 매기세요. 예산을 크게 넘기면 낮게 주세요.
- 목록에서 5~7곳만 골라 fitScore가 높은 순으로 담으세요.
- 한국어 존댓말로 답하세요.`;

export async function POST(req: Request) {
  try {
    assertApiKey();
    if (!process.env.KAKAO_REST_KEY) {
      return NextResponse.json(
        { error: "KAKAO_REST_KEY가 설정되지 않았습니다. .env.local 또는 Vercel 환경변수를 확인하세요." },
        { status: 500 },
      );
    }

    const body = (await req.json()) as {
      lat?: number;
      lng?: number;
      keyword?: string;
      remaining?: { kcalLeft: number; proteinLeft: number } | null;
    };
    const { lat, lng, keyword, remaining } = body;

    // 위치가 있으면 카테고리 검색, 없으면 동네 이름으로 키워드 검색
    let url: string;
    if (typeof lat === "number" && typeof lng === "number") {
      url =
        `https://dapi.kakao.com/v2/local/search/category.json` +
        `?category_group_code=FD6&x=${lng}&y=${lat}&radius=1000&sort=distance&size=15`;
    } else if (keyword && keyword.trim()) {
      url =
        `https://dapi.kakao.com/v2/local/search/keyword.json` +
        `?query=${encodeURIComponent(keyword.trim() + " 맛집")}&category_group_code=FD6&size=15`;
    } else {
      return NextResponse.json({ error: "위치 또는 동네 이름이 필요합니다." }, { status: 400 });
    }

    const kakaoRes = await fetch(url, {
      headers: { Authorization: `KakaoAK ${process.env.KAKAO_REST_KEY}` },
      cache: "no-store",
    });

    if (!kakaoRes.ok) {
      const text = await kakaoRes.text();
      console.error("[kakao]", kakaoRes.status, text);
      return NextResponse.json(
        { error: `카카오 검색 실패 (${kakaoRes.status}). REST API 키를 확인해주세요.` },
        { status: 502 },
      );
    }

    const kakao = (await kakaoRes.json()) as { documents: KakaoDoc[] };
    const places = kakao.documents.map((d) => ({
      placeName: d.place_name,
      categoryName: d.category_name,
      distanceM: Number(d.distance) || 0,
      placeUrl: d.place_url,
      address: d.road_address_name || d.address_name,
    }));

    if (places.length === 0) {
      return NextResponse.json({ picks: [], note: "근처에서 식당을 찾지 못했습니다." });
    }

    const budgetText = remaining
      ? `오늘 남은 예산: ${remaining.kcalLeft}kcal, 단백질 ${remaining.proteinLeft}g`
      : "목표가 아직 설정되지 않았습니다. 일반적인 건강 기준으로 골라주세요.";

    const res = await anthropic.messages.parse({
      model: MODEL,
      max_tokens: 8000,
      system: SYSTEM,
      output_config: { effort: "low", format: zodOutputFormat(NearbySchema) },
      messages: [
        {
          role: "user",
          content: `${budgetText}

아래는 실제 근처 식당 목록입니다. 이 중에서 골라주세요.

${JSON.stringify(places, null, 2)}`,
        },
      ],
    });

    if (!res.parsed_output) {
      return NextResponse.json({ error: "추천을 만들지 못했습니다. 다시 시도해주세요." }, { status: 502 });
    }
    return NextResponse.json(res.parsed_output);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "알 수 없는 오류";
    console.error("[/api/nearby]", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
