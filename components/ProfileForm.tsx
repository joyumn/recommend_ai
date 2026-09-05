"use client";

import { useState } from "react";
import { ACTIVITY_LABELS, type ActivityLevel, type Profile } from "@/lib/nutrition";
import { Button, Card } from "./ui";

function Field({
  label, value, onChange, unit, min, max,
}: {
  label: string; value: number; onChange: (n: number) => void;
  unit: string; min: number; max: number;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-medium text-muted">{label}</span>
      <div className="flex items-center rounded-xl border border-line bg-card px-3.5 focus-within:border-brand">
        <input
          type="number"
          inputMode="decimal"
          value={Number.isNaN(value) ? "" : value}
          min={min}
          max={max}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="w-full bg-transparent py-3 text-[16px] font-semibold outline-none"
        />
        <span className="pl-2 text-sm text-muted">{unit}</span>
      </div>
    </label>
  );
}

const DEFAULTS: Profile = {
  sex: "male",
  age: 30,
  heightCm: 175,
  weightKg: 80,
  targetWeightKg: 72,
  targetWeeks: 12,
  activity: "light",
};

export default function ProfileForm({
  initial,
  onSubmit,
  busy,
}: {
  initial: Profile | null;
  onSubmit: (p: Profile) => void;
  busy: boolean;
}) {
  const [p, setP] = useState<Profile>(initial ?? DEFAULTS);
  const set = <K extends keyof Profile>(k: K, v: Profile[K]) => setP((s) => ({ ...s, [k]: v }));

  const valid =
    p.age > 0 && p.heightCm > 0 && p.weightKg > 0 && p.targetWeightKg > 0 && p.targetWeeks > 0;

  return (
    <div className="space-y-4">
      <Card className="space-y-4">
        <div>
          <span className="mb-1.5 block text-[13px] font-medium text-muted">성별</span>
          <div className="grid grid-cols-2 gap-2">
            {(["male", "female"] as const).map((s) => (
              <button
                key={s}
                onClick={() => set("sex", s)}
                className={`rounded-xl border py-3 text-[15px] font-semibold transition ${
                  p.sex === s ? "border-brand bg-brand-soft text-brand" : "border-line bg-card text-muted"
                }`}
              >
                {s === "male" ? "남성" : "여성"}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="나이" value={p.age} onChange={(n) => set("age", n)} unit="세" min={10} max={100} />
          <Field label="키" value={p.heightCm} onChange={(n) => set("heightCm", n)} unit="cm" min={100} max={230} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="현재 체중" value={p.weightKg} onChange={(n) => set("weightKg", n)} unit="kg" min={30} max={250} />
          <Field label="목표 체중" value={p.targetWeightKg} onChange={(n) => set("targetWeightKg", n)} unit="kg" min={30} max={250} />
        </div>
        <Field label="목표 기간" value={p.targetWeeks} onChange={(n) => set("targetWeeks", n)} unit="주" min={1} max={104} />

        <div>
          <span className="mb-1.5 block text-[13px] font-medium text-muted">평소 활동량</span>
          <div className="space-y-2">
            {(Object.keys(ACTIVITY_LABELS) as ActivityLevel[]).map((a) => (
              <button
                key={a}
                onClick={() => set("activity", a)}
                className={`w-full rounded-xl border px-3.5 py-3 text-left text-[14px] font-medium transition ${
                  p.activity === a ? "border-brand bg-brand-soft text-brand" : "border-line bg-card text-muted"
                }`}
              >
                {ACTIVITY_LABELS[a]}
              </button>
            ))}
          </div>
        </div>
      </Card>

      <Button onClick={() => onSubmit(p)} disabled={!valid || busy}>
        {busy ? "계획을 세우는 중..." : "내 계획 만들기"}
      </Button>
    </div>
  );
}
