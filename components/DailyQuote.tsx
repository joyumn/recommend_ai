"use client";

import { useEffect, useState } from "react";
import { builtinQuote, BUILTIN_COUNT } from "@/lib/quotes";
import { commitState, dateKey, stateSnapshot, type AppState } from "@/lib/storage";

/** 오늘 한 번만 받아온다. 개발 중 effect가 두 번 도는 경우까지 막는다 */
const asked = new Set<string>();

export interface QuoteContext {
  goal?: string;
  dayName?: string;
  focus?: string;
  minutesLeft?: number;
  kcalLeft?: number;
  streakDays?: number;
}

const WEEKDAY = ["일", "월", "화", "수", "목", "금", "토"];

function todayLabel(d = new Date()) {
  return `${d.getMonth() + 1}월 ${d.getDate()}일 ${WEEKDAY[d.getDay()]}요일`;
}

/**
 * 첫 화면 맨 위에 뜨는 오늘의 한마디.
 *
 * 문구를 받아오는 동안 빈 카드를 보여주지 않으려고, 앱에 내장된 문구를 먼저 띄우고
 * 오늘 상황에 맞춘 문구가 오면 조용히 바꿔 끼운다. API가 막힌 날은 내장 문구가 그대로 남는다.
 */
export default function DailyQuote({
  state,
  context,
}: {
  state: AppState;
  context: QuoteContext;
}) {
  const today = dateKey();
  const saved = state.quote?.date === today ? state.quote : null;
  // 사용자가 직접 넘긴 횟수. 넘기는 동안에는 내장 문구를 보여준다
  const [offset, setOffset] = useState(0);

  const quote =
    offset === 0 && saved
      ? { text: saved.text, author: saved.author }
      : builtinQuote(today, offset);

  useEffect(() => {
    if (saved || asked.has(today)) return;
    asked.add(today);

    (async () => {
      try {
        const res = await fetch("/api/quote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dateLabel: todayLabel(), ...context }),
        });
        if (!res.ok) return;
        const json = (await res.json()) as { text?: string };
        if (!json.text) return;
        commitState({
          ...stateSnapshot(),
          quote: { date: today, text: json.text, author: "몸친", from: "ai" },
        });
      } catch {
        // 내장 문구가 이미 떠 있으므로 조용히 넘어간다
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [today, saved]);

  return (
    <section className="relative overflow-hidden rounded-2xl bg-brand-soft px-5 py-4">
      <span
        aria-hidden
        className="pointer-events-none absolute -top-3 right-3 select-none text-[64px] font-bold leading-none text-brand/10"
      >
        &rdquo;
      </span>

      <div className="flex items-center justify-between">
        <span className="text-[11.5px] font-semibold tracking-wide text-brand/70">
          {todayLabel()} · 오늘의 한마디
        </span>
        <button
          onClick={() => setOffset((o) => (o + 1) % BUILTIN_COUNT)}
          aria-label="다른 문구 보기"
          className="-mr-1 rounded-lg px-2 py-1 text-[11.5px] font-semibold text-brand/70 transition active:scale-95 hover:text-brand"
        >
          다른 문구 ↻
        </button>
      </div>

      <p className="relative mt-2 text-[16px] font-bold leading-relaxed text-brand-deep">
        {quote.text}
      </p>
      <p className="mt-1.5 text-[11.5px] text-brand/60">— {quote.author}</p>
    </section>
  );
}
