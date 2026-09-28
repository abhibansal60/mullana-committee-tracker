import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getGoogleAccount, googleEnabled } from "@/lib/auth/google";
import { anyPhoneLoginEnabled, findLoginsByGoogleSub, getCurrentPlayer } from "@/lib/live/queries";
import LoginForm, { type Choice } from "./LoginForm";
import LoginShell from "./LoginShell";

export const metadata: Metadata = { title: "Log in · Mullana Committee" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const next = params.next === "live" ? "live" : "home";
  if (await getCurrentPlayer()) redirect(next === "live" ? "/play/live" : "/play");

  const google = googleEnabled();

  let googleChoices: Choice[] | null = null;
  let error: string | null = null;
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
        phoneEnabled={await anyPhoneLoginEnabled()}
      />
    </LoginShell>
  );
}

const GOOGLE_ERRORS = {
  unknown:
    "This Google account hasn't joined a committee yet. Open the committee link your holder shared to pick your name.",
  failed: "Google sign-in didn't work. Please try again.",
};
