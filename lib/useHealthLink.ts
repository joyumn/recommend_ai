"use client";

import { useEffect } from "react";
import { activityFromSearch } from "./healthImport";
import { commitState, withActivity, type AppState } from "./storage";

/**
 * 아이폰 단축어가 주소에 실어 보낸 오늘 활동을 받아 저장한다.
 * 예: https://내앱주소/?steps=8123&kcal=430&min=45
 *
 * 받은 즉시 주소를 지운다. 걸음 수 같은 건강 수치가 주소창과 방문 기록에 남지 않게 하려는 것이다.
 */
export function useHealthLink(state: AppState | null) {
  useEffect(() => {
    if (!state || typeof window === "undefined") return;

    const parsed = activityFromSearch(window.location.search);
    if (!parsed) return;

    // date=2026-09-04 처럼 날짜를 함께 보내면 그날 칸에 넣는다. 없으면 오늘
    const when = parsed.dateKey ? new Date(`${parsed.dateKey}T12:00:00`) : new Date();

    commitState(
      withActivity(
        state,
        {
          steps: parsed.steps,
          activeKcal: parsed.activeKcal,
          exerciseMin: parsed.exerciseMin,
          source: "shortcut",
        },
        when,
      ),
    );
    window.history.replaceState({}, "", window.location.pathname);
  }, [state]);
}
