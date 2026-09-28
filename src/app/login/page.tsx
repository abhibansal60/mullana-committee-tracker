import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentPlayer } from "@/lib/live/queries";
import LoginForm from "./LoginForm";

export const metadata: Metadata = { title: "Log in · Committee" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const next = params.next === "live" ? "live" : "home";
  if (await getCurrentPlayer()) redirect(next === "live" ? "/play/live" : "/play");

  return (
    <main className="arena-bg flex min-h-dvh flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <span className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--arena-raised)] text-3xl shadow-[0_0_40px_#f6c45333]">
            🪙
          </span>
          <p className="mt-5 text-xs font-semibold tracking-[0.2em] text-[var(--gold)] uppercase">Kameti · Committee</p>
          <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl font-semibold">Join your committee</h1>
          <p className="mt-2 text-sm text-[var(--arena-muted)]">
            Bid live on committee day, see what you owe, track the whole year.
          </p>
        </div>
        <div className="arena-card p-5">
          <LoginForm next={next} inviteExpired={params.invite === "expired"} />
        </div>
        <p className="mt-6 text-center text-xs leading-relaxed text-[var(--arena-muted)]">
          Got a personal link from your committee holder on WhatsApp? Just tap it — no typing needed.
          <br />
          Your number not working? Ask the holder to add it.
        </p>
      </div>
    </main>
  );
}
