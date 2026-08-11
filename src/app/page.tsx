export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center bg-spine px-6 py-24 text-center">
      <span className="font-mono text-xs font-semibold uppercase tracking-[0.08em] text-spine-muted">
        Kameti &middot; Committee &middot; Ledger
      </span>
      <h1 className="mt-3 font-[family-name:var(--font-display)] text-4xl font-semibold text-spine-foreground">
        Committee Tracker
      </h1>
      <p className="mt-4 max-w-xs text-sm leading-relaxed text-spine-muted">
        A running passbook for a monthly committee auction. You&rsquo;ll need
        the admin or read-only link shared with you for your committee &mdash;
        this page doesn&rsquo;t list any.
      </p>
    </main>
  );
}
