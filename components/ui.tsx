"use client";

import type { ReactNode } from "react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-line bg-card p-4 ${className}`}>{children}</div>
  );
}

export function Button({
  children,
  onClick,
  disabled,
  variant = "primary",
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "primary" | "ghost";
  type?: "button" | "submit";
}) {
  const base =
    "w-full rounded-xl px-4 py-3.5 text-[15px] font-semibold transition active:scale-[.99] disabled:opacity-50";
  const style =
    variant === "primary"
      ? "bg-brand text-white"
      : "border border-line bg-card text-ink";
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`${base} ${style}`}>
      {children}
    </button>
  );
}

export function Spinner({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center gap-2.5 py-8 text-sm text-muted">
      <span className="spinner" />
      {label}
    </div>
  );
}

export function ErrorBox({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm leading-relaxed text-red-700">
      {message}
    </div>
  );
}

export function Warn({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl bg-warn-soft px-3.5 py-3 text-[13px] leading-relaxed text-warn">
      {children}
    </div>
  );
}

/** 추정치임을 알리는 배지. 이 앱에서 자주 쓰인다 */
export function Badge({ children, tone = "muted" }: { children: ReactNode; tone?: "muted" | "brand" | "warn" }) {
  const tones = {
    muted: "bg-line/60 text-muted",
    brand: "bg-brand-soft text-brand",
    warn: "bg-warn-soft text-warn",
  };
  return (
    <span className={`inline-block rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${tones[tone]}`}>
      {children}
    </span>
  );
}
