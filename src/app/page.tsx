import Link from "next/link";

export default function Home() {
  return (
    <main className="arena-bg flex flex-1 flex-col items-center justify-center px-6 py-24 text-center">
      <span className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--arena-raised)] text-3xl shadow-[0_0_40px_#f6c45333]">
        🪙
      </span>
      <p className="mt-5 text-xs font-semibold tracking-[0.18em] text-[var(--gold)] uppercase">Mullana Committee</p>
      <h1 className="mt-2 font-[family-name:var(--font-display)] text-4xl font-semibold">Committee Tracker</h1>
      <p className="mt-4 max-w-xs text-sm leading-relaxed text-[var(--arena-muted)]">
        Bid live on committee day, see what you owe, track the whole year. New here? Open the join link your committee
        holder shared.
      </p>
      <Link href="/login" className="host-button-primary mt-8 px-6">
        Member? Continue with Google
      </Link>
    </main>
  );
}
