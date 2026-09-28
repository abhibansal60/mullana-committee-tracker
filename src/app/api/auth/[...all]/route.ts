import { getGoogleAuth } from "@/lib/auth/google";

/** Better Auth's endpoints (the Google OAuth callback). 404 while Google sign-in is off. */
function handler(request: Request) {
  const auth = getGoogleAuth();
  if (!auth) return new Response("Not found", { status: 404 });
  return auth.handler(request);
}

export { handler as GET, handler as POST };
