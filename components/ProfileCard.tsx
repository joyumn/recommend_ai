"use client";

import { useState } from "react";
import { ACTIVITY_LABELS, dailyPlan, type Profile } from "@/lib/nutrition";
import { commitState, type AppState } from "@/lib/storage";
import ProfileForm from "./ProfileForm";
import { Card } from "./ui";

/**
 * 내 정보. 계획을 만든 뒤에도 늘 보이는 자리에서 키·체중·나이를 고칠 수 있게 한다.
 *
 * 값을 고치면 하루 목표 열량과 단백질은 그 자리에서 다시 계산한다(lib/nutrition은 순수 수식이라
 * AI를 부르지 않는다). 운동 계획만 모델이 쓴 것이라 그대로 두고, 다시 만들지는 사용자가 정한다.
 */
export default function ProfileCard({ state }: { state: AppState }) {
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);
  const { profile } = state;

  if (!profile) return null;

  function save(next: Profile) {
    commitState({ ...state, profile: next, daily: dailyPlan(next) });
    setEditing(false);
    setSaved(true);
  }

  if (editing) {
    return (
      <div className="space-y-3">
        <div className="flex items-baseline justify-between px-1">
          <h2 className="text-[15px] font-bold">내 정보 고치기</h2>
          <button
            onClick={() => setEditing(false)}
            className="text-[13px] font-semibold text-muted underline underline-offset-4"
          >
            취소
          </button>
        </div>
        <p className="px-1 text-[12.5px] leading-relaxed text-muted">
          저장하면 하루 목표 열량과 단백질이 바로 다시 계산됩니다. 운동 계획은 그대로 두니,
          새로 짜고 싶으면 아래 &ldquo;목표 다시 설정하기&rdquo;를 쓰세요.
        </p>
        <ProfileForm initial={profile} onSubmit={save} busy={false} submitLabel="저장하기" />
      </div>
    );
  }

  const rows: [string, string][] = [
    ["성별 · 나이", `${profile.sex === "male" ? "남성" : "여성"} · ${profile.age}세`],
    ["키", `${profile.heightCm}cm`],
    ["현재 체중", `${profile.weightKg}kg`],
    ["목표 체중", `${profile.targetWeightKg}kg`],
    ["목표 기간", `${profile.targetWeeks}주`],
    ["평소 활동량", ACTIVITY_LABELS[profile.activity]],
  ];

  return (
    <Card className="space-y-2.5">
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-semibold text-muted">내 정보</span>
        <button
          onClick={() => {
            setEditing(true);
            setSaved(false);
          }}
          className="text-[13px] font-semibold text-brand underline underline-offset-4"
        >
          고치기
        </button>
      </div>

      <dl className="space-y-1.5">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-baseline justify-between gap-3 text-[13px]">
            <dt className="shrink-0 text-muted">{k}</dt>
            <dd className="truncate text-right font-semibold">{v}</dd>
          </div>
        ))}
      </dl>

      {saved && (
        <p className="border-t border-line pt-2.5 text-[12.5px] leading-relaxed text-brand">
          저장했습니다. 하루 목표를 다시 계산했습니다.
        </p>
      )}
    </Card>
  );
}
