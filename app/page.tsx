"use client";

import { useState, useSyncExternalStore } from "react";
import { activityGoal } from "@/lib/activity";
import type { Profile } from "@/lib/nutrition";
import type { Meal } from "@/lib/schema";
import {
  addLog,
  commitState,
  loadState,
  remainingToday,
  serverStateSnapshot,
  stateSnapshot,
  subscribeState,
} from "@/lib/storage";
import { useHealthLink } from "@/lib/useHealthLink";
import BudgetBar from "@/components/BudgetBar";
import PlanTab from "@/components/PlanTab";
import MealTab from "@/components/MealTab";
import NearbyTab from "@/components/NearbyTab";
import CenterTab from "@/components/CenterTab";
import RecentMeals from "@/components/RecentMeals";

type Tab = "plan" | "meal" | "log" | "nearby" | "center";

const TABS: { id: Tab; label: string }[] = [
  { id: "plan", label: "내 계획" },
  { id: "meal", label: "식사 사진" },
  { id: "log", label: "3일 기록" },
  { id: "nearby", label: "근처 식당" },
  { id: "center", label: "운동센터" },
];

export default function Home() {
  const [tab, setTab] = useState<Tab>("plan");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // localStorage는 브라우저에만 있으므로 화면이 뜬 뒤에 읽는다
  const state = useSyncExternalStore(subscribeState, stateSnapshot, serverStateSnapshot);

  // 아이폰 단축어가 주소에 실어 보낸 오늘 활동을 받는다
  useHealthLink(state);

  async function createPlan(profile: Profile) {
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "계획을 만들지 못했습니다.");
      commitState({ ...(state ?? loadState()), profile, daily: json.daily, plan: json.plan });
    } catch (e) {
      setError(e instanceof Error ? e.message : "계획을 만들지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

  if (!state) {
    return <div className="p-6 text-sm text-muted">불러오는 중...</div>;
  }

  const remaining = remainingToday(state);
  const goal = activityGoal(state.profile, state.daily, state.plan);

  return (
    <div className="flex min-h-screen flex-col pb-24">
      <BudgetBar r={remaining} />

      <main className="flex-1 px-4 py-5">
        {tab === "plan" && (
          <PlanTab
            state={state}
            goal={goal}
            busy={busy}
            error={error}
            onSubmit={createPlan}
            onReset={() => commitState({ ...state, daily: null, plan: null })}
          />
        )}
        {tab === "meal" && (
          <MealTab
            state={state}
            goal={goal}
            remaining={remaining}
            onLog={(m: Meal) => commitState(addLog(state, m))}
            onOpenLog={() => setTab("log")}
          />
        )}
        {tab === "log" && <RecentMeals state={state} />}
        {tab === "nearby" && <NearbyTab state={state} remaining={remaining} />}
        {tab === "center" && <CenterTab state={state} />}
      </main>

      <nav className="fixed bottom-0 left-1/2 z-20 w-full max-w-[480px] -translate-x-1/2 border-t border-line bg-card/95 backdrop-blur">
        <div className="grid grid-cols-5">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => {
                setTab(t.id);
                // 탭을 옮기면 화면 맨 위부터. 안 그러면 이전 탭에서 내려둔 자리에 떨어진다
                window.scrollTo({ top: 0 });
              }}
              className={`py-3.5 text-[13px] font-semibold transition ${
                tab === t.id ? "text-brand" : "text-muted"
              }`}
            >
              {t.label}
              <span
                className={`mx-auto mt-1.5 block h-0.5 w-6 rounded-full transition ${
                  tab === t.id ? "bg-brand" : "bg-transparent"
                }`}
              />
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
