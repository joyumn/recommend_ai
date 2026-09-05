/**
 * 오늘 채워야 할 운동량 - 순수 수식. 열량 계산과 같은 이유로 AI를 쓰지 않는다.
 */

import type { ActivityLevel, DailyPlan, Profile } from "./nutrition";
import { bmr } from "./nutrition";
import type { Plan } from "./schema";

/** 종목과 시간으로 남긴 운동 한 건 */
export interface ExerciseSession {
  id: string;
  /** lib/exercise.ts의 종목 이름 */
  name: string;
  met: number;
  minutes: number;
  /** 그 종목·시간·체중으로 계산한 소모 열량 */
  kcal: number;
}

/** 폰 건강 앱이나 손으로 채워 넣는 하루치 활동 기록 */
export interface DayActivity {
  steps: number;
  /** 활동으로 소모한 열량 */
  activeKcal: number;
  /** 운동한 시간(분) */
  exerciseMin: number;
  source: "manual" | "file" | "shortcut";
  /** 마지막으로 채워진 시각 */
  at: string;
  /** 종목별 기록. 예전에 저장된 날에는 없다 */
  sessions?: ExerciseSession[];
}

export const EMPTY_ACTIVITY: DayActivity = {
  steps: 0,
  activeKcal: 0,
  exerciseMin: 0,
  source: "manual",
  at: "",
  sessions: [],
};

/**
 * 그날의 최종 수치.
 *
 * 건강 앱이 준 값과 손으로 남긴 종목 기록은 같은 운동을 두 번 셀 수 있다.
 * (수영 30분을 애플 건강도 잡고 사용자도 적는 경우) 그래서 더하지 않고 큰 쪽만 쓴다.
 */
export function dayTotals(a: DayActivity): {
  steps: number;
  exerciseMin: number;
  activeKcal: number;
} {
  const sessions = a.sessions ?? [];
  const loggedMin = sessions.reduce((x, s) => x + s.minutes, 0);
  const loggedKcal = sessions.reduce((x, s) => x + s.kcal, 0);

  return {
    steps: a.steps,
    exerciseMin: Math.max(a.exerciseMin, loggedMin),
    activeKcal: Math.max(a.activeKcal, loggedKcal),
  };
}

export interface ActivityGoal {
  /** 오늘 움직여서 태워야 하는 열량 */
  moveKcal: number;
  steps: number;
  /** 오늘 요일 운동 계획의 시간(분) */
  minutes: number;
  /** 오늘 요일 계획의 이름. 예: 하체 근력 */
  focus: string;
  /** 계획상 쉬는 날인지 */
  restDay: boolean;
}

/**
 * 걸음 목표. 활동 수준별로 흔히 쓰는 기준을 옮긴 값이며 의학적 처방은 아니다.
 * 하루 목표 열량처럼 정밀한 수식이 있는 값이 아니라서 근거를 여기 남겨둔다.
 */
const STEP_GOALS: Record<ActivityLevel, number> = {
  sedentary: 6000,
  light: 8000,
  moderate: 10000,
  active: 12000,
};

const DAY_NAMES = ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"];

export function todayDayName(d = new Date()): string {
  return DAY_NAMES[d.getDay()];
}

/** 주간 계획에서 오늘 요일을 찾는다. 모델이 "월", "월요일", "월요일 - 하체"처럼 써도 잡히게 */
export function todayInPlan(plan: Plan | null, d = new Date()): Plan["weeklyPlan"][number] | null {
  if (!plan) return null;
  const full = todayDayName(d);
  const short = full.slice(0, 1);
  return (
    plan.weeklyPlan.find((x) => x.day.includes(full)) ??
    plan.weeklyPlan.find((x) => x.day.trim().startsWith(short)) ??
    null
  );
}

/**
 * 오늘의 운동 목표.
 * 태울 열량은 하루 소비 열량(TDEE)에서 가만히 있어도 쓰는 기초대사량(BMR)을 뺀 값이다.
 * 즉 "움직여서 만들어내야 하는 몫"이며, 계획한 운동과 일상 활동을 합쳐 채우면 된다.
 */
export function activityGoal(
  profile: Profile | null,
  daily: DailyPlan | null,
  plan: Plan | null,
  d = new Date(),
): ActivityGoal | null {
  if (!profile || !daily) return null;

  const today = todayInPlan(plan, d);
  const minutes = today?.minutes ?? 0;
  const restDay = today ? today.exercises.length === 0 || minutes === 0 : false;

  return {
    moveKcal: Math.max(0, Math.round(daily.tdee - bmr(profile))),
    steps: STEP_GOALS[profile.activity],
    minutes,
    focus: today?.focus ?? "",
    restDay,
  };
}

export interface ActivityProgress {
  goal: ActivityGoal;
  done: DayActivity;
  kcalLeft: number;
  stepsLeft: number;
  minutesLeft: number;
  /** 0~1. 세 가지 중 목표가 있는 항목만 평균낸다 */
  ratio: number;
}

export function activityProgress(goal: ActivityGoal, activity: DayActivity): ActivityProgress {
  const done = { ...activity, ...dayTotals(activity) };

  const parts: number[] = [];
  if (goal.moveKcal > 0) parts.push(done.activeKcal / goal.moveKcal);
  if (goal.steps > 0) parts.push(done.steps / goal.steps);
  if (goal.minutes > 0) parts.push(done.exerciseMin / goal.minutes);

  const ratio = parts.length
    ? Math.min(1, parts.reduce((a, b) => a + b, 0) / parts.length)
    : 0;

  return {
    goal,
    done,
    kcalLeft: Math.max(0, goal.moveKcal - done.activeKcal),
    stepsLeft: Math.max(0, goal.steps - done.steps),
    minutesLeft: Math.max(0, goal.minutes - done.exerciseMin),
    ratio,
  };
}

/** 남은 운동량을 한 문장으로. 식사 사진을 찍기 전에 이 문장을 먼저 보여준다 */
export function activitySentence(p: ActivityProgress): string {
  if (p.goal.restDay && p.done.exerciseMin === 0) {
    return "오늘은 계획상 쉬는 날입니다. 가볍게 걷는 정도면 충분합니다.";
  }
  const bits: string[] = [];
  if (p.minutesLeft > 0) bits.push(`운동 ${p.minutesLeft}분`);
  if (p.stepsLeft > 0) bits.push(`${p.stepsLeft.toLocaleString()}걸음`);
  if (p.kcalLeft > 0) bits.push(`${p.kcalLeft}kcal`);

  if (bits.length === 0) return "오늘 운동량을 모두 채웠습니다. 잘하셨습니다.";
  return `${bits.join(" · ")} 더 채우면 오늘 목표입니다.`;
}
