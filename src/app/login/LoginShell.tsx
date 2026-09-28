import type { ReactNode } from "react";

/** The dark "stage" frame shared by /login and the join page. */
export default function LoginShell({
  children,
  title = "Join your committee",
  subtitle = "Bid live on committee day, see what you owe, track the whole year.",
}: {
  children: ReactNode;
  title?: string;
  subtitle?: string;
}) {
  return (
    <main className="arena-bg flex min-h-dvh flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <span className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--arena-raised)] text-3xl shadow-[0_0_40px_#f6c45333]">
            🪙
          </span>
          <p className="mt-5 text-xs font-semibold tracking-[0.18em] text-[var(--gold)] uppercase">Mullana Committee</p>
          <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl font-semibold">{title}</h1>
          <p className="mt-2 text-sm text-[var(--arena-muted)]">{subtitle}</p>
        </div>
        <div className="arena-card p-5">{children}</div>
        <p className="mt-6 text-center text-xs leading-relaxed text-[var(--arena-muted)]">
          New here? Open the committee link your holder shared.
          <br />
          Already joined? Just tap Continue with Google.
        </p>
      </div>
    </main>
  );
}
