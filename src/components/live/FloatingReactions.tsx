"use client";

import { useEffect, useRef, useState } from "react";
import type { LiveReaction } from "@/lib/live/queries";

interface Floater {
  key: string;
  emoji: string;
  label: string;
  left: number;
  drift: number;
}

/** Emoji reactions from everyone in the room, rising up the screen. */
export default function FloatingReactions({
  reactions,
  nameOf,
  onNew,
}: {
  reactions: LiveReaction[];
  nameOf: (memberId: string | null) => string;
  onNew?: () => void;
}) {
  const seen = useRef<Set<string>>(new Set());
  const primed = useRef(false);
  const [floaters, setFloaters] = useState<Floater[]>([]);

  useEffect(() => {
    const fresh = reactions.filter((r) => !seen.current.has(r.id));
    fresh.forEach((r) => seen.current.add(r.id));
    // Don't replay the backlog that was already there when we joined.
    if (!primed.current) {
      primed.current = true;
      return;
    }
    if (fresh.length === 0) return;
    onNew?.();
    const added = fresh.map((r, i) => {
      const x = Math.sin(r.at + i) * 10000;
      const rand = x - Math.floor(x);
      return {
        key: r.id,
        emoji: r.emoji,
        label: nameOf(r.memberId).split(" ")[0],
        left: 8 + rand * 76,
        drift: (rand - 0.5) * 80,
      };
    });
    setFloaters((prev) => [...prev.slice(-30), ...added]);
    const keys = new Set(added.map((a) => a.key));
    const t = setTimeout(() => setFloaters((prev) => prev.filter((f) => !keys.has(f.key))), 3400);
    return () => clearTimeout(t);
  }, [reactions, nameOf, onNew]);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-40 h-0" aria-hidden>
      {floaters.map((f) => (
        <span
          key={f.key}
          className="animate-float-up absolute flex flex-col items-center"
          style={{ left: `${f.left}%`, "--drift": `${f.drift}px` } as React.CSSProperties}
        >
          <span className="text-4xl drop-shadow-lg">{f.emoji}</span>
          <span className="mt-0.5 rounded-full bg-black/50 px-1.5 text-[10px] font-semibold text-white">
            {f.label}
          </span>
        </span>
      ))}
    </div>
  );
}
