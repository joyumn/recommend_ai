import { recentDays, type AppState } from "./storage";

/**
 * 최근 며칠을 서버로 넘길 모양으로 간추린다.
 *
 * 사진 분석과 식당 추천이 같은 맥락을 보게 하려고 한곳에서 만든다.
 * 사람 이름이나 위치 같은 건 담지 않는다. 먹은 것과 움직인 양뿐이다.
 */
export interface DayHistory {
  label: string;
  meals: string[];
  steps: number;
  exerciseMin: number;
  activeKcal: number;
  /** 그날 기록된 열량 합계. 이름만 적은 끼니는 0이라 합계에 안 들어간다 */
  kcal: number;
}

export function recentHistory(state: AppState, days = 3): DayHistory[] {
  return recentDays(state, days)
    .map((d) => ({
      label: d.label,
      meals: d.logs.map((l) => (l.slot ? `${l.slot}: ${l.dishName}` : l.dishName)),
      steps: d.activity.steps,
      exerciseMin: d.activity.exerciseMin,
      activeKcal: d.activity.activeKcal,
      kcal: d.logs.reduce((a, l) => a + l.kcal, 0),
    }))
    .filter((d) => d.meals.length > 0 || d.steps > 0 || d.exerciseMin > 0 || d.activeKcal > 0);
}

/** 최근에 먹은 음식 이름만. 식당 추천이 같은 걸 또 권하지 않게 하는 데 쓴다 */
export function recentDishes(state: AppState, days = 3): string[] {
  return recentDays(state, days).flatMap((d) => d.logs.map((l) => l.dishName));
}
