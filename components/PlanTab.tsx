"use client";

import { useState } from "react";
import { todayDayName, todayInPlan, type ActivityGoal } from "@/lib/activity";
import type { Profile } from "@/lib/nutrition";
import { streakDays, type AppState } from "@/lib/storage";
import ActivityCard from "./ActivityCard";
import DailyQuote from "./DailyQuote";
import ProfileForm from "./ProfileForm";
import { Badge, Button, Card, ErrorBox, Spinner, Warn } from "./ui";

const GOAL_LABEL = { lose: "감량", gain: "증량", maintain: "유지" } as const;

function Stat({ label, value, unit }: { label: string; value: number; unit: string }) {
  return (
    <div className="flex-1">
      <div className="text-[11px] font-medium text-white/60">{label}</div>
      <div className="text-[19px] font-bold tabular-nums">
        {value.toLocaleString()}
        <span className="ml-0.5 text-[11px] font-semibold text-white/70">{unit}</span>
      </div>
    </div>
  );
}

/** 시작 체중에서 목표 체중까지, 지금 어디쯤인지 */
function WeightTrack({ from, to }: { from: number; to: number }) {
  const losing = from > to;
  return (
    <div className="mt-3">
      <div className="flex items-baseline justify-between text-[12px] text-white/70">
        <span>지금 {from}kg</span>
        <span className="font-semibold text-white">
          {Math.abs(from - to).toFixed(1)}kg {losing ? "감량" : "증량"}
        </span>
        <span>목표 {to}kg</span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/20">
        <div className="h-full w-full rounded-full bg-white/70" />
      </div>
    </div>
  );
}

export default function PlanTab({
  state,
  goal,
  busy,
  error,
  onSubmit,
  onReset,
}: {
  state: AppState;
  goal: ActivityGoal | null;
  busy: boolean;
  error: string;
  onSubmit: (p: Profile) => void;
  onReset: () => void;
}) {
  const { profile, daily, plan } = state;
  const [showWeek, setShowWeek] = useState(false);

  if (busy) return <Spinner label="계획을 세우는 중입니다. 10초쯤 걸립니다." />;

  const quote = (
    <DailyQuote
      state={state}
      context={{
        goal: daily ? `${GOAL_LABEL[daily.goal]} · 하루 ${daily.dailyKcal}kcal` : undefined,
        dayName: todayDayName(),
        focus: goal?.focus,
        minutesLeft: goal?.minutes,
        streakDays: streakDays(state),
      }}
    />
  );

  /* ---------- 아직 계획이 없을 때 ---------- */
  if (!daily || !plan) {
    return (
      <div className="space-y-5">
        {quote}

        <div className="px-1">
          <h1 className="text-[24px] font-bold leading-snug">
            먹지 말라고 하지 않습니다
            <br />
            <span className="text-brand">어디까지 먹을지</span> 알려드립니다
          </h1>
          <p className="mt-2 text-[13.5px] leading-relaxed text-muted">
            키와 목표만 알려주시면 나머지는 이 앱이 계산합니다.
            무리한 목표는 조용히 따라가지 않고 안전한 속도로 고쳐 드립니다.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {[
            { t: "계획", d: "하루 열량과\n7일 운동" },
            { t: "사진", d: "먹을 부분과\n남길 부분" },
            { t: "식당", d: "근처에서\n오늘 맞는 곳" },
          ].map((x) => (
            <div key={x.t} className="rounded-2xl border border-line bg-card px-3 py-3.5 text-center">
              <div className="text-[13px] font-bold text-brand">{x.t}</div>
              <div className="mt-1 whitespace-pre-line text-[11.5px] leading-relaxed text-muted">
                {x.d}
              </div>
            </div>
          ))}
        </div>

        {error && <ErrorBox message={error} />}
        <ProfileForm initial={profile} onSubmit={onSubmit} busy={busy} />
      </div>
    );
  }

  /* ---------- 계획이 있을 때 ---------- */
  const today = todayInPlan(plan);
  const streak = streakDays(state);

  return (
    <div className="space-y-4">
      {quote}
      {error && <ErrorBox message={error} />}

      <section className="rounded-2xl bg-gradient-to-br from-brand to-brand-deep p-5 text-white shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-[12px] font-semibold text-white/70">하루 목표</span>
          <div className="flex items-center gap-1.5">
            {streak > 1 && (
              <span className="rounded-md bg-white/15 px-1.5 py-0.5 text-[11px] font-semibold">
                {streak}일째
              </span>
            )}
            <span className="rounded-md bg-white/15 px-1.5 py-0.5 text-[11px] font-semibold">
              {GOAL_LABEL[daily.goal]}
            </span>
          </div>
        </div>

        <div className="mt-2.5 flex gap-2">
          <Stat label="섭취 열량" value={daily.dailyKcal} unit="kcal" />
          <Stat label="단백질" value={daily.proteinG} unit="g" />
          <Stat label="소비 열량" value={daily.tdee} unit="kcal" />
        </div>

        {profile && <WeightTrack from={profile.weightKg} to={profile.targetWeightKg} />}

        <p className="mt-3 border-t border-white/15 pt-2.5 text-[12.5px] leading-relaxed text-white/80">
          이 속도라면 목표까지 약 <b className="text-white">{daily.realisticWeeks}주</b>
          {daily.dailyDeficit > 0 && <> · 하루 {daily.dailyDeficit}kcal 적자</>}
        </p>
      </section>

      {daily.warnings.map((w, i) => (
        <Warn key={i}>⚠ {w}</Warn>
      ))}

      <ActivityCard state={state} goal={goal} />

      {today && (
        <Card className="space-y-2.5">
          <div className="flex items-baseline justify-between">
            <div className="flex items-baseline gap-2">
              <span className="text-[15px] font-bold">오늘 {today.day}</span>
              <span className="text-[13px] text-brand">{today.focus}</span>
            </div>
            <Badge tone="brand">{today.minutes}분</Badge>
          </div>
          {today.exercises.length === 0 ? (
            <p className="text-[13px] text-muted">완전히 쉬는 날입니다.</p>
          ) : (
            <ul className="space-y-2">
              {today.exercises.map((e, j) => (
                <li key={j} className="border-l-2 border-brand pl-3">
                  <div className="text-[14px] font-semibold">{e.name}</div>
                  <div className="text-[13px] text-muted">{e.detail}</div>
                  {e.note && <div className="mt-0.5 text-[12px] text-muted/80">{e.note}</div>}
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      <Card>
        <h2 className="mb-2 text-[15px] font-bold">전략</h2>
        <p className="text-[14px] leading-relaxed text-ink/85">{plan.summary}</p>
      </Card>

      <div>
        <button
          onClick={() => setShowWeek((v) => !v)}
          className="flex w-full items-center justify-between px-1 py-1.5 text-[15px] font-bold"
        >
          1주일 운동 계획
          <span className="text-[13px] font-semibold text-muted">{showWeek ? "접기" : "펼치기"}</span>
        </button>

        {showWeek && (
          <div className="mt-2 space-y-2.5">
            {plan.weeklyPlan.map((d, i) => (
              <Card key={i} className={d === today ? "border-brand" : undefined}>
                <div className="mb-2.5 flex items-baseline justify-between">
                  <div className="flex items-baseline gap-2">
                    <span className="text-[15px] font-bold">{d.day}</span>
                    <span className="text-[13px] text-brand">{d.focus}</span>
                  </div>
                  <span className="text-[12px] text-muted">{d.minutes}분</span>
                </div>
                {d.exercises.length === 0 ? (
                  <p className="text-[13px] text-muted">완전히 쉬는 날입니다.</p>
                ) : (
                  <ul className="space-y-2">
                    {d.exercises.map((e, j) => (
                      <li key={j} className="border-l-2 border-brand-soft pl-3">
                        <div className="text-[14px] font-semibold">{e.name}</div>
                        <div className="text-[13px] text-muted">{e.detail}</div>
                        {e.note && <div className="mt-0.5 text-[12px] text-muted/80">{e.note}</div>}
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>

      {plan.tips.length > 0 && (
        <Card>
          <h2 className="mb-2 text-[15px] font-bold">실천 팁</h2>
          <ul className="space-y-1.5">
            {plan.tips.map((t, i) => (
              <li key={i} className="flex gap-2 text-[13.5px] leading-relaxed text-ink/85">
                <span className="text-brand">·</span>
                {t}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Button variant="ghost" onClick={onReset}>
        목표 다시 설정하기
      </Button>
    </div>
  );
}
