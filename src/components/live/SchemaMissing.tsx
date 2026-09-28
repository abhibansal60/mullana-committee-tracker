import Link from "next/link";

/** Shown instead of the live features when the database hasn't been migrated yet. */
export default function SchemaMissing({ backHref }: { backHref: string }) {
  return (
    <main className="arena-bg flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <span className="text-5xl">🛠️</span>
      <h1 className="mt-4 font-[family-name:var(--font-display)] text-2xl font-semibold">One quick setup step</h1>
      <p className="mt-2 max-w-sm text-sm text-[var(--arena-muted)]">
        Live auctions need a one-time database update. Run <code className="money">npm run db:push</code> against the
        production database, then reload. Everything else in the app keeps working meanwhile.
      </p>
      <Link href={backHref} className="host-button mt-6">
        Back
      </Link>
    </main>
  );
}
