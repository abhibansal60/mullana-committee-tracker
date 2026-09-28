"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type Status = "lobby" | "live" | "paused" | "closed" | "finalized" | "cancelled" | null;

interface Peek {
  status: Status;
  monthNumber: number | null;
  here: number;
}

/** Lights up the home screen the moment the holder opens the auction room. */
export default function LiveBanner({ initial }: { initial: Peek }) {
  const [peek, setPeek] = useState<Peek>(initial);
  const prevStatus = useRef<Status>(initial.status);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    let cancelled = false;
    const loop = async () => {
      try {
        const res = await fetch("/api/play/state?peek=1", { cache: "no-store" });
        if (res.ok) {
          const s = await res.json();
          const next: Peek = {
            status: s.session?.status ?? null,
            monthNumber: s.session?.monthNumber ?? null,
            here: (s.players ?? []).filter((p: { online: boolean; isHolder: boolean }) => p.online && !p.isHolder).length,
          };
          if (!prevStatus.current && next.status && next.status !== "finalized") {
            try {
              navigator.vibrate?.([120, 60, 120]);
            } catch {
              // unsupported
            }
          }
          prevStatus.current = next.status;
          setPeek(next);
        }
      } catch {
        // try again next tick
      }
      if (!cancelled) timer = setTimeout(loop, document.hidden ? 15000 : 5000);
    };
    timer = setTimeout(loop, 3000);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  if (!peek.status || peek.status === "cancelled") return null;

  if (peek.status === "finalized") {
    return (
      <Link
        href="/play/live"
        className="arena-bg flex items-center justify-between gap-3 rounded-2xl px-5 py-4 shadow-lg"
      >
        <span>
          <span className="block text-xs font-semibold tracking-[0.18em] text-[var(--gold)] uppercase">
            Month {peek.monthNumber} result is in
          </span>
          <span className="mt-0.5 block text-base font-semibold">See who won & what you owe</span>
        </span>
        <span className="text-2xl">🏆</span>
      </Link>
    );
  }

  const live = peek.status === "live";
  return (
    <Link
      href="/play/live"
      className="arena-bg group relative block overflow-hidden rounded-2xl px-5 py-5 shadow-[0_10px_40px_-10px_#ff6b3d88]"
    >
      <span className="flex items-center gap-2">
        <span className="animate-live-pulse flex items-center gap-1.5 rounded-full bg-[var(--ember)] px-2 py-0.5 text-[11px] font-bold tracking-wider text-white">
          <span className="h-1.5 w-1.5 rounded-full bg-white" />
          {live ? "LIVE NOW" : peek.status === "lobby" ? "ROOM OPEN" : peek.status === "paused" ? "PAUSED" : "SOLD"}
        </span>
        <span className="text-xs text-[var(--arena-muted)]">{peek.here} in the room</span>
      </span>
      <span className="mt-3 block font-[family-name:var(--font-display)] text-2xl font-semibold">
        {live ? `Month ${peek.monthNumber} bidding is on!` : `Committee day — Month ${peek.monthNumber}`}
      </span>
      <span className="bid-button mt-4 block py-3 text-center text-base">Enter the auction room →</span>
    </Link>
  );
}
