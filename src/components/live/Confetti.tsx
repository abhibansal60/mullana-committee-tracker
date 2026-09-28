"use client";

import { useMemo } from "react";

const COLORS = ["#f6c453", "#ff6b3d", "#7be3a1", "#4d9de0", "#e15a97", "#ffffff", "#c77dff"];

/** CSS-only confetti burst. Re-mount (change `key`) to fire again. */
export default function Confetti({ count = 90 }: { count?: number }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        // Deterministic pseudo-random so SSR/CSR and re-renders agree.
        const r = (n: number) => {
          const x = Math.sin(i * 9301 + n * 49297) * 233280;
          return x - Math.floor(x);
        };
        return {
          left: r(1) * 100,
          color: COLORS[i % COLORS.length],
          delay: r(2) * 0.8,
          dur: 2.4 + r(3) * 2,
          drift: (r(4) - 0.5) * 240,
          spin: 360 + r(5) * 1080,
          w: 6 + r(6) * 6,
          h: 8 + r(7) * 10,
          round: r(8) > 0.7,
        };
      }),
    [count]
  );

  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden motion-reduce:hidden" aria-hidden>
      {pieces.map((p, i) => (
        <span
          key={i}
          className="animate-confetti absolute top-0 block"
          style={
            {
              left: `${p.left}%`,
              width: p.w,
              height: p.round ? p.w : p.h,
              background: p.color,
              borderRadius: p.round ? "50%" : 2,
              "--delay": `${p.delay}s`,
              "--dur": `${p.dur}s`,
              "--drift": `${p.drift}px`,
              "--spin": `${p.spin}deg`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}
