"use client";

import { useRef, useState } from "react";
import type { ActivityGoal } from "@/lib/activity";
import type { Meal } from "@/lib/schema";
import type { AppState, Remaining } from "@/lib/storage";
import ActivityCard from "./ActivityCard";
import { Badge, Button, Card, ErrorBox, Spinner } from "./ui";

/** 폰 사진은 5MB가 넘는다. 긴 변 1024px로 줄여야 빠르고 저렴하다 */
async function shrinkToBase64(file: File): Promise<{ base64: string; dataUrl: string }> {
  const bitmap = await createImageBitmap(file);
  const max = 1024;
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("이미지를 처리하지 못했습니다.");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
  return { base64: dataUrl.split(",")[1], dataUrl };
}

const CONFIDENCE_LABEL = {
  high: "판독 양호",
  medium: "판독 보통",
  low: "판독 어려움",
} as const;

export default function MealTab({
  state,
  goal,
  remaining,
  onLog,
}: {
  state: AppState;
  goal: ActivityGoal | null;
  remaining: Remaining | null;
  onLog: (m: Meal) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string>("");
  const [meal, setMeal] = useState<Meal | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [logged, setLogged] = useState(false);

  async function handleFile(file: File) {
    setError("");
    setMeal(null);
    setLogged(false);
    setBusy(true);
    try {
      const { base64, dataUrl } = await shrinkToBase64(file);
      setPreview(dataUrl);
      const res = await fetch("/api/meal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: base64, mediaType: "image/jpeg", remaining }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "분석에 실패했습니다.");
      setMeal(json as Meal);
    } catch (e) {
      setError(e instanceof Error ? e.message : "분석에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* 무엇을 먹을지 고르기 전에, 오늘 얼마나 움직였는지부터 */}
      <ActivityCard state={state} goal={goal} variant="compact" />

      <div className="px-1">
        <h1 className="text-[22px] font-bold leading-snug">
          이 음식의 어떤 부분을
          <br />
          얼마나 먹어야 할까요?
        </h1>
        <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
          사진을 올리면 오늘 남은 예산에 맞춰 먹을 부분과 남길 부분을 알려드립니다.
        </p>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = "";
        }}
      />

      {preview && (
        <div className="overflow-hidden rounded-2xl border border-line">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="업로드한 식사 사진" className="w-full" />
        </div>
      )}

      <Button onClick={() => fileRef.current?.click()} disabled={busy}>
        {busy ? "분석 중..." : preview ? "다른 사진 올리기" : "식사 사진 올리기"}
      </Button>

      {busy && <Spinner label="음식을 살펴보는 중입니다. 5~10초쯤 걸립니다." />}
      {error && <ErrorBox message={error} />}

      {meal && meal.items.length === 0 && (
        <Card>
          <p className="text-[14px] leading-relaxed text-muted">
            음식을 알아보지 못했습니다. 음식이 화면에 크게 나오도록 위에서 다시 찍어주세요.
          </p>
        </Card>
      )}

      {meal && meal.items.length > 0 && (
        <div className="space-y-3">
          <Card className="space-y-3">
            <div className="flex items-start justify-between gap-2">
              <h2 className="text-[17px] font-bold leading-snug">{meal.dishName}</h2>
              <Badge tone={meal.confidence === "low" ? "warn" : "muted"}>
                {CONFIDENCE_LABEL[meal.confidence]}
              </Badge>
            </div>
            <div className="rounded-xl bg-brand-soft px-3.5 py-3">
              <div className="text-[11px] font-medium text-brand/70">권장대로 먹으면</div>
              <div className="text-[20px] font-bold tabular-nums text-brand">
                {meal.totalKcalIfFollowed}
                <span className="ml-0.5 text-[12px]">kcal</span>
                <span className="ml-2 text-[14px]">단백질 {meal.totalProteinIfFollowed}g</span>
              </div>
            </div>
            {meal.totalSavedKcal > 0 && (
              <p className="text-[13.5px] font-semibold text-brand">
                남기는 부분 덕분에 {meal.totalSavedKcal}kcal 아낍니다
              </p>
            )}
            <p className="text-[13.5px] leading-relaxed text-ink/85">{meal.advice}</p>
          </Card>

          {meal.items.map((it, i) => (
            <Card key={i} className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-[16px] font-bold">{it.name}</div>
                  <div className="text-[12px] text-muted">
                    {it.whereInPhoto} · 사진 속 양 {it.estimatedServing}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-[15px] font-bold tabular-nums text-brand">{it.kcal}kcal</div>
                  <div className="text-[11px] text-muted">단백질 {it.protein}g</div>
                </div>
              </div>

              {/* 이 앱의 핵심 - 먹을 부분과 남길 부분 */}
              <div className="space-y-1.5">
                <div className="flex gap-2.5 rounded-xl bg-brand-soft px-3 py-2.5">
                  <span className="shrink-0 text-[11px] font-bold text-brand">먹을 부분</span>
                  <span className="text-[13.5px] leading-relaxed text-ink">{it.eatPart}</span>
                </div>
                {it.avoidPart && it.avoidPart !== "없음" && (
                  <div className="flex gap-2.5 rounded-xl bg-line/50 px-3 py-2.5">
                    <span className="shrink-0 text-[11px] font-bold text-muted">남길 부분</span>
                    <span className="text-[13.5px] leading-relaxed text-muted line-through decoration-muted/40">
                      {it.avoidPart}
                    </span>
                  </div>
                )}
              </div>

              {it.howTo && <p className="text-[13px] leading-relaxed text-ink/70">{it.howTo}</p>}

              <div>
                <div className="mb-1.5 flex items-baseline justify-between">
                  <span className="text-[13px] font-semibold">{it.eatAmount}</span>
                  {it.savedKcal > 0 && (
                    <span className="text-[11px] text-muted">{it.savedKcal}kcal 절약</span>
                  )}
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-line">
                  <div
                    className="h-full rounded-full bg-brand"
                    style={{ width: `${Math.round(Math.min(1, Math.max(0, it.eatRatio)) * 100)}%` }}
                  />
                </div>
              </div>

              <p className="border-t border-line pt-2.5 text-[13px] leading-relaxed text-muted">
                {it.reason}
              </p>
            </Card>
          ))}

          <Button
            variant={logged ? "ghost" : "primary"}
            disabled={logged}
            onClick={() => {
              onLog(meal);
              setLogged(true);
            }}
          >
            {logged ? "오늘 기록에 담았습니다" : "이대로 먹은 것으로 기록"}
          </Button>

          <p className="px-1 text-center text-[11.5px] leading-relaxed text-muted">
            사진으로 계산한 값은 추정치입니다. 실제와 20~30% 차이날 수 있으며 의학적 조언이 아닙니다.
          </p>
        </div>
      )}
    </div>
  );
}
