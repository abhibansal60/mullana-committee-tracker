"use client";

/** Practice-copy strip for the admin pages: always shows how to leave or reset. */
export default function PracticeBanner({ parentAdminToken }: { parentAdminToken: string | null }) {
  return (
    <div className="bg-[var(--practice-tint)] text-[var(--practice)]">
      <div className="mx-auto max-w-3xl px-5 py-2.5">
        <p className="text-center text-xs font-semibold">🧪 Practice copy · nothing here touches the real committee</p>
        {parentAdminToken && (
          <div className="mx-auto mt-2 grid max-w-sm grid-cols-2 gap-2">
            <a
              href={`/admin/${parentAdminToken}/practice?reset=1`}
              className="btn-secondary min-h-11 px-3 text-xs"
              onClick={(e) => {
                if (!window.confirm("Wipe the practice room (bids, results) and start fresh? You stay in practice.")) e.preventDefault();
              }}
            >
              ↺ Reset &amp; start fresh
            </a>
            <a href={`/admin/${parentAdminToken}`} className="btn-primary min-h-11 px-3 text-xs">
              ✕ Exit to real committee
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
