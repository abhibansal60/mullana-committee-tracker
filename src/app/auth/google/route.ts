import { NextResponse } from "next/server";
import { getGoogleAuth } from "@/lib/auth/google";

/**
 * Starts "Continue with Google". `?invite=<token>` links the Google account
 * to that invite's member; without it, it's a plain login.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const auth = getGoogleAuth();
  if (!auth) return NextResponse.redirect(new URL("/login", url));

  const done = new URLSearchParams();
  const invite = url.searchParams.get("invite");
  if (invite) done.set("invite", invite);
  if (url.searchParams.get("next") === "live") done.set("next", "live");

  const { headers, response } = await auth.api.signInSocial({
    body: {
      provider: "google",
      callbackURL: `/auth/google/done?${done}`,
      errorCallbackURL: "/login?google=failed",
    },
    headers: request.headers,
    returnHeaders: true,
  });
  if (!response.url) return NextResponse.redirect(new URL("/login?google=failed", url));

  const redirect = NextResponse.redirect(response.url);
  for (const cookie of headers.getSetCookie()) redirect.headers.append("Set-Cookie", cookie);
  return redirect;
}
