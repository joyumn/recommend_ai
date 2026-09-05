"use client";

import { useRef, useState } from "react";
import { activityProgress, activitySentence, dayTotals, type ActivityGoal } from "@/lib/activity";
import { parseHealthCsvDays } from "@/lib/healthImport";
import { commitState, dateKey, todayActivity, withActivity, type AppState } from "@/lib/storage";
import ExerciseLog from "./ExerciseLog";
import { Badge, Button, Card } from "./ui";

function Ring({ ratio }: { ratio: number }) {
  const r = 32;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative h-[76px] w-[76px] shrink-0">
      <svg viewBox="0 0 76 76" className="h-full w-full -rotate-90">
        <circle cx="38" cy="38" r={r} strokeWidth="7" className="fill-none stroke-line" />
        <circle
          cx="38"
          cy="38"
          r={r}
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - Math.min(1, Math.max(0, ratio)))}
          className="fill-none stroke-brand transition-all duration-500"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-[15px] font-bold tabular-nums text-brand">
        {Math.round(ratio * 100)}%
      </div>
    </div>
  );
}

function Line({
  label,
  done,
  goal,
  unit,
}: {
  label: string;
  done: number;
  goal: number;
  unit: string;
}) {
  if (goal <= 0) return null;
  return (
    <div className="flex items-baseline justify-between text-[13px]">
      <span className="text-muted">{label}</span>
      <span className="tabular-nums">
        <b className={done >= goal ? "text-brand" : "text-ink"}>{done.toLocaleString()}</b>
        <span className="text-muted">
          {" / "}
          {goal.toLocaleString()}
          {unit}
        </span>
      </span>
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  unit,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  unit: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[12px] font-medium text-muted">{label}</span>
      <div className="flex items-center rounded-xl border border-line bg-card px-3">
        <input
          type="number"
          inputMode="numeric"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="0"
          className="w-full bg-transparent py-2.5 text-[15px] font-semibold outline-none"
        />
        <span className="pl-1 text-[12px] text-muted">{unit}</span>
      </div>
    </label>
  );
}

const SOURCE_LABEL = {
  manual: "직접 입력",
  shortcut: "폰 건강 앱",
  file: "내려받은 파일",
} as const;

/**
 * 오늘 채워야 할 운동량.
 *
 * compact는 식사 사진 탭 맨 위에 놓는 한 줄짜리다. 무엇을 먹을지 고르기 전에
 * 오늘 얼마나 움직였는지부터 보이게 하려는 것이다.
 */
export default function ActivityCard({
  state,
  goal,
  variant = "full",
}: {
  state: AppState;
  goal: ActivityGoal | null;
  variant?: "full" | "compact";
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [form, setForm] = useState({ steps: "", exerciseMin: "", activeKcal: "" });

  if (!goal) return null;

  const activity = todayActivity(state);
  const done = { ...activity, ...dayTotals(activity) };
  const p = activityProgress(goal, activity);

  function save(
    patch: { steps?: number; exerciseMin?: number; activeKcal?: number },
    source: "manual" | "file",
  ) {
    commitState(withActivity(state, { ...patch, source }));
  }

  /**
   * 파일 하나에 보통 여러 날이 들어 있다. 오늘 한 줄만 쓰지 않고 들어 있는 날을 모두 채운다.
   * 이렇게 해야 지난 3일 기록도 파일 한 번으로 자동으로 메워진다.
   */
  async function handleFile(file: File) {
    setNote("");
    try {
      const days = parseHealthCsvDays(await file.text());
      if (days.length === 0) {
        setNote(
          "이 파일에서는 걸음이나 칼로리를 찾지 못했습니다. 삼성헬스나 Google Fit에서 내려받은 csv 파일인지 확인해주세요.",
        );
        return;
      }

      // 한 달이 넘은 기록까지 브라우저에 쌓을 필요는 없다
      const oldest = new Date();
      oldest.setDate(oldest.getDate() - 30);
      const oldestKey = dateKey(oldest);

      let next = state;
      const filled: string[] = [];

      for (const day of days) {
        if (day.dateKey && day.dateKey < oldestKey) continue;
        const when = day.dateKey ? new Date(`${day.dateKey}T12:00:00`) : new Date();
        next = withActivity(
          next,
          {
            steps: day.steps,
            activeKcal: day.activeKcal,
            exerciseMin: day.exerciseMin,
            source: "file",
          },
          when,
        );
        filled.push(day.dateKey ?? dateKey());
      }

      if (filled.length === 0) {
        setNote("최근 한 달 안의 기록이 파일에 없습니다.");
        return;
      }

      commitState(next);
      setNote(
        filled.length === 1
          ? `${filled[0]} 기록을 채웠습니다.`
          : `${filled[0]}부터 ${filled[filled.length - 1]}까지 ${filled.length}일치를 채웠습니다.`,
      );
    } catch {
      setNote("파일을 읽지 못했습니다.");
    }
  }

  if (variant === "compact") {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-line bg-card px-3.5 py-3">
        <Ring ratio={p.ratio} />
        <div className="min-w-0">
          <div className="text-[12px] font-semibold text-muted">먹기 전에, 오늘 운동량</div>
          <p className="mt-0.5 text-[13.5px] leading-relaxed">{activitySentence(p)}</p>
        </div>
      </div>
    );
  }

  return (
    <Card className="space-y-3.5">
      <div className="flex items-start justify-between">
        <div>
          <span className="text-[13px] font-semibold text-muted">오늘 채워야 할 운동량</span>
          {goal.focus && <div className="text-[15px] font-bold text-brand">{goal.focus}</div>}
        </div>
        {done.at && <Badge>{SOURCE_LABEL[done.source]}</Badge>}
      </div>

      <div className="flex items-center gap-4">
        <Ring ratio={p.ratio} />
        <div className="min-w-0 flex-1 space-y-1.5">
          <Line label="운동" done={done.exerciseMin} goal={goal.minutes} unit="분" />
          <Line label="걸음" done={done.steps} goal={goal.steps} unit="걸음" />
          <Line label="움직여 태울 열량" done={done.activeKcal} goal={goal.moveKcal} unit="kcal" />
        </div>
      </div>

      <p className="rounded-xl bg-brand-soft px-3.5 py-2.5 text-[13.5px] leading-relaxed text-ink">
        {activitySentence(p)}
      </p>

      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full text-center text-[13px] font-semibold text-muted underline underline-offset-4"
      >
        {open ? "닫기" : "오늘 활동 채우기 · 건강 앱 연동"}
      </button>

      {open && (
        <div className="space-y-4 border-t border-line pt-3.5">
          <div className="space-y-2">
            <div className="text-[13px] font-bold">운동 기록</div>
            <ExerciseLog state={state} date={new Date()} sessions={activity.sessions ?? []} />
          </div>

          <div className="space-y-2.5">
            <div className="text-[13px] font-bold">걸음·시간 직접 입력</div>
            <div className="grid grid-cols-3 gap-2">
              <NumberField
                label="걸음"
                value={form.steps}
                unit="걸음"
                onChange={(v) => setForm((f) => ({ ...f, steps: v }))}
              />
              <NumberField
                label="운동"
                value={form.exerciseMin}
                unit="분"
                onChange={(v) => setForm((f) => ({ ...f, exerciseMin: v }))}
              />
              <NumberField
                label="소모"
                value={form.activeKcal}
                unit="kcal"
                onChange={(v) => setForm((f) => ({ ...f, activeKcal: v }))}
              />
            </div>
            <Button
              variant="ghost"
              disabled={!form.steps && !form.exerciseMin && !form.activeKcal}
              onClick={() => {
                const num = (v: string) =>
                  v.trim() === "" ? undefined : Math.max(0, Math.round(Number(v)));
                save(
                  {
                    steps: num(form.steps),
                    exerciseMin: num(form.exerciseMin),
                    activeKcal: num(form.activeKcal),
                  },
                  "manual",
                );
                setForm({ steps: "", exerciseMin: "", activeKcal: "" });
                setNote("오늘 활동에 반영했습니다.");
              }}
            >
              오늘 활동에 반영
            </Button>
          </div>

          <div className="space-y-2">
            <div className="text-[13px] font-bold">안드로이드 · 삼성헬스 / Google Fit</div>
            <p className="text-[12.5px] leading-relaxed text-muted">
              삼성헬스는 <b>설정 → 개인 데이터 다운로드</b>, Google Fit은
              <b> Google 계정 → 데이터 내보내기</b>에서 받은 압축을 풀면 csv 파일이 나옵니다.
              걸음·칼로리가 담긴 파일을 고르면 그 안에 있는 날짜를 모두 찾아 하루씩 채웁니다
              (최근 한 달까지).
            </p>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
                e.target.value = "";
              }}
            />
            <Button variant="ghost" onClick={() => fileRef.current?.click()}>
              csv 파일에서 가져오기
            </Button>
          </div>

          <div className="space-y-2">
            <div className="text-[13px] font-bold">아이폰 · Apple 건강</div>
            <p className="text-[12.5px] leading-relaxed text-muted">
              웹은 건강 앱을 직접 읽지 못합니다. 대신 <b>단축어</b> 앱에서 아래대로 한 번 만들어 두면
              매일 아침 오늘 값이 이 앱으로 넘어옵니다.
            </p>
            <ol className="list-decimal space-y-1 pl-4 text-[12.5px] leading-relaxed text-muted">
              <li>
                단축어 → 새 단축어 → <b>건강 샘플 찾기</b>로 걸음 수 · 활동 에너지 · 운동 시간을 각각
                오늘 합계로 가져옵니다.
              </li>
              <li>
                <b>URL 열기</b> 동작을 넣고 주소를 이렇게 만듭니다.
              </li>
            </ol>
            <code className="block overflow-x-auto rounded-xl bg-line/40 px-3 py-2.5 text-[11.5px] leading-relaxed">
              {typeof window !== "undefined" ? window.location.origin : ""}
              /?steps=걸음&amp;kcal=활동에너지&amp;min=운동시간
            </code>
            <p className="text-[12.5px] leading-relaxed text-muted">
              단축어 앱의 <b>자동화</b>에서 매일 아침 시간으로 걸어두면 손댈 일이 없습니다.
              전날 값을 보내려면 <code>&amp;date=2026-09-04</code>처럼 날짜를 붙이면 그날 칸에 들어갑니다.
              주소로 받은 값은 저장한 즉시 주소창에서 지웁니다.
            </p>
          </div>

          {note && <p className="text-[12.5px] leading-relaxed text-brand">{note}</p>}

          <p className="text-[11.5px] leading-relaxed text-muted">
            받은 활동 기록은 이 브라우저에만 저장됩니다. 서버로 보내지 않습니다.
          </p>
        </div>
      )}
    </Card>
  );
}
