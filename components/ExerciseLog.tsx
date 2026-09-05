"use client";

import { useState } from "react";
import type { ExerciseSession } from "@/lib/activity";
import { EXERCISES, EXERCISE_GROUPS, exerciseKcal, findExercise } from "@/lib/exercise";
import { commitState, withSession, withoutSession, type AppState } from "@/lib/storage";

/**
 * 종목과 시간으로 남기는 운동 기록.
 *
 * 걸음 수만으로는 수영이나 웨이트가 잡히지 않는다. 종목과 시간을 고르면
 * MET 공식으로 소모 열량을 계산해 그날 활동에 더한다(lib/exercise.ts).
 * 오늘 칸과 지난 3일 칸에서 같은 화면을 쓴다.
 */
export default function ExerciseLog({
  state,
  date,
  sessions,
}: {
  state: AppState;
  date: Date;
  sessions: ExerciseSession[];
}) {
  const [name, setName] = useState(EXERCISES[0].name);
  const [minutes, setMinutes] = useState("");

  const kind = findExercise(name);
  const min = Number(minutes);
  const valid = kind && Number.isFinite(min) && min > 0;
  const weightKg = state.profile?.weightKg;
  const preview = valid ? exerciseKcal(kind.met, min, weightKg) : 0;

  function add() {
    if (!valid || !kind) return;
    commitState(
      withSession(
        state,
        { name: kind.name, met: kind.met, minutes: Math.round(min), kcal: preview },
        date,
      ),
    );
    setMinutes("");
  }

  return (
    <div className="space-y-1.5">
      {sessions.length > 0 && (
        <ul className="space-y-1">
          {sessions.map((s) => (
            <li
              key={s.id}
              className="flex items-center gap-2 rounded-lg bg-brand-soft px-2.5 py-1.5 text-[13px]"
            >
              <span className="min-w-0 flex-1 truncate">{s.name}</span>
              <span className="shrink-0 tabular-nums text-[12px] text-muted">
                {s.minutes}분 · {s.kcal}kcal
              </span>
              <button
                onClick={() => commitState(withoutSession(state, s.id, date))}
                aria-label={`${s.name} 기록 지우기`}
                className="shrink-0 px-1 text-[13px] text-muted"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex gap-1.5">
        <select
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="min-w-0 flex-1 rounded-lg border border-line bg-card px-2 py-2 text-[13px] outline-none focus:border-brand"
        >
          {EXERCISE_GROUPS.map((group) => (
            <optgroup key={group} label={group}>
              {EXERCISES.filter((e) => e.group === group).map((e) => (
                <option key={e.name} value={e.name}>
                  {e.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>

        <input
          value={minutes}
          onChange={(e) => setMinutes(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          type="number"
          inputMode="numeric"
          placeholder="분"
          className="w-[58px] shrink-0 rounded-lg border border-line bg-card px-2 py-2 text-[13px] outline-none focus:border-brand"
        />

        <button
          onClick={add}
          disabled={!valid}
          className="shrink-0 rounded-lg bg-brand px-3 text-[13px] font-semibold text-white disabled:opacity-40"
        >
          담기
        </button>
      </div>

      <p className="text-[11.5px] leading-relaxed text-muted">
        {valid ? (
          <>
            <b className="text-brand">약 {preview}kcal</b> 소모로 계산됩니다
            {weightKg ? ` (체중 ${weightKg}kg 기준)` : " (체중을 넣으면 더 정확해집니다)"}.
          </>
        ) : (
          "종목과 시간을 넣으면 소모 열량을 계산해 그날 활동에 더합니다."
        )}
      </p>
    </div>
  );
}
