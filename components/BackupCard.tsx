"use client";

import { useState } from "react";
import { commitState, type AppState } from "@/lib/storage";
import { Button, Card } from "./ui";

/**
 * 기기 사이에 기록 옮기기.
 *
 * 기록은 기본적으로 이 브라우저 안에만 있다. 그래서 PC에서 적은 것이 폰에 없다.
 * 여기서 백업하면 코드가 하나 나오고, 다른 기기에서 그 코드를 넣으면 그대로 옮겨온다.
 * 로그인은 없다. 코드가 곧 열쇠라 아무에게나 알려주면 안 된다.
 */
export default function BackupCard({ state }: { state: AppState }) {
  const [busy, setBusy] = useState<"" | "save" | "load">("");
  const [code, setCode] = useState(state.backupCode ?? "");
  const [input, setInput] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);

  async function save() {
    setError("");
    setNote("");
    setBusy("save");
    try {
      const res = await fetch("/api/backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // 이미 쓰던 코드가 있으면 그 자리에 덮어쓴다. 코드가 계속 늘어나지 않게
        body: JSON.stringify({ code: code || undefined, state }),
      });
      const json = (await res.json()) as { code?: string; error?: string };
      if (!res.ok || !json.code) throw new Error(json.error ?? "백업하지 못했습니다.");

      setCode(json.code);
      commitState({ ...state, backupCode: json.code });
      setNote("백업했습니다. 다른 기기에서 아래 코드를 넣으면 그대로 옮겨옵니다.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "백업하지 못했습니다.");
    } finally {
      setBusy("");
    }
  }

  async function load() {
    setError("");
    setNote("");
    setBusy("load");
    try {
      const res = await fetch(`/api/backup?code=${encodeURIComponent(input)}`);
      const json = (await res.json()) as { state?: AppState; error?: string };
      if (!res.ok || !json.state) throw new Error(json.error ?? "불러오지 못했습니다.");

      commitState({ ...json.state, backupCode: input.trim().toUpperCase() });
      setCode(input.trim().toUpperCase());
      setInput("");
      setNote("불러왔습니다. 이 기기의 기록이 백업 내용으로 바뀌었습니다.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "불러오지 못했습니다.");
    } finally {
      setBusy("");
    }
  }

  return (
    <Card className="space-y-3">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-baseline justify-between"
      >
        <span className="text-[13px] font-semibold">
          기기 사이에 기록 옮기기
          {code && <span className="ml-1.5 font-normal text-muted">코드 있음</span>}
        </span>
        <span className="text-[12.5px] font-semibold text-brand">{open ? "접기" : "열기"}</span>
      </button>

      {!open && (
        <p className="text-[12.5px] leading-relaxed text-muted">
          기록은 이 브라우저 안에만 있습니다. 폰과 PC에서 같이 보려면 여기서 옮기세요.
        </p>
      )}

      {open && (
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="text-[13px] font-bold">이 기기 기록 백업하기</div>
            <Button onClick={save} disabled={busy !== ""}>
              {busy === "save" ? "백업하는 중..." : code ? "다시 백업하기" : "백업하고 코드 받기"}
            </Button>

            {code && (
              <div className="rounded-xl bg-brand-soft px-3.5 py-3 text-center">
                <div className="text-[11.5px] text-brand/70">내 백업 코드</div>
                <div className="mt-0.5 text-[20px] font-bold tracking-wider text-brand-deep">
                  {code}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-2 border-t border-line pt-3.5">
            <div className="text-[13px] font-bold">다른 기기에서 불러오기</div>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="K7M2-9QXP-4T8R"
              className="w-full rounded-xl border border-line bg-card px-3.5 py-3 text-center text-[16px] tracking-wider outline-none focus:border-brand"
            />
            <Button variant="ghost" onClick={load} disabled={busy !== "" || input.trim() === ""}>
              {busy === "load" ? "불러오는 중..." : "이 코드로 불러오기"}
            </Button>
            <p className="text-[11.5px] leading-relaxed text-muted">
              불러오면 이 기기에 있던 기록은 백업 내용으로 <b>덮어씌워집니다.</b>
            </p>
          </div>

          {note && <p className="text-[12.5px] leading-relaxed text-brand">{note}</p>}
          {error && (
            <p className="rounded-xl bg-warn-soft px-3 py-2.5 text-[12.5px] leading-relaxed text-warn">
              {error}
            </p>
          )}

          <p className="text-[11.5px] leading-relaxed text-muted">
            로그인이 없어서 <b>코드가 곧 열쇠</b>입니다. 코드를 아는 사람은 그 기록을 볼 수 있으니
            남에게 알려주지 마세요. 백업을 누르기 전까지는 어떤 기록도 서버로 가지 않습니다.
          </p>
        </div>
      )}
    </Card>
  );
}
