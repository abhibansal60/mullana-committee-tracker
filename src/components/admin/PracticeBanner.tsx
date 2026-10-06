"use client";

/** Practice-copy strip for the admin pages: always shows how to leave or reset. */
export default function PracticeBanner({ parentAdminToken }: { parentAdminToken: string | null }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 bg-[var(--practice-tint)] px-5 py-2.5 text-xs font-semibold text-[var(--practice)]">
      <span>🧪 Practice copy — nothing here affects the real committee</span>
      {parentAdminToken && (
        <span className="flex gap-2">
          <a
            href={`/admin/${parentAdminToken}/practice?reset=1`}
            className="btn-secondary px-3 py-1.5 text-xs"
            onClick={(e) => {
              if (!window.confirm("Wipe the practice room (bids, results) and start fresh? You stay in practice.")) e.preventDefault();
            }}
          >
            ↺ Reset &amp; start fresh
          </a>
          <a href={`/admin/${parentAdminToken}`} className="btn-primary px-3 py-1.5 text-xs">
            ✕ Exit practice → real committee
          </a>
        </span>
      )}
    </div>
  );
}
