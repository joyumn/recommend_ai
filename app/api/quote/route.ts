import { NextResponse } from "next/server";
import { generateJson, assertApiKey } from "@/lib/gemini";
import { QuoteSchema } from "@/lib/schema";

export const maxDuration = 30;

/**
 * 오늘의 한마디. 어제와 같은 말이 나오지 않도록 오늘 상황을 함께 넘긴다.
 *
 * 실존 인물의 명언을 만들어내면 없는 말을 인용하게 된다. 그래서 모델에게는
 * 직접 쓴 응원 문장만 받고, 화면에도 "몸친"이라고만 적는다.
 * 여기가 실패해도 화면은 앱에 내장된 문구로 채워진다(lib/quotes.ts).
 */
const SYSTEM = `당신은 다이어트를 돕는 코치입니다. 오늘 하루를 시작하는 사람에게 건넬 짧은 응원을 씁니다.

규칙:
- 1~2문장, 60자 안팎. 한국어 존댓말.
- **실존 인물이나 책의 말을 인용하지 마세요.** 당신이 직접 쓴 문장이어야 합니다.
- 훈계하거나 몰아붙이지 마세요. 오늘 할 수 있는 작은 것 하나를 짚어주세요.
- 체중이나 외모를 평가하지 마세요. 숫자를 그대로 되읽어주지도 마세요.
- 상황이 주어지면 그 상황에 맞는 말을 하세요. 남은 운동량이 많은 날과 다 채운 날은 달라야 합니다.`;

export async function POST(req: Request) {
  try {
    assertApiKey();

    const body = (await req.json()) as {
      dateLabel?: string;
      goal?: string;
      dayName?: string;
      focus?: string;
      minutesLeft?: number;
      kcalLeft?: number;
      streakDays?: number;
    };

    const lines = [
      body.dateLabel ? `오늘: ${body.dateLabel} ${body.dayName ?? ""}` : null,
      body.goal ? `목표: ${body.goal}` : null,
      body.focus ? `오늘 운동 계획: ${body.focus}` : null,
      typeof body.minutesLeft === "number" ? `남은 운동 시간: ${body.minutesLeft}분` : null,
      typeof body.kcalLeft === "number" ? `남은 섭취 여유: ${body.kcalLeft}kcal` : null,
      typeof body.streakDays === "number" && body.streakDays > 1
        ? `${body.streakDays}일째 기록을 이어가는 중`
        : null,
    ].filter(Boolean);

    const prompt =
      lines.length > 0
        ? ["오늘 상황입니다.", "", ...lines, "", "이 사람에게 건넬 한마디를 써주세요."].join("\n")
        : "오늘 하루를 시작하는 사람에게 건넬 한마디를 써주세요.";

    // 매일 같은 말이 나오면 안 되므로 온도를 높인다
    const result = await generateJson({
      system: SYSTEM,
      schema: QuoteSchema,
      temperature: 1,
      parts: [{ text: prompt }],
    });

    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "알 수 없는 오류";
    console.error("[/api/quote]", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
