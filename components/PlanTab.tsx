"use client";

import type { DailyPlan, Profile } from "@/lib/nutrition";
import type { Plan } from "@/lib/schema";
import ProfileForm from "./ProfileForm";
import { Badge, Button, Card, ErrorBox, Spinner, Warn } from "./ui";

function Stat({ label, value, unit, big }: { label: string; value: number; unit: string; big?: boolean }) {
  return (
    <div className="flex-1 text-center">
      <div className="text-[11px] font-medium text-muted">{label}</div>
      <div className={`font-bold tabular-nums ${big ? "text-brand text-[26px]" : "text-[18px]"}`}>
        {value.toLocaleString()}
        <span className="ml-0.5 text-[12px] font-semibold text-muted">{unit}</span>
      </div>
    </div>
  );
}

export default function PlanTab({
  profile, daily, plan, busy, error, onSubmit, onReset,
}: {
  profile: Profile | null;
  daily: DailyPlan | null;
  plan: Plan | null;
  busy: boolean;
  error: string;
  onSubmit: (p: Profile) => void;
  onReset: () => void;
}) {
  if (busy) return <Spinner label="계획을 세우는 중입니다. 10초쯤 걸립니다." />;

  if (!daily || !plan) {
    return (
      <div className="space-y-4">
        <div className="px-1">
          <h1 className="text-[22px] font-bold leading-snug">
            지금 몸과 목표를 알려주시면
            <br />
            현실적인 계획을 세워드립니다
          </h1>
          <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
            무리한 목표는 자동으로 안전한 속도로 조정합니다.
          </p>
        </div>
        {error && <ErrorBox message={error} />}
        <ProfileForm initial={profile} onSubmit={onSubmit} busy={busy} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && <ErrorBox message={error} />}

      <Card className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-semibold text-muted">하루 목표</span>
          <Badge tone="brand">
            {daily.goal === "lose" ? "감량" : daily.goal === "gain" ? "증량" : "유지"}
          </Badge>
        </div>
        <div className="flex items-end gap-2">
          <Stat label="섭취 열량" value={daily.dailyKcal} unit="kcal" big />
          <Stat label="단백질" value={daily.proteinG} unit="g" />
          <Stat label="소비 열량" value={daily.tdee} unit="kcal" />
        </div>
        <p className="border-t border-line pt-3 text-[13px] leading-relaxed text-muted">
          현재 속도라면 목표까지 약 <b className="text-ink">{daily.realisticWeeks}주</b>
          {daily.dailyDeficit > 0 && <> · 하루 {daily.dailyDeficit}kcal 적자</>}
        </p>
      </Card>

      {daily.warnings.map((w, i) => (
        <Warn key={i}>⚠ {w}</Warn>
      ))}

      <Card>
        <h2 className="mb-2 text-[15px] font-bold">전략</h2>
        <p className="text-[14px] leading-relaxed text-ink/85">{plan.summary}</p>
      </Card>

      <div>
        <h2 className="mb-2 px-1 text-[15px] font-bold">1주일 운동 계획</h2>
        <div className="space-y-2.5">
          {plan.weeklyPlan.map((d, i) => (
            <Card key={i}>
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
