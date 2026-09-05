import { NextResponse } from "next/server";
import type Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { anthropic, MODEL, assertApiKey } from "@/lib/anthropic";
import { MealSchema } from "@/lib/schema";

export const maxDuration = 60;

/**
 * 이 시스템 프롬프트가 이 앱의 핵심이다.
 * 부위 분리를 명시적으로 시키지 않으면 모델은 분량만 답하고 부위는 건너뛴다.
 */
const SYSTEM = `당신은 한국 음식에 밝은 영양 코치입니다. 사진 속 음식을 보고 조언합니다.

가장 중요한 규칙: 각 음식마다 **먹어도 되는 부위**와 **남겨야 하는 부위**를 반드시 구분해서 지목하세요.
분량만 말하는 것은 부족합니다. 어느 부분을 먹고 어느 부분을 남길지가 핵심입니다.

부위 분리 예시:
- 치킨 -> eatPart "튀김옷과 껍질을 벗겨낸 안쪽 살코기" / avoidPart "튀김옷, 껍질" / howTo "손으로 껍질을 잡아 벗긴 뒤 살만 발라내세요"
- 삼겹살 -> eatPart "붉은 살코기 부분" / avoidPart "가장자리 흰 지방층" / howTo "가위로 흰 지방 띠를 잘라내고 드세요"
- 김밥 -> eatPart "밥, 계란, 시금치, 당근, 우엉" / avoidPart "단무지, 맛살, 햄" / howTo "젓가락으로 가공육과 단무지만 빼내세요"
- 국밥 -> eatPart "고기와 건더기" / avoidPart "국물" / howTo "건더기 위주로 건져 드시고 국물은 남기세요"
- 피자 -> eatPart "토핑과 도우 안쪽" / avoidPart "기름진 페퍼로니, 도우 테두리" / howTo "키친타올로 표면 기름을 한 번 닦아내세요"
- 짜장면 -> eatPart "면과 야채 건더기" / avoidPart "그릇 바닥에 고인 기름 섞인 소스" / howTo "면을 소스에서 건져 올려 드세요"

정말로 분리할 부위가 없는 음식(예: 흰쌀밥, 사과)만 eatPart에 "전체"라고 쓰고 양으로만 조절하세요.
"전체"를 남발하지 마세요.

그 밖의 규칙:
- 사용자의 오늘 남은 예산 안에 들어오도록 분량을 정하세요.
- 단백질이 부족하면 단백질 음식은 다 먹게 하고 탄수·지방을 줄이세요.
- kcal과 protein은 "권장한 부위를 권장한 양만큼" 먹었을 때의 값입니다.
- savedKcal은 남기는 부위와 양 덕분에 아낀 칼로리입니다.
- 모든 수치는 눈대중 추정치입니다. 확신이 없으면 confidence를 낮추세요.
- 음식이 아니거나 알아볼 수 없으면 items를 비우고 confidence를 "low"로 하세요.
- 한국어로, 친근한 반말이 아닌 존댓말로 답하세요.`;

interface Body {
  imageBase64: string;
  mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif";
  remaining?: { kcalLeft: number; proteinLeft: number; kcalTarget: number; proteinTarget: number } | null;
  note?: string;
}

export async function POST(req: Request) {
  try {
    assertApiKey();
    const { imageBase64, mediaType, remaining, note } = (await req.json()) as Body;
    if (!imageBase64) {
      return NextResponse.json({ error: "사진이 없습니다." }, { status: 400 });
    }

    const budgetText = remaining
      ? `오늘 남은 예산: ${remaining.kcalLeft}kcal, 단백질 ${remaining.proteinLeft}g
(하루 목표는 ${remaining.kcalTarget}kcal, 단백질 ${remaining.proteinTarget}g입니다)`
      : "아직 목표가 설정되지 않았습니다. 일반적인 건강 식사 기준으로 조언해주세요.";

    const content: Anthropic.ContentBlockParam[] = [
      { type: "image", source: { type: "base64", media_type: mediaType, data: imageBase64 } },
      {
        type: "text",
        text: `이 사진의 음식을 분석해주세요.

${budgetText}
${note ? `\n사용자 메모: ${note}` : ""}

각 음식마다 어떤 부분을 먹고 어떤 부분을 남길지 반드시 짚어주세요.`,
      },
    ];

    const res = await anthropic.messages.parse({
      model: MODEL,
      max_tokens: 8000,
      system: SYSTEM,
      output_config: { effort: "low", format: zodOutputFormat(MealSchema) },
      messages: [{ role: "user", content }],
    });

    if (!res.parsed_output) {
      return NextResponse.json({ error: "사진을 분석하지 못했습니다. 다시 찍어주세요." }, { status: 502 });
    }
    return NextResponse.json(res.parsed_output);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "알 수 없는 오류";
    console.error("[/api/meal]", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
