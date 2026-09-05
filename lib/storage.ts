"use client";

import type { DayActivity, ExerciseSession } from "./activity";
import { EMPTY_ACTIVITY } from "./activity";
import type { Profile, DailyPlan } from "./nutrition";
import type { Plan, Meal } from "./schema";

const KEY = "fitplan.v1";

export interface MealLog {
  id: string;
  at: string;
  dishName: string;
  kcal: number;
  protein: number;
  /** 아침·점심·저녁·간식. 예전에 저장된 기록에는 없다 */
  slot?: Slot;
  /** 사진으로 분석한 것인지, 손으로 적은 것인지 */
  source?: "photo" | "manual";
}

export const SLOTS = ["아침", "점심", "저녁", "간식", "야식"] as const;
export type Slot = (typeof SLOTS)[number];

/** 오늘 뜬 응원 문구. 하루에 한 번만 새로 받아온다 */
export interface SavedQuote {
  date: string;
  text: string;
  author: string;
  from: "ai" | "builtin";
}

export interface AppState {
  profile: Profile | null;
  daily: DailyPlan | null;
  plan: Plan | null;
  logs: MealLog[];
  /** 날짜(YYYY-MM-DD)별 활동 기록 */
  activity: Record<string, DayActivity>;
  quote: SavedQuote | null;
}

const EMPTY: AppState = {
  profile: null,
  daily: null,
  plan: null,
  logs: [],
  activity: {},
  quote: null,
};

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

/* ---------- 화면이 구독하는 저장소 ---------- */

/**
 * localStorage는 브라우저에만 있다. 첫 렌더에서는 null을 주고 브라우저에서 한 번 더 그린다.
 * useEffect 안에서 setState 하던 것과 결과는 같지만, 렌더가 끝난 뒤 상태를 밀어 넣지 않아
 * React 규칙(set-state-in-effect)에 걸리지 않는다.
 */
let cached: AppState | null = null;
const listeners = new Set<() => void>();

export function subscribeState(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

/** 브라우저 스냅샷. 바뀌지 않았으면 같은 객체를 돌려줘야 다시 그리지 않는다 */
export function stateSnapshot(): AppState {
  cached ??= loadState();
  return cached;
}

/** 서버·하이드레이션 스냅샷. 아직 읽을 수 없다는 뜻으로 null */
export function serverStateSnapshot(): null {
  return null;
}

/** 상태를 바꾸고 저장한 뒤 구독 중인 화면에 알린다 */
export function commitState(next: AppState) {
  cached = next;
  saveState(next);
  for (const notify of listeners) notify();
}

/**
 * 날짜 키. 사용자가 사는 시간대 기준이어야 한다.
 * toISOString()은 UTC라, 한국에서 자정~오전 9시에 남긴 기록이 어제로 밀려난다.
 */
export function dateKey(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** 오늘 먹은 것만 골라낸다 */
export function todayLogs(logs: MealLog[]): MealLog[] {
  const t = dateKey();
  return logs.filter((l) => dateKey(new Date(l.at)) === t);
}

/** 오늘 활동 기록. 아직 채워지지 않았으면 0으로 채운 값 */
export function todayActivity(s: AppState, d = new Date()): DayActivity {
  return s.activity[dateKey(d)] ?? EMPTY_ACTIVITY;
}

/**
 * 오늘 활동 기록을 덮어쓴다.
 * 걸음만 들어오고 칼로리는 없는 경우가 흔해서, 넘어온 값만 갈아끼운다.
 */
export function withActivity(
  s: AppState,
  patch: Partial<Omit<DayActivity, "at">>,
  d = new Date(),
): AppState {
  const key = dateKey(d);
  const prev = s.activity[key] ?? EMPTY_ACTIVITY;
  // 넘어오지 않은 항목은 그대로 둔다. 스프레드는 undefined도 덮어써서 직접 걸러낸다
  const given = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));
  return {
    ...s,
    activity: {
      ...s.activity,
      [key]: { ...prev, ...given, at: new Date().toISOString() },
    },
  };
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

/**
 * 며칠째 이어오고 있는지. 식사를 기록했거나 활동이 채워진 날을 오늘부터 거꾸로 센다.
 * 오늘 아직 아무것도 없으면 어제까지의 기록을 세어 "이어오던 날"을 보여준다.
 */
/** 종목별 운동 한 건을 그날에 더한다 */
export function withSession(
  s: AppState,
  session: Omit<ExerciseSession, "id">,
  d = new Date(),
): AppState {
  const key = dateKey(d);
  const prev = s.activity[key] ?? EMPTY_ACTIVITY;
  const entry: ExerciseSession = {
    ...session,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  };

  return {
    ...s,
    activity: {
      ...s.activity,
      [key]: {
        ...prev,
        sessions: [...(prev.sessions ?? []), entry],
        at: new Date().toISOString(),
      },
    },
  };
}

export function withoutSession(s: AppState, id: string, d = new Date()): AppState {
  const key = dateKey(d);
  const prev = s.activity[key];
  if (!prev?.sessions) return s;

  return {
    ...s,
    activity: {
      ...s.activity,
      [key]: { ...prev, sessions: prev.sessions.filter((x) => x.id !== id) },
    },
  };
}

export function streakDays(s: AppState, d = new Date()): number {
  const marked = new Set<string>(Object.keys(s.activity));
  for (const l of s.logs) marked.add(dateKey(new Date(l.at)));

  const day = new Date(d);
  if (!marked.has(dateKey(day))) day.setDate(day.getDate() - 1);

  let count = 0;
  while (marked.has(dateKey(day)) && count < 3650) {
    count++;
    day.setDate(day.getDate() - 1);
  }
  return count;
}

/** 손으로 적은 끼니. 열량을 모르면 0으로 두고 예산에는 넣지 않는다 */
export function addManualLog(
  s: AppState,
  entry: {
    dishName: string;
    slot: Slot;
    kcal?: number;
    protein?: number;
    source?: "photo" | "manual";
  },
  d = new Date(),
): AppState {
  const at = new Date(d);
  // 날짜만 맞으면 되므로 시간은 끼니 순서대로 적어 정렬이 자연스럽게 되게 한다
  const hour = { 아침: 8, 점심: 12, 저녁: 19, 간식: 15, 야식: 22 }[entry.slot];
  at.setHours(hour, 0, 0, 0);

  const log: MealLog = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    at: at.toISOString(),
    dishName: entry.dishName.trim(),
    kcal: Math.max(0, Math.round(entry.kcal ?? 0)),
    protein: Math.max(0, Math.round(entry.protein ?? 0)),
    slot: entry.slot,
    source: entry.source ?? "manual",
  };
  return { ...s, logs: [...s.logs, log] };
}

export function removeLog(s: AppState, id: string): AppState {
  return { ...s, logs: s.logs.filter((l) => l.id !== id) };
}

export interface DayRecord {
  key: string;
  /** 오늘 · 어제 · 9월 3일 */
  label: string;
  date: Date;
  logs: MealLog[];
  activity: DayActivity;
}

/** 오늘부터 거슬러 n일치. 지난 며칠을 한눈에 놓고 채워 넣을 때 쓴다 */
export function recentDays(s: AppState, n = 3, from = new Date()): DayRecord[] {
  const out: DayRecord[] = [];

  for (let i = 0; i < n; i++) {
    const date = new Date(from);
    date.setDate(date.getDate() - i);
    const key = dateKey(date);
    const label =
      i === 0 ? "오늘" : i === 1 ? "어제" : `${date.getMonth() + 1}월 ${date.getDate()}일`;

    out.push({
      key,
      label,
      date,
      logs: s.logs
        .filter((l) => dateKey(new Date(l.at)) === key)
        .sort((a, b) => a.at.localeCompare(b.at)),
      activity: s.activity[key] ?? EMPTY_ACTIVITY,
    });
  }

  return out;
}

/** 시각으로 어느 끼니인지 짐작한다. 사진을 찍은 시간이 곧 먹은 시간이다 */
export function slotByHour(h: number): Slot {
  if (h < 10) return "아침";
  if (h < 15) return "점심";
  if (h < 18) return "간식";
  if (h < 21) return "저녁";
  return "야식";
}

export function addLog(s: AppState, meal: Meal): AppState {
  const now = new Date();
  const log: MealLog = {
    id: `${Date.now()}`,
    at: now.toISOString(),
    dishName: meal.dishName,
    kcal: meal.totalKcalIfFollowed,
    protein: meal.totalProteinIfFollowed,
    slot: slotByHour(now.getHours()),
    source: "photo",
  };
  return { ...s, logs: [...s.logs, log] };
}
