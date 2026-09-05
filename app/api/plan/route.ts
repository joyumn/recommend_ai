import { NextResponse } from "next/server";
import { generateJson, assertApiKey } from "@/lib/gemini";
import { PlanSchema } from "@/lib/schema";
import { dailyPlan, ACTIVITY_LABELS, type Profile } from "@/lib/nutrition";

export const maxDuration = 60;

const SYSTEM = `당신은 한국인을 대상으로 하는 운동 코치입니다.
- 헬스장이 없어도 집에서 할 수 있는 대체 동작을 반드시 함께 제시하세요.
- 무리한 감량을 권하지 않습니다. 주어진 목표 열량은 이미 안전 범위로 조정된 값이니 그대로 존중하세요.
- 초보자도 바로 따라 할 수 있게 구체적으로 쓰세요. "적당히"처럼 모호한 표현은 쓰지 마세요.
- 주 7일 전부를 채우되 휴식일을 최소 1일 넣으세요.
- 의학적 진단이나 치료를 말하지 마세요.
- 한국어 존댓말로 답하세요.`;

export async function POST(req: Request) {
  try {
    assertApiKey();
    const profile = (await req.json()) as Profile;
    const daily = dailyPlan(profile);

    const goalText =
      daily.goal === "lose"
        ? `${daily.weightDeltaKg.toFixed(1)}kg 감량`
        : daily.goal === "gain"
          ? `${Math.abs(daily.weightDeltaKg).toFixed(1)}kg 증량`
          : "현재 체중 유지";

    const plan = await generateJson({
      system: SYSTEM,
      schema: PlanSchema,
      parts: [
        {
          text: `아래 사람에게 맞는 1주일 운동 계획을 세워주세요.

- 성별: ${profile.sex === "male" ? "남성" : "여성"}, ${profile.age}세
- 키/체중: ${profile.heightCm}cm / ${profile.weightKg}kg
- 목표: ${profile.targetWeightKg}kg (${goalText})
- 현재 활동량: ${ACTIVITY_LABELS[profile.activity]}
- 하루 소비 열량(TDEE): ${daily.tdee}kcal
- 하루 목표 섭취 열량: ${daily.dailyKcal}kcal
- 하루 목표 단백질: ${daily.proteinG}g
- 현실적인 목표 도달 기간: 약 ${daily.realisticWeeks}주`,
        },
      ],
    });

    return NextResponse.json({ daily, plan });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "알 수 없는 오류";
    console.error("[/api/plan]", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
