"use client";

import type { Profile, DailyPlan } from "./nutrition";
import type { Plan, Meal } from "./schema";

const KEY = "fitplan.v1";

export interface MealLog {
  id: string;
  at: string;
  dishName: string;
  kcal: number;
  protein: number;
}

export interface AppState {
  profile: Profile | null;
  daily: DailyPlan | null;
  plan: Plan | null;
  logs: MealLog[];
}

const EMPTY: AppState = { profile: null, daily: null, plan: null, logs: [] };

export function loadState(): AppState {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return EMPTY;
    return { ...EMPTY, ...(JSON.parse(raw) as AppState) };
  } catch {
    return EMPTY;
  }
}

export function saveState(s: AppState) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // 저장 실패해도 앱은 계속 동작해야 한다
  }
}

function todayKey(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

/** 오늘 먹은 것만 골라낸다 */
export function todayLogs(logs: MealLog[]): MealLog[] {
  const t = todayKey();
  return logs.filter((l) => l.at.slice(0, 10) === t);
}

export interface Remaining {
  kcalTarget: number;
  kcalEaten: number;
  kcalLeft: number;
  proteinTarget: number;
  proteinEaten: number;
  proteinLeft: number;
}

/** 오늘 남은 예산. 이 값이 사진 분석과 식당 추천의 기준이 된다 */
export function remainingToday(s: AppState): Remaining | null {
  if (!s.daily) return null;
  const mine = todayLogs(s.logs);
  const kcalEaten = Math.round(mine.reduce((a, l) => a + l.kcal, 0));
  const proteinEaten = Math.round(mine.reduce((a, l) => a + l.protein, 0));
  return {
    kcalTarget: s.daily.dailyKcal,
    kcalEaten,
    kcalLeft: s.daily.dailyKcal - kcalEaten,
    proteinTarget: s.daily.proteinG,
    proteinEaten,
    proteinLeft: s.daily.proteinG - proteinEaten,
  };
}

export function addLog(s: AppState, meal: Meal): AppState {
  const log: MealLog = {
    id: `${Date.now()}`,
    at: new Date().toISOString(),
    dishName: meal.dishName,
    kcal: meal.totalKcalIfFollowed,
    protein: meal.totalProteinIfFollowed,
  };
  return { ...s, logs: [...s.logs, log] };
}
