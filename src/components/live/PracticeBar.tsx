"use client";

import type { LiveState } from "@/lib/live/queries";

/** Host-only strip in the practice room: bots on/off, reset, exit. */
export default function PracticeBar({
  state,
  bots,
  onBotsChange,
  parentAdminToken,
}: {
  state: LiveState;
  bots: boolean;
  onBotsChange: (on: boolean) => void;
  parentAdminToken: string | null;
}) {
  const botCount = state.players.filter((p) => p.bot && (p.eligible || !state.session)).length;
  return (
    <div className="arena-card mb-4 border-dashed border-[var(--practice-arena)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold tracking-[0.18em] text-[var(--practice-arena-text)] uppercase">🧪 Practice room</p>
          <p className="mt-1 text-sm text-[var(--arena-muted)]">
            A copy of your committee — bids and results here never touch the real one.
          </p>
        </div>
      </div>

      <label className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-[var(--arena)] px-3 py-3">
        <span className="text-sm">
          🤖 Bots bid for empty seats
          <span className="block text-xs text-[var(--arena-muted)]">
            {botCount} bot{botCount === 1 ? "" : "s"} can bid · anyone who logs in takes their seat back
          </span>
        </span>
        <input
          type="checkbox"
          checked={bots}
          onChange={(e) => onBotsChange(e.target.checked)}
          className="h-5 w-5 accent-[var(--practice-arena)]"
        />
      </label>

      <div className="mt-3 grid grid-cols-2 gap-2">
        {parentAdminToken ? (
          <>
            <a
              href={`/admin/${parentAdminToken}/practice?reset=1`}
              className="host-button"
              onClick={(e) => {
                if (!window.confirm("Wipe the practice room and start fresh?")) e.preventDefault();
              }}
            >
              ↺ Reset practice
            </a>
            <a href={`/admin/${parentAdminToken}`} className="host-button">
              Exit to real committee
            </a>
          </>
        ) : (
          <p className="col-span-2 text-xs text-[var(--arena-muted)]">
            Reset or exit from your real committee&apos;s dashboard (Practice room card).
          </p>
        )}
      </div>
      <p className="mt-3 text-xs text-[var(--arena-muted)]">
        Friends can join too: they log in with their number and pick the practice committee.
      </p>
    </div>
  );
}
