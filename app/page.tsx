"use client";

import { useEffect, useState } from "react";
import type { Profile } from "@/lib/nutrition";
import type { Meal } from "@/lib/schema";
import {
  addLog,
  loadState,
  remainingToday,
  saveState,
  type AppState,
} from "@/lib/storage";
import BudgetBar from "@/components/BudgetBar";
import PlanTab from "@/components/PlanTab";
import MealTab from "@/components/MealTab";
import NearbyTab from "@/components/NearbyTab";

type Tab = "plan" | "meal" | "nearby";

const TABS: { id: Tab; label: string }[] = [
  { id: "plan", label: "내 계획" },
  { id: "meal", label: "식사 사진" },
  { id: "nearby", label: "근처 식당" },
];

export default function Home() {
  const [tab, setTab] = useState<Tab>("plan");
  const [state, setState] = useState<AppState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // localStorage는 브라우저에만 있으므로 화면이 뜬 뒤에 읽는다
  useEffect(() => {
    setState(loadState());
  }, []);

  function update(next: AppState) {
    setState(next);
    saveState(next);
  }

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
      update({ ...(state ?? loadState()), profile, daily: json.daily, plan: json.plan });
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

  return (
    <div className="flex min-h-screen flex-col pb-24">
      <BudgetBar r={remaining} />

      <main className="flex-1 px-4 py-5">
        {tab === "plan" && (
          <PlanTab
            profile={state.profile}
            daily={state.daily}
            plan={state.plan}
            busy={busy}
            error={error}
            onSubmit={createPlan}
            onReset={() => update({ ...state, daily: null, plan: null })}
          />
        )}
        {tab === "meal" && (
          <MealTab
            remaining={remaining}
            onLog={(m: Meal) => update(addLog(state, m))}
          />
        )}
        {tab === "nearby" && <NearbyTab remaining={remaining} />}
      </main>

      <nav className="fixed bottom-0 left-1/2 z-20 w-full max-w-[480px] -translate-x-1/2 border-t border-line bg-card/95 backdrop-blur">
        <div className="grid grid-cols-3">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
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
