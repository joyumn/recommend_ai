"use client";

import { useState } from "react";
import { CENTER_KINDS, type CenterKind } from "@/lib/center";
import { weeklyRoutine } from "@/lib/routine";
import type { CenterPick } from "@/lib/schema";
import type { AppState } from "@/lib/storage";
import { Badge, Button, Card, ErrorBox, Spinner } from "./ui";

type Picks = CenterPick[];
/** 갈래를 바꿨을 때 같은 자리에서 다시 찾으려고 마지막 검색 조건을 들고 있는다 */
type Where = { lat: number; lng: number } | { keyword: string };

/** 회비는 만 원 단위로 읽는 편이 빠르다. 78만을 780,000으로 보면 자릿수를 세게 된다 */
function won(n: number): string {
  if (n < 10000) return `${n.toLocaleString("ko-KR")}원`;
  const man = n / 10000;
  return `${Number.isInteger(man) ? man : man.toFixed(1)}만원`;
}

export default function CenterTab({ state }: { state: AppState }) {
  const [picks, setPicks] = useState<Picks | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [keyword, setKeyword] = useState("");
  const [needKeyword, setNeedKeyword] = useState(false);
  const [kind, setKind] = useState<CenterKind>("전체");
  const [where, setWhere] = useState<Where | null>(null);

  const routine = weeklyRoutine(state.profile, state.daily, state.plan);

  async function search(place: Where, pickedKind: CenterKind) {
    if (!routine) return;
    setError("");
    setNote("");
    setBusy(true);
    setPicks(null);
    setWhere(place);
    try {
      const res = await fetch("/api/center", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...place,
          kind: pickedKind,
          routine,
          weightKg: state.profile?.weightKg,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "운동센터를 찾지 못했습니다.");
      const list = (json.picks ?? []) as Picks;
      setPicks([...list].sort((a, b) => b.fitScore - a.fitScore));
      setNote(json.note ?? "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "운동센터를 찾지 못했습니다.");
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
      (pos) => search({ lat: pos.coords.latitude, lng: pos.coords.longitude }, kind),
      () => {
        setBusy(false);
        setNeedKeyword(true);
        setError("위치를 가져오지 못했습니다. 아래에 동네 이름을 입력해주세요.");
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    );
  }

  function pickKind(next: CenterKind) {
    setKind(next);
    // 이미 한 번 찾아봤다면 같은 자리에서 종류만 바꿔 다시 찾는다
    if (where && !busy) search(where, next);
  }

  // 비교표는 값이 싼 쪽부터. 카드는 적합도 순이라 두 줄 세우기가 서로 다르다
  const byPrice = picks ? [...picks].sort((a, b) => a.monthlyLow - b.monthlyLow) : [];

  return (
    <div className="space-y-4">
      <div className="px-1">
        <h1 className="text-[22px] font-bold leading-snug">
          주 몇 번, 어디서
          <br />
          움직일지 정해드립니다
        </h1>
        <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
          근처 운동센터를 찾아 한 달에 드는 돈까지 나란히 놓고 비교합니다.
        </p>
      </div>

      {routine ? (
        <Card className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[12px] font-semibold text-muted">권장 운동량</span>
            <Badge tone="brand">{routine.from === "plan" ? "내 계획 기준" : "프로필 기준"}</Badge>
          </div>
          <div className="text-[18px] font-bold tabular-nums">
            주 {routine.perWeek}회 · 회당 {routine.minutesPerSession}분
          </div>
          <div className="flex gap-1.5">
            <span className="rounded-lg bg-brand-soft px-2.5 py-1 text-[12px] font-semibold text-brand">
              유산소 주 {routine.cardioPerWeek}회
            </span>
            <span className="rounded-lg bg-brand-soft px-2.5 py-1 text-[12px] font-semibold text-brand">
              근력 주 {routine.strengthPerWeek}회
            </span>
          </div>
          <p className="text-[12.5px] leading-relaxed text-muted">{routine.why}</p>
        </Card>
      ) : (
        <Card>
          <p className="text-[14px] leading-relaxed text-muted">
            먼저 <b className="text-ink">내 계획</b> 탭에서 키·몸무게·목표를 채워주세요. 주 몇 회
            움직여야 하는지 정해져야 센터와 비용을 비교해드릴 수 있습니다.
          </p>
        </Card>
      )}

      <div>
        <div className="mb-1.5 px-1 text-[12px] font-semibold text-muted">찾는 종류</div>
        <div className="flex flex-wrap gap-1.5">
          {CENTER_KINDS.map((k) => (
            <button
              key={k}
              onClick={() => pickKind(k)}
              disabled={busy || !routine}
              className={`rounded-full border px-3.5 py-2 text-[13px] font-semibold transition disabled:opacity-50 ${
                kind === k ? "border-brand bg-brand text-white" : "border-line bg-card text-muted"
              }`}
            >
              {k}
            </button>
          ))}
        </div>
      </div>

      <Button onClick={useGps} disabled={busy || !routine}>
        {busy ? "찾는 중..." : "내 위치로 근처 운동센터 찾기"}
      </Button>

      {routine && (
        <button
          onClick={() => setNeedKeyword((v) => !v)}
          className="w-full text-center text-[13px] text-muted underline underline-offset-4"
        >
          위치 대신 동네 이름으로 찾기
        </button>
      )}

      {needKeyword && routine && (
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
            onClick={() => search({ keyword }, kind)}
          >
            이 동네에서 찾기
          </Button>
        </Card>
      )}

      {busy && <Spinner label="근처 운동센터를 찾고 비용을 견주는 중입니다." />}
      {error && <ErrorBox message={error} />}

      {picks && picks.length === 0 && (
        <Card>
          <p className="text-[14px] text-muted">{note || "근처에서 운동센터를 찾지 못했습니다."}</p>
        </Card>
      )}

      {picks && picks.length > 0 && routine && (
        <div className="space-y-3">
          {note && (
            <div className="rounded-xl bg-line/40 px-3.5 py-2.5 text-[12.5px] leading-relaxed text-muted">
              {note}
            </div>
          )}

          <div className="rounded-xl bg-warn-soft px-3.5 py-3 text-[12.5px] leading-relaxed text-warn">
            상호와 거리는 실제 정보입니다. 하지만 <b>가격은 공개된 곳이 없어</b> 동네 시세와 업종으로
            미루어 짐작한 <b>추정 금액</b>이며, 실제 회비와 다를 수 있습니다. 등록 전에 반드시 전화나
            방문으로 확인하세요.
          </div>

          {/* 요청의 핵심이 비교라, 카드보다 표를 먼저 놓는다 */}
          <Card className="space-y-2.5">
            <div className="flex items-baseline justify-between">
              <span className="text-[15px] font-bold">한 달 비용 비교</span>
              <span className="text-[11px] text-muted">주 {routine.perWeek}회 기준</span>
            </div>
            <div className="-mx-1 overflow-x-auto">
              <table className="w-full min-w-[300px] text-[12.5px]">
                <thead>
                  <tr className="border-b border-line text-left text-[11px] text-muted">
                    <th className="py-1.5 pl-1 font-semibold">상호</th>
                    <th className="py-1.5 font-semibold">종류</th>
                    <th className="py-1.5 text-right font-semibold">월 예상</th>
                    <th className="py-1.5 pr-1 text-right font-semibold">거리</th>
                  </tr>
                </thead>
                <tbody>
                  {byPrice.map((p, i) => (
                    <tr key={i} className="border-b border-line/60 last:border-0">
                      <td className="max-w-[110px] truncate py-2 pl-1 font-semibold">
                        {p.placeName}
                      </td>
                      <td className="py-2 text-muted">{p.kind}</td>
                      <td className="whitespace-nowrap py-2 text-right font-bold tabular-nums text-brand">
                        {won(p.monthlyLow)}~{won(p.monthlyHigh)}
                      </td>
                      <td className="whitespace-nowrap py-2 pr-1 text-right tabular-nums text-muted">
                        {p.distanceM > 0 ? `${p.distanceM}m` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[11px] leading-relaxed text-muted">
              회당 결제하는 곳은 주 {routine.perWeek}회로 한 달(약 4.3주) 다녔을 때로 계산했습니다.
            </p>
          </Card>

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
                    {p.categoryName}
                    {p.distanceM > 0 ? ` · ${p.distanceM}m` : ""}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-[13px] font-bold text-brand">
                    {"●".repeat(Math.max(1, Math.min(5, Math.round(p.fitScore))))}
                  </div>
                  <div className="text-[10.5px] text-muted">내 운동량 적합도</div>
                </div>
              </div>

              <div className="rounded-xl bg-brand-soft px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-brand">이렇게</span>
                  <span className="text-[13.5px] font-semibold text-ink">{p.exerciseName}</span>
                </div>
                <p className="mt-1 text-[13px] leading-relaxed text-ink">{p.program}</p>
                <div className="mt-1.5 text-[12px] tabular-nums text-brand">
                  주 {routine.perWeek}회 · 회당 {routine.minutesPerSession}분 · 약{" "}
                  {p.perSessionKcal}kcal 소모
                </div>
              </div>

              <div className="rounded-xl bg-line/40 px-3 py-2.5">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-[11px] font-bold text-muted">
                    한 달 비용
                    <Badge tone="warn">추정</Badge>
                  </span>
                  <span className="whitespace-nowrap text-[15px] font-bold tabular-nums">
                    {won(p.monthlyLow)}~{won(p.monthlyHigh)}
                  </span>
                </div>
                <p className="mt-1 text-[11.5px] leading-relaxed text-muted">
                  {p.payType === "회당"
                    ? `회당 ${won(p.priceLow)}~${won(p.priceHigh)} · `
                    : "월 정액 · "}
                  {p.priceBasis}
                </p>
              </div>

              <p className="text-[13px] leading-relaxed text-muted">{p.reason}</p>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
