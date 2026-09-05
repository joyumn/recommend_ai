"use client";

import type { Remaining } from "@/lib/storage";

function Bar({ label, eaten, target, unit }: { label: string; eaten: number; target: number; unit: string }) {
  const pct = target > 0 ? Math.min(100, Math.max(0, (eaten / target) * 100)) : 0;
  const left = target - eaten;
  const over = left < 0;
  return (
    <div className="flex-1">
      <div className="mb-1 flex items-baseline justify-between">
        <span className="text-[11px] font-medium text-muted">{label}</span>
        <span className={`text-[13px] font-bold tabular-nums ${over ? "text-red-600" : "text-ink"}`}>
          {over ? `${Math.abs(left)}${unit} 초과` : `${left}${unit} 남음`}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-line">
        <div
          className={`h-full rounded-full transition-all ${over ? "bg-red-500" : "bg-brand"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default function BudgetBar({ r }: { r: Remaining | null }) {
  if (!r) return null;
  return (
    <div className="sticky top-0 z-10 border-b border-line bg-card/95 px-4 py-3 backdrop-blur">
      <div className="flex gap-4">
        <Bar label="오늘 칼로리" eaten={r.kcalEaten} target={r.kcalTarget} unit="kcal" />
        <Bar label="오늘 단백질" eaten={r.proteinEaten} target={r.proteinTarget} unit="g" />
      </div>
    </div>
  );
}
