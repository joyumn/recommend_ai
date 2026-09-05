"use client";

import Image from "next/image";
import { useState } from "react";
import type { NearbyPick } from "@/lib/schema";
import type { Remaining } from "@/lib/storage";
import { Badge, Button, Card, ErrorBox, Spinner } from "./ui";

type Picks = NearbyPick[];

export default function NearbyTab({ remaining }: { remaining: Remaining | null }) {
  const [picks, setPicks] = useState<Picks | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [keyword, setKeyword] = useState("");
  const [needKeyword, setNeedKeyword] = useState(false);
  // 사진 주소가 죽어 있으면 자리만 비게 둔다
  const [brokenPhoto, setBrokenPhoto] = useState<Record<number, boolean>>({});

  async function search(body: Record<string, unknown>) {
    setError("");
    setBusy(true);
    setPicks(null);
    setBrokenPhoto({});
    try {
      const res = await fetch("/api/nearby", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, remaining }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "식당을 찾지 못했습니다.");
      const list = (json.picks ?? []) as Picks;
      setPicks([...list].sort((a, b) => b.fitScore - a.fitScore));
    } catch (e) {
      setError(e instanceof Error ? e.message : "식당을 찾지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

  function useGps() {
    setError("");
    if (!navigator.geolocation) {
      setNeedKeyword(true);
      setError("이 브라우저는 위치 기능을 지원하지 않습니다. 동네 이름을 입력해주세요.");
      return;
    }
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => search({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {
        setBusy(false);
        setNeedKeyword(true);
        setError("위치를 가져오지 못했습니다. 아래에 동네 이름을 입력해주세요.");
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    );
  }

  return (
    <div className="space-y-4">
      <div className="px-1">
        <h1 className="text-[22px] font-bold leading-snug">
          뭘 먹을지 모르겠다면
          <br />
          근처에서 골라드립니다
        </h1>
        <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
          오늘 남은 예산에 맞는 곳부터 보여드립니다.
        </p>
      </div>

      <Button onClick={useGps} disabled={busy}>
        {busy ? "찾는 중..." : "내 위치로 근처 식당 찾기"}
      </Button>

      <button
        onClick={() => setNeedKeyword((v) => !v)}
        className="w-full text-center text-[13px] text-muted underline underline-offset-4"
      >
        위치 대신 동네 이름으로 찾기
      </button>

      {needKeyword && (
        <Card className="space-y-2.5">
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="예: 강남역, 홍대입구, 판교"
            className="w-full rounded-xl border border-line bg-card px-3.5 py-3 text-[15px] outline-none focus:border-brand"
          />
          <Button
            variant="ghost"
            disabled={busy || !keyword.trim()}
            onClick={() => search({ keyword })}
          >
            이 동네에서 찾기
          </Button>
        </Card>
      )}

      {busy && <Spinner label="근처 식당을 찾고 메뉴를 고르는 중입니다." />}
      {error && <ErrorBox message={error} />}

      {picks && picks.length === 0 && (
        <Card>
          <p className="text-[14px] text-muted">근처에서 식당을 찾지 못했습니다.</p>
        </Card>
      )}

      {picks && picks.length > 0 && (
        <div className="space-y-3">
          <div className="rounded-xl bg-warn-soft px-3.5 py-3 text-[12.5px] leading-relaxed text-warn">
            식당 이름과 거리는 실제 정보입니다. 메뉴는 상호와 업종으로 미루어 짐작한
            <b> 예상 메뉴</b>이며 실제 메뉴판과 다를 수 있습니다. 사진도 메뉴 이름으로 검색한
            <b> 참고 사진</b>이라 그 식당에서 찍은 사진이 아닙니다.
          </div>

          {picks.map((p, i) => (
            <Card key={i} className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <a
                    href={p.placeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[16px] font-bold underline decoration-line underline-offset-4"
                  >
                    {p.placeName}
                  </a>
                  <div className="truncate text-[12px] text-muted">
                    {p.categoryName} · {p.distanceM}m
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-[13px] font-bold text-brand">
                    {"●".repeat(Math.max(1, Math.min(5, Math.round(p.fitScore))))}
                  </div>
                  <div className="text-[10.5px] text-muted">예산 적합도</div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[15px] font-semibold">{p.menu}</span>
                <Badge>예상 메뉴</Badge>
              </div>

              {p.photo && !brokenPhoto[i] && (
                <a
                  href={p.photo.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block overflow-hidden rounded-xl border border-line"
                >
                  <div className="relative h-40 w-full bg-line/40">
                    <Image
                      src={p.photo.src}
                      alt={`${p.menu} 참고 사진`}
                      fill
                      sizes="(max-width: 520px) 100vw, 480px"
                      className="object-cover"
                      onError={() => setBrokenPhoto((b) => ({ ...b, [i]: true }))}
                    />
                  </div>
                  <div className="truncate bg-line/30 px-2.5 py-1.5 text-[11px] text-muted">
                    참고 사진 · 출처 {p.photo.sourceName}
                  </div>
                </a>
              )}

              <div className="space-y-1.5">
                <div className="flex gap-2.5 rounded-xl bg-brand-soft px-3 py-2.5">
                  <span className="shrink-0 text-[11px] font-bold text-brand">먹을 부분</span>
                  <span className="text-[13.5px] leading-relaxed text-ink">{p.eatPart}</span>
                </div>
                {p.avoidPart && p.avoidPart !== "없음" && (
                  <div className="flex gap-2.5 rounded-xl bg-line/50 px-3 py-2.5">
                    <span className="shrink-0 text-[11px] font-bold text-muted">남길 부분</span>
                    <span className="text-[13.5px] leading-relaxed text-muted line-through decoration-muted/40">
                      {p.avoidPart}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex items-baseline justify-between border-t border-line pt-2.5">
                <span className="text-[13px] font-semibold">{p.eatAmount}</span>
                <span className="text-[13px] tabular-nums text-brand">
                  약 {p.kcal}kcal · 단백질 {p.protein}g
                </span>
              </div>

              <p className="text-[13px] leading-relaxed text-muted">{p.reason}</p>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
