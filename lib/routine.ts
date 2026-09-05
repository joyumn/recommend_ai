/**
 * 주 몇 회 · 회당 몇 분 - 순수 수식. 열량 계산과 같은 이유로 AI를 쓰지 않는다.
 *
 * 이 값은 "근처 운동센터" 탭이 센터를 고르고 월 비용을 셈하는 기준이 된다.
 * 모델에게 물으면 같은 사람에게 매번 다른 횟수를 말해 월 비용까지 흔들린다.
 */

import type { DailyPlan, Profile } from "./nutrition";
import { ACTIVITY_LABELS, type ActivityLevel } from "./nutrition";
import type { Plan } from "./schema";

export interface WeeklyRoutine {
  /** 주당 운동 횟수 */
  perWeek: number;
  /** 회당 운동 시간(분) */
  minutesPerSession: number;
  /** 주당 총 운동 시간(분). perWeek × minutesPerSession과 항상 일치한다 */
  weeklyMinutes: number;
  cardioPerWeek: number;
  strengthPerWeek: number;
  /** 이 값이 어디서 나왔는지. 화면에 배지로 붙는다 */
  from: "plan" | "profile";
  /** 왜 이 횟수인지 한 문장 */
  why: string;
}

/**
 * 목표별 주간 운동 시간(분).
 * WHO 성인 권고는 중강도 주 150~300분이고, 체중 감량에는 그 위쪽을 쓴다.
 * 걸음 목표(lib/activity.ts)와 마찬가지로 정밀한 수식이 있는 값이 아니라 근거를 여기 남긴다.
 */
const WEEKLY_MINUTES: Record<DailyPlan["goal"], number> = {
  lose: 250,
  maintain: 150,
  gain: 200,
};

/** 목표별 기본 횟수 */
const BASE_PER_WEEK: Record<DailyPlan["goal"], number> = {
  lose: 4,
  maintain: 3,
  gain: 4,
};

/**
 * 지금 활동량에서 한 번에 올려도 되는 상한.
 * 거의 안 움직이던 사람에게 주 5회를 권하면 첫 주에 그만둔다.
 */
const MAX_PER_WEEK: Record<ActivityLevel, number> = {
  sedentary: 3,
  light: 4,
  moderate: 5,
  active: 6,
};

/** 근력 최소 횟수. WHO는 주 2회 이상을 권한다 */
const STRENGTH_PER_WEEK: Record<DailyPlan["goal"], number> = {
  lose: 2,
  maintain: 2,
  gain: 3,
};

/** 회당 시간은 이 범위 안에서만. 20분은 너무 짧고 90분은 지키기 어렵다 */
const MIN_SESSION = 30;
const MAX_SESSION = 75;

/**
 * 쉬는 날. 계획에는 "완전 휴식"이라고 적힌 날에도 스트레칭 20분이 들어 있곤 해서,
 * 시간이 0인지만 보면 이레 내내 운동하는 것으로 세어진다.
 * 센터를 고르는 자리에서는 "몇 번 나가야 하나"가 알고 싶은 것이므로 이런 날은 뺀다.
 */
const REST = /휴식|쉬는|리커버리|회복|레스트/;

/** 이 시간보다 짧은 날은 집에서 푸는 정도로 보고 세지 않는다 */
const MIN_REAL_SESSION = 25;

/** 계획이 이레 내내 차 있어도 등록은 이만큼까지만 권한다 */
const MAX_FROM_PLAN = 6;

const CARDIO = /유산소|걷기|달리기|조깅|러닝|자전거|사이클|수영|인터벌|심폐|등산/;
const STRENGTH = /근력|웨이트|하체|상체|전신|코어|등|가슴|어깨|팔|복근|힙|덤벨|맨몸/;

/**
 * 5분 단위로 내려서 끊는다. 47분이라고 적어두면 지키는 사람이 없고,
 * 올리는 쪽보다 내리는 쪽이 지켜질 확률이 높다(62.5분 -> 65분보다 60분).
 */
function round5(n: number): number {
  return Math.floor(n / 5) * 5;
}

/**
 * 이미 만들어둔 7일 계획에서 주 N회를 뽑는다.
 * 계획이 있는데도 여기서 따로 계산하면 두 탭이 다른 말을 하게 된다.
 */
function fromPlan(plan: Plan): WeeklyRoutine | null {
  const all = plan.weeklyPlan.filter((d) => d.exercises.length > 0 && d.minutes > 0);
  const workDays = all.filter((d) => !REST.test(d.focus) && d.minutes >= MIN_REAL_SESSION);
  if (workDays.length === 0) return null;

  const perWeek = Math.min(workDays.length, MAX_FROM_PLAN);
  const rested = all.length - workDays.length;
  // 5분 단위로 고른 평균. perWeek와 곱해서 앞뒤가 맞게 주간 합계도 다시 센다
  const minutesPerSession = round5(
    workDays.reduce((sum, d) => sum + d.minutes, 0) / workDays.length,
  );

  // focus는 모델이 쓴 자유 문장이라 둘 다 걸리거나 둘 다 안 걸릴 수 있다
  const cardio = workDays.filter((d) => CARDIO.test(d.focus)).length;
  const strength = workDays.filter((d) => STRENGTH.test(d.focus)).length;

  return {
    perWeek,
    minutesPerSession,
    weeklyMinutes: perWeek * minutesPerSession,
    cardioPerWeek: Math.min(cardio, perWeek),
    strengthPerWeek: Math.min(strength, perWeek),
    from: "plan",
    why:
      `내 계획의 7일 운동표에서 제대로 운동하는 날만 세었습니다.` +
      (rested > 0 ? ` 쉬는 날 ${rested}일은 뺐습니다.` : ""),
  };
}

/** 계획이 아직 없을 때. 목표와 지금 활동량으로 정한다 */
function fromProfile(profile: Profile, daily: DailyPlan): WeeklyRoutine {
  const goal = daily.goal;
  const perWeek = Math.min(BASE_PER_WEEK[goal], MAX_PER_WEEK[profile.activity]);

  const wanted = round5(WEEKLY_MINUTES[goal] / perWeek);
  const minutesPerSession = Math.min(MAX_SESSION, Math.max(MIN_SESSION, wanted));

  // 회당 시간을 잘라냈으면 주간 합계도 같이 줄인다. 두 숫자가 어긋나면 화면에서 바로 보인다
  const weeklyMinutes = perWeek * minutesPerSession;

  const strengthPerWeek = Math.min(STRENGTH_PER_WEEK[goal], perWeek);
  const cardioPerWeek = Math.max(1, perWeek - strengthPerWeek);

  const goalWord = goal === "lose" ? "감량" : goal === "gain" ? "증량" : "유지";

  return {
    perWeek,
    minutesPerSession,
    weeklyMinutes,
    cardioPerWeek,
    strengthPerWeek,
    from: "profile",
    why: `${goalWord}이 목표라 주 ${weeklyMinutes}분을 잡았고, 지금 활동량(${ACTIVITY_LABELS[profile.activity]})에서 무리하지 않게 주 ${perWeek}회로 나눴습니다.`,
  };
}

/**
 * 이 사람에게 권할 주간 운동량.
 * 계획이 있으면 계획을 따르고, 없으면 목표와 활동량으로 정한다.
 */
export function weeklyRoutine(
  profile: Profile | null,
  daily: DailyPlan | null,
  plan: Plan | null,
): WeeklyRoutine | null {
  if (!profile || !daily) return null;
  // 계획이 통째로 휴식일이면 뽑을 것이 없다. 그때는 프로필로 내려간다
  return (plan && fromPlan(plan)) || fromProfile(profile, daily);
}

/** 한 달을 몇 주로 볼 것인가. 회당 결제 센터의 월 비용을 셈할 때 쓴다 */
export const WEEKS_PER_MONTH = 4.3;
