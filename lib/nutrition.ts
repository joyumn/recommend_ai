/**
 * 영양 계산 - 순수 수식. AI를 쓰지 않는다.
 * 칼로리 같은 숫자는 매번 같은 답이 나와야 하므로 공식으로 계산한다.
 */

export type Sex = "male" | "female";
export type ActivityLevel = "sedentary" | "light" | "moderate" | "active";

export interface Profile {
  sex: Sex;
  age: number;
  heightCm: number;
  weightKg: number;
  targetWeightKg: number;
  targetWeeks: number;
  activity: ActivityLevel;
}

export const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
};

export const ACTIVITY_LABELS: Record<ActivityLevel, string> = {
  sedentary: "거의 안 움직임 · 사무직",
  light: "가벼운 활동 · 주 1~3회 운동",
  moderate: "보통 활동 · 주 3~5회 운동",
  active: "활발함 · 주 6회 이상",
};

/** 체지방 1kg을 태우는 데 필요한 열량 */
const KCAL_PER_KG_FAT = 7700;
/** 하루 열량 적자 상한. 이보다 크면 근손실과 요요가 온다 */
const MAX_DAILY_DEFICIT = 750;
/** 하루 최소 섭취 열량. 이 아래로는 어떤 경우에도 권하지 않는다 */
const MIN_INTAKE: Record<Sex, number> = { male: 1500, female: 1200 };
/** 체중 1kg당 단백질 권장량(g) */
const PROTEIN_PER_KG = 1.6;

/** Mifflin-St Jeor 기초대사량 */
export function bmr(p: Profile): number {
  const base = 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age;
  return p.sex === "male" ? base + 5 : base - 161;
}

/** 활동량을 반영한 하루 소비 열량 */
export function tdee(p: Profile): number {
  return bmr(p) * ACTIVITY_FACTORS[p.activity];
}

export interface DailyPlan {
  bmr: number;
  tdee: number;
  /** 감량이면 양수, 증량이면 음수 */
  weightDeltaKg: number;
  goal: "lose" | "gain" | "maintain";
  /** 사용자가 설정한 기간대로 했을 때 필요한 하루 적자 */
  requestedDeficit: number;
  /** 가드레일을 적용한 실제 하루 적자 */
  dailyDeficit: number;
  /** 하루 목표 섭취 열량 */
  dailyKcal: number;
  proteinG: number;
  /** 이 속도로 갔을 때 실제로 걸리는 주 수 */
  realisticWeeks: number;
  warnings: string[];
}

/**
 * 프로필 -> 하루 목표 열량.
 * 무리한 목표는 조용히 따라가지 않고 안전한 값으로 잘라낸 뒤 경고를 함께 돌려준다.
 */
export function dailyPlan(p: Profile): DailyPlan {
  const warnings: string[] = [];
  const t = tdee(p);
  const minIntake = MIN_INTAKE[p.sex];
  const weightDeltaKg = p.weightKg - p.targetWeightKg;

  const goal: DailyPlan["goal"] =
    Math.abs(weightDeltaKg) < 0.5 ? "maintain" : weightDeltaKg > 0 ? "lose" : "gain";

  if (goal === "maintain") {
    return {
      bmr: Math.round(bmr(p)),
      tdee: Math.round(t),
      weightDeltaKg: 0,
      goal,
      requestedDeficit: 0,
      dailyDeficit: 0,
      dailyKcal: Math.round(t),
      proteinG: Math.round(p.targetWeightKg * PROTEIN_PER_KG),
      realisticWeeks: p.targetWeeks,
      warnings,
    };
  }

  const days = Math.max(1, p.targetWeeks * 7);
  const requestedDeficit = (weightDeltaKg * KCAL_PER_KG_FAT) / days;

  if (goal === "gain") {
    // 증량: 주당 0.5kg 이상은 대부분 지방으로 붙는다
    const surplus = Math.min(Math.abs(requestedDeficit), 500);
    if (Math.abs(requestedDeficit) > 500) {
      warnings.push(
        "설정하신 기간이 짧아 빠르게 찌우면 대부분 지방으로 갑니다. 하루 +500kcal로 조정했습니다.",
      );
    }
    const dailyKcal = Math.round(t + surplus);
    return {
      bmr: Math.round(bmr(p)),
      tdee: Math.round(t),
      weightDeltaKg,
      goal,
      requestedDeficit: Math.round(requestedDeficit),
      dailyDeficit: -Math.round(surplus),
      dailyKcal,
      proteinG: Math.round(p.targetWeightKg * PROTEIN_PER_KG),
      realisticWeeks: Math.ceil((Math.abs(weightDeltaKg) * KCAL_PER_KG_FAT) / surplus / 7),
      warnings,
    };
  }

  // 감량 - 가드레일 두 겹
  // 1) 하루 적자 상한
  let deficit = Math.min(requestedDeficit, MAX_DAILY_DEFICIT);
  // 2) 최소 섭취 열량 하한
  deficit = Math.min(deficit, Math.max(0, t - minIntake));

  const weeklyLossKg = (deficit * 7) / KCAL_PER_KG_FAT;
  const weeklyLossPct = (weeklyLossKg / p.weightKg) * 100;

  const realisticWeeks =
    deficit > 0
      ? Math.ceil((weightDeltaKg * KCAL_PER_KG_FAT) / deficit / 7)
      : p.targetWeeks;

  if (requestedDeficit > deficit + 1) {
    warnings.push(
      `설정하신 ${p.targetWeeks}주는 너무 짧습니다. 안전한 속도로는 약 ${realisticWeeks}주가 걸립니다. 그 기준으로 계획을 세웠습니다.`,
    );
  }
  if (weeklyLossPct > 1) {
    warnings.push("주당 감량이 체중의 1%를 넘습니다. 근손실 위험이 있습니다.");
  }
  if (t - deficit <= minIntake + 1 && requestedDeficit > deficit) {
    warnings.push(
      `하루 ${minIntake}kcal 아래로는 권하지 않아 섭취량을 ${minIntake}kcal로 맞췄습니다.`,
    );
  }

  return {
    bmr: Math.round(bmr(p)),
    tdee: Math.round(t),
    weightDeltaKg,
    goal,
    requestedDeficit: Math.round(requestedDeficit),
    dailyDeficit: Math.round(deficit),
    dailyKcal: Math.max(minIntake, Math.round(t - deficit)),
    proteinG: Math.round(p.targetWeightKg * PROTEIN_PER_KG),
    realisticWeeks,
    warnings,
  };
}
