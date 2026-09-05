"use client";

import { useRef, useState } from "react";
import { dayTotals } from "@/lib/activity";
import { recentHistory } from "@/lib/history";
import { shrinkToBase64 } from "@/lib/image";
import type { Meal } from "@/lib/schema";
import {
  addManualLog,
  commitState,
  recentDays,
  removeLog,
  withActivity,
  SLOTS,
  type AppState,
  type DayRecord,
  type MealLog,
  type Slot,
} from "@/lib/storage";
import ExerciseLog from "./ExerciseLog";
import { Card } from "./ui";

/** 한 끼 적어 넣는 줄. 이름만 넣어도 되고, 사진을 올려 채울 수도 있다 */
function SlotRow({
  slot,
  logs,
  busy,
  onAdd,
  onPhoto,
  onRemove,
}: {
  slot: Slot;
  logs: MealLog[];
  busy: boolean;
  onAdd: (dishName: string, kcal?: number) => void;
  onPhoto: (file: File) => void;
  onRemove: (id: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [kcal, setKcal] = useState("");

  function submit() {
    if (!name.trim()) return;
    onAdd(name, kcal.trim() === "" ? undefined : Number(kcal));
    setName("");
    setKcal("");
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline gap-2">
        <span className="text-[13px] font-bold">{slot}</span>
        {logs.length === 0 && <span className="text-[11.5px] text-muted">비어 있음</span>}
      </div>

      {logs.map((l) => (
        <div
          key={l.id}
          className="flex items-center gap-2 rounded-xl bg-brand-soft px-3 py-2.5 text-[14px]"
        >
          <span className="min-w-0 flex-1 truncate">{l.dishName}</span>
          {l.source === "photo" && <span className="shrink-0 text-[11px] text-brand">사진</span>}
          {l.kcal > 0 && (
            <span className="shrink-0 tabular-nums text-[12.5px] text-muted">{l.kcal}kcal</span>
          )}
          <button
            onClick={() => onRemove(l.id)}
            aria-label={`${l.dishName} 지우기`}
            className="-mr-1 shrink-0 px-2 py-1 text-[14px] text-muted"
          >
            ✕
          </button>
        </div>
      ))}

      <div className="flex gap-1.5">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder={busy ? "사진을 읽는 중..." : "무엇을 드셨나요"}
          disabled={busy}
          className="min-w-0 flex-1 rounded-xl border border-line bg-card px-3 py-2.5 text-[14px] outline-none focus:border-brand disabled:opacity-60"
        />
        <input
          value={kcal}
          onChange={(e) => setKcal(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          type="number"
          inputMode="numeric"
          placeholder="kcal"
          className="w-[70px] shrink-0 rounded-xl border border-line bg-card px-2 py-2.5 text-[14px] outline-none focus:border-brand"
        />

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onPhoto(f);
            e.target.value = "";
          }}
        />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          aria-label={`${slot} 사진으로 채우기`}
          className="shrink-0 rounded-xl border border-line px-3 text-[15px] disabled:opacity-40"
        >
          {busy ? "…" : "📷"}
        </button>
        <button
          onClick={submit}
          disabled={!name.trim() || busy}
          className="shrink-0 rounded-xl bg-brand px-3.5 text-[14px] font-semibold text-white disabled:opacity-40"
        >
          담기
        </button>
      </div>
    </div>
  );
}

function ActivityRow({
  steps,
  exerciseMin,
  activeKcal,
  onSave,
}: {
  steps: number;
  exerciseMin: number;
  activeKcal: number;
  onSave: (patch: { steps?: number; exerciseMin?: number; activeKcal?: number }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ steps: "", exerciseMin: "", activeKcal: "" });

  const filled = steps > 0 || exerciseMin > 0 || activeKcal > 0;

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-between rounded-xl bg-line/30 px-3 py-2.5 text-[13px]"
      >
        <span className="text-muted">걸음 · 시간 직접 입력</span>
        <span className={filled ? "font-semibold" : "text-muted"}>
          {filled
            ? `${steps.toLocaleString()}걸음 · ${exerciseMin}분 · ${activeKcal}kcal`
            : "적어 넣기"}
        </span>
      </button>
    );
  }

  const num = (v: string) => (v.trim() === "" ? undefined : Math.max(0, Math.round(Number(v))));

  return (
    <div className="flex gap-1.5 rounded-xl bg-line/30 p-2">
      {(
        [
          ["steps", "걸음"],
          ["exerciseMin", "분"],
          ["activeKcal", "kcal"],
        ] as const
      ).map(([k, unit]) => (
        <input
          key={k}
          value={form[k]}
          onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))}
          type="number"
          inputMode="numeric"
          placeholder={unit}
          className="w-full min-w-0 rounded-lg border border-line bg-card px-2 py-2 text-[13px] outline-none focus:border-brand"
        />
      ))}
      <button
        onClick={() => {
          onSave({
            steps: num(form.steps),
            exerciseMin: num(form.exerciseMin),
            activeKcal: num(form.activeKcal),
          });
          setForm({ steps: "", exerciseMin: "", activeKcal: "" });
          setOpen(false);
        }}
        className="shrink-0 rounded-lg bg-brand px-3 text-[13px] font-semibold text-white"
      >
        저장
      </button>
    </div>
  );
}

/** 식사 사진 탭 위에 놓는 한 줄. 누르면 기록 화면으로 들어간다 */
export function RecentMealsTeaser({ state, onOpen }: { state: AppState; onOpen: () => void }) {
  const days = recentDays(state, 3);
  const written = days.reduce((a, d) => a + d.logs.length, 0);

  return (
    <button
      onClick={onOpen}
      className="flex w-full items-center justify-between rounded-2xl border border-line bg-card px-3.5 py-3 text-left"
    >
      <div className="min-w-0">
        <div className="text-[13px] font-semibold">지난 3일 먹은 것 · 운동량</div>
        <div className="mt-0.5 truncate text-[12.5px] text-muted">
          {written > 0
            ? `${written}끼 적힘 · 사진 분석에 함께 넘어갑니다`
            : "적어 두면 오늘 사진을 그 흐름 위에서 봅니다"}
        </div>
      </div>
      <span className="ml-3 shrink-0 text-[13px] font-semibold text-brand">기록하기 →</span>
    </button>
  );
}

/**
 * 지난 3일 식사와 운동량 - 한 화면 전체를 쓴다.
 *
 * 오늘 사진 한 장만 보면 "어제 이미 국물을 세 번 드셨다"는 사실을 알 수 없다.
 * 여기 적어 둔 사흘치가 사진 분석과 식당 추천에 함께 넘어간다.
 * 다 채울 필요는 없다. 빈칸은 비워둔 채로 넘어가고, 열량을 모르면 이름만 적어도 된다.
 */
export default function RecentMeals({ state }: { state: AppState }) {
  const [busySlot, setBusySlot] = useState("");
  const [error, setError] = useState("");
  const days = recentDays(state, 3);
  const written = days.reduce((a, d) => a + d.logs.length, 0);

  /**
   * 끼니 사진을 읽어 그 칸을 채운다.
   *
   * 식사 사진 탭은 "이 중 얼마나 먹을까"를 묻지만, 여기는 이미 먹은 것을 적는 자리다.
   * 그래서 권장량이 아니라 사진에 차려진 양(권장량 + 남기라고 한 양)을 기록한다.
   */
  async function analyze(file: File, day: DayRecord, slot: Slot) {
    setError("");
    setBusySlot(`${day.key}-${slot}`);
    try {
      const { base64 } = await shrinkToBase64(file);
      const res = await fetch("/api/meal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: base64,
          mediaType: "image/jpeg",
          history: recentHistory(state),
        }),
      });
      const meal = (await res.json()) as Meal & { error?: string };
      if (!res.ok) throw new Error(meal.error ?? "사진을 읽지 못했습니다.");
      if (!meal.items || meal.items.length === 0) {
        setError("음식을 알아보지 못했습니다. 이름을 직접 적어주세요.");
        return;
      }

      commitState(
        addManualLog(
          state,
          {
            dishName: meal.dishName,
            slot,
            // 차려진 그대로 먹었다고 본다. 단백질은 권장분만 세므로 조금 낮게 잡힐 수 있다
            kcal: meal.totalKcalIfFollowed + meal.totalSavedKcal,
            protein: meal.totalProteinIfFollowed,
            source: "photo",
          },
          day.date,
        ),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "사진을 읽지 못했습니다.");
    } finally {
      setBusySlot("");
    }
  }

  return (
    <div className="space-y-4">
      <div className="px-1">
        <h1 className="text-[22px] font-bold leading-snug">
          지난 3일 먹은 것과
          <br />
          움직인 양
        </h1>
        <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
          여기 적어 둔 사흘치가 사진 분석과 식당 추천에 함께 넘어갑니다.
          하루 다섯 끼까지, <b className="text-ink">기억나는 것만</b> 적으면 됩니다.
        </p>
      </div>

      {error && (
        <p className="rounded-xl bg-warn-soft px-3.5 py-3 text-[13px] leading-relaxed text-warn">
          {error}
        </p>
      )}

      {days.map((d) => {
        const totals = dayTotals(d.activity);
        return (
          <Card key={d.key} className="space-y-3">
            <div className="flex items-baseline justify-between border-b border-line pb-2.5">
              <span className="text-[17px] font-bold">{d.label}</span>
              <span className="text-[12px] text-muted">
                {d.logs.length > 0 ? `${d.logs.length}끼 적힘` : "아직 없음"}
                {totals.exerciseMin > 0 && ` · 운동 ${totals.exerciseMin}분`}
              </span>
            </div>

            <div className="space-y-2">
              <div className="text-[13px] font-bold text-muted">운동</div>
              <ExerciseLog state={state} date={d.date} sessions={d.activity.sessions ?? []} />
              <ActivityRow
                steps={totals.steps}
                exerciseMin={totals.exerciseMin}
                activeKcal={totals.activeKcal}
                onSave={(patch) =>
                  commitState(withActivity(state, { ...patch, source: "manual" }, d.date))
                }
              />
            </div>

            <div className="space-y-3 border-t border-line pt-3">
              <div className="text-[13px] font-bold text-muted">먹은 것</div>
              {SLOTS.map((slot) => (
                <SlotRow
                  key={slot}
                  slot={slot}
                  logs={d.logs.filter((l) => (l.slot ?? "점심") === slot)}
                  busy={busySlot === `${d.key}-${slot}`}
                  onAdd={(dishName, kcal) =>
                    commitState(addManualLog(state, { dishName, slot, kcal }, d.date))
                  }
                  onPhoto={(file) => analyze(file, d, slot)}
                  onRemove={(id) => commitState(removeLog(state, id))}
                />
              ))}
            </div>
          </Card>
        );
      })}

      <p className="px-1 text-[12px] leading-relaxed text-muted">
        빈칸은 그냥 두셔도 됩니다. 열량을 비워두면 이름만 기억해 두고, 그 끼니는 예산에서 빼고
        맥락으로만 씁니다. 📷 을 누르면 그 끼니 사진을 읽어 이름과 열량을 채웁니다
        {written > 0 && ` (지금까지 ${written}끼)`}.
      </p>
    </div>
  );
}
