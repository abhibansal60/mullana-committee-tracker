import { betterAuth } from "better-auth";

/**
 * "Continue with Google" for members. Better Auth only runs the OAuth round
 * trip; members stay logged in with the usual `player` cookie. It has no
 * database here (stateless mode: OAuth state and the Google account live in
 * short-lived signed cookies), so it adds no tables.
 *
 * Off unless GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are both set.
 */
export function googleEnabled(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

function createAuth() {
  return betterAuth({
    socialProviders: {
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        prompt: "select_account",
      },
    },
  });
}

let auth: ReturnType<typeof createAuth> | undefined;

export function getGoogleAuth() {
  if (!googleEnabled()) return null;
  return (auth ??= createAuth());
}

export interface GoogleAccount {
  sub: string; // Google's stable account id - the only thing we match on
  email: string | null;
}

/** The Google account that just came back from sign-in, or null if there isn't one (or it expired). */
export async function getGoogleAccount(headers: Headers): Promise<GoogleAccount | null> {
  const auth = getGoogleAuth();
  if (!auth) return null;
  try {
    const info = await auth.api.accountInfo({ headers, query: { useAccountCookie: true } });
    return { sub: info.account.accountId, email: info.user.email ?? null };
  } catch {
    return null;
  }
}

interface CookieJar {
  getAll(): { name: string }[];
  set(name: string, value: string, options: { path: string; maxAge: number; secure: boolean }): unknown;
}

/** Drops Better Auth's own cookies once the member has their `player` cookie. */
export function clearGoogleCookies(jar: CookieJar): void {
  for (const { name } of jar.getAll()) {
    if (name.startsWith("better-auth.") || name.startsWith("__Secure-better-auth.")) {
      jar.set(name, "", { path: "/", maxAge: 0, secure: name.startsWith("__Secure-") });
    }
  }
}
