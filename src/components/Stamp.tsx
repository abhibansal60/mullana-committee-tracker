import type { ReactNode } from "react";

export type StampTone = "cloth" | "stamp" | "brass" | "carbon" | "muted";

const TONE_STYLES: Record<StampTone, string> = {
  cloth: "text-[var(--cloth)] border-[var(--cloth)] bg-[var(--cloth-tint)]",
  stamp: "text-[var(--stamp)] border-[var(--stamp)] bg-[var(--stamp-tint)]",
  brass: "text-[var(--brass)] border-[var(--brass)] bg-[var(--brass-tint)]",
  carbon: "text-[var(--carbon)] border-[var(--carbon)] bg-[var(--carbon-tint)]",
  muted: "text-[var(--muted)] border-[var(--border-strong)] bg-transparent",
};

/**
 * The signature element: a rubber ink-stamp mark standing in for every
 * status/role/confirmation in the app (paid, holder, won, reserved) instead
 * of a generic colored pill. The doubled outline (border + offset
 * box-shadow, both currentColor) reads as slightly off-register ink.
 */
export default function Stamp({
  tone = "muted",
  children,
}: {
  tone?: StampTone;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex -rotate-2 items-center whitespace-nowrap rounded-full border px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider ${TONE_STYLES[tone]}`}
      style={{ boxShadow: "1px 1px 0 0 currentColor" }}
    >
      {children}
    </span>
  );
}
