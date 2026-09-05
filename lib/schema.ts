import { z } from "zod";

/* ---------- 1. 운동 계획 ---------- */

export const PlanSchema = z.object({
  summary: z.string().describe("2~3문장으로 이 사람의 목표와 전략을 요약"),
  weeklyPlan: z
    .array(
      z.object({
        day: z.string().describe("월요일, 화요일 ... 또는 '휴식일'"),
        focus: z.string().describe("예: 하체 근력, 유산소, 완전 휴식"),
        minutes: z.number().describe("총 소요 시간(분)"),
        exercises: z.array(
          z.object({
            name: z.string(),
            detail: z.string().describe("예: 3세트 x 12회, 또는 30분 빠르게 걷기"),
            note: z.string().describe("자세 주의점이나 대체 동작. 없으면 빈 문자열"),
          }),
        ),
      }),
    )
    .describe("월요일부터 일요일까지 7일 전부"),
  tips: z.array(z.string()).describe("식사·수면·회복 관련 실천 팁 3~5개"),
});
export type Plan = z.infer<typeof PlanSchema>;

/* ---------- 2. 식사 사진 분석 ---------- */

export const MealItemSchema = z.object({
  name: z.string().describe("음식 이름"),
  whereInPhoto: z.string().describe("사진 속 위치. 예: 왼쪽 아래 접시"),
  estimatedServing: z.string().describe("사진에 보이는 전체 양. 예: 2조각 (약 200g)"),

  // 이 앱의 핵심 - 어떤 부분을 먹느냐
  eatPart: z.string().describe("먹어도 되는 부위를 구체적으로. 분리할 부위가 없으면 '전체'"),
  avoidPart: z.string().describe("남겨야 하는 부위. 없으면 '없음'"),
  howTo: z.string().describe("그 부위를 분리하는 실제 방법 한 문장"),

  eatAmount: z.string().describe("얼마나 먹을지. 예: 2조각 중 1.5조각"),
  eatRatio: z.number().describe("먹을 비율 0~1"),
  kcal: z.number().describe("권장대로 먹었을 때의 칼로리"),
  protein: z.number().describe("권장대로 먹었을 때의 단백질(g)"),
  savedKcal: z.number().describe("남기는 부위와 양 덕분에 아낀 칼로리"),
  reason: z.string().describe("왜 이렇게 먹어야 하는지 한 문장"),
  box: z
    .array(z.number())
    .nullable()
    .describe("사진 속 위치 [x0,y0,x1,y1], 0~1 비율. 확실하지 않으면 null"),
});

export const MealSchema = z.object({
  dishName: z.string().describe("이 상차림 전체를 부르는 이름"),
  items: z.array(MealItemSchema),
  totalKcalIfFollowed: z.number(),
  totalProteinIfFollowed: z.number(),
  totalSavedKcal: z.number(),
  advice: z.string().describe("오늘 남은 예산을 고려한 조언 2~3문장"),
  confidence: z.enum(["high", "medium", "low"]).describe("사진 판독 확신도"),
});
export type Meal = z.infer<typeof MealSchema>;
export type MealItem = z.infer<typeof MealItemSchema>;

/* ---------- 3. 근처 식당 ---------- */

export const NearbySchema = z.object({
  picks: z.array(
    z.object({
      placeName: z.string().describe("카카오에서 받은 상호명 그대로"),
      categoryName: z.string(),
      distanceM: z.number(),
      placeUrl: z.string(),
      menu: z.string().describe("그 식당에 있을 법한 메뉴 하나 (예상)"),
      eatPart: z.string().describe("먹어도 되는 부분"),
      avoidPart: z.string().describe("남겨야 하는 부분"),
      eatAmount: z.string().describe("얼마나 먹을지"),
      kcal: z.number(),
      protein: z.number(),
      fitScore: z.number().describe("오늘 예산에 얼마나 맞는지 1~5"),
      reason: z.string(),
    }),
  ),
});
export type Nearby = z.infer<typeof NearbySchema>;
