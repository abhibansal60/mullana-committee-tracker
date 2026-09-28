import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getGoogleAccount, googleEnabled } from "@/lib/auth/google";
import { findLoginToken, findLoginsByGoogleSub, getCurrentPlayer, isLiveSchemaMissing } from "@/lib/live/queries";
import LoginForm, { GoogleButton, type Choice } from "./LoginForm";

export const metadata: Metadata = { title: "Log in · Mullana Committee" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const next = params.next === "live" ? "live" : "home";
  if (await getCurrentPlayer()) redirect(next === "live" ? "/play/live" : "/play");

  const google = googleEnabled();
  const nextQuery = next === "live" ? "&next=live" : "";
  const invite = typeof params.invite === "string" && params.invite !== "expired" ? params.invite : null;

  // One-time step from the WhatsApp invite link: link a Google account to this member.
  if (google && invite) {
    const match = await findLoginToken(invite).catch((err) => {
      if (isLiveSchemaMissing(err)) return null;
      throw err;
    });
    if (!match) redirect("/login?invite=expired");
    return (
      <LoginShell>
        <div className="space-y-4 text-center">
          <p className="text-sm text-[var(--arena-muted)]">
            Hi <span className="font-semibold text-[var(--arena-text)]">{match.memberName}</span>! Link your Google
            account to join <span className="font-semibold text-[var(--arena-text)]">{match.committeeName}</span>.
          </p>
          <GoogleButton href={`/auth/google?invite=${encodeURIComponent(invite)}${nextQuery}`} />
          <p className="text-xs text-[var(--arena-muted)]">
            You only do this once. Next time, just tap Continue with Google.
          </p>
        </div>
      </LoginShell>
    );
  }

  let googleChoices: Choice[] | null = null;
  let error = params.invite === "expired" ? INVITE_EXPIRED : null;
  if (google && params.google === "choose") {
    const account = await getGoogleAccount(await headers());
    const matches = account ? await findLoginsByGoogleSub(account.sub) : [];
    if (matches.length > 0) {
      googleChoices = matches.map(({ memberId, memberName, committeeName }) => ({ memberId, memberName, committeeName }));
    } else {
      error = GOOGLE_ERRORS.failed;
    }
  } else if (typeof params.google === "string" && params.google in GOOGLE_ERRORS) {
    error = GOOGLE_ERRORS[params.google as keyof typeof GOOGLE_ERRORS];
  }

  return (
    <LoginShell>
      <LoginForm
        next={next}
        initialError={error}
        googleHref={google ? (next === "live" ? "/auth/google?next=live" : "/auth/google") : null}
        googleChoices={googleChoices}
      />
    </LoginShell>
  );
}

const INVITE_EXPIRED = "That invite link has been replaced. Log in with your number, or ask for a fresh link.";

const GOOGLE_ERRORS = {
  unknown:
    "This Google account isn't linked to a committee yet. Open the personal link your committee holder sent you on WhatsApp to link it.",
  taken: "That Google account is already linked to another member of this committee. Try a different Google account.",
  failed: "Google sign-in didn't work. Please try again.",
};

function LoginShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="arena-bg flex min-h-dvh flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <span className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--arena-raised)] text-3xl shadow-[0_0_40px_#f6c45333]">
            🪙
          </span>
          <p className="mt-5 text-xs font-semibold tracking-[0.2em] text-[var(--gold)] uppercase">Mullana Committee</p>
          <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl font-semibold">Join your committee</h1>
          <p className="mt-2 text-sm text-[var(--arena-muted)]">
            Bid live on committee day, see what you owe, track the whole year.
          </p>
        </div>
        <div className="arena-card p-5">{children}</div>
        <p className="mt-6 text-center text-xs leading-relaxed text-[var(--arena-muted)]">
          Got a personal link from your committee holder on WhatsApp? Just tap it — no typing needed.
          <br />
          Your number not working? Ask the holder to add it.
        </p>
      </div>
    </main>
  );
}
