import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { pinLoginSchema } from "@/lib/validation/schemas";
import { getCommitteeByAdminTokenHash, recordFailedPinAttempt, lockPin, resetPinAttempts } from "@/lib/db/queries";
import { sha256Hex } from "@/lib/auth/tokens";
import { verifyPin, shouldLock, computeLockoutExpiry, isLockedOut } from "@/lib/auth/pin";
import { signSession, sessionCookieName, SESSION_COOKIE_MAX_AGE } from "@/lib/auth/session";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ adminToken: string }> }
) {
  const { adminToken } = await params;
  const committee = await getCommitteeByAdminTokenHash(sha256Hex(adminToken));
  if (!committee) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (isLockedOut(committee.pinLockedUntil)) {
    return NextResponse.json(
      {
        error: "Too many failed attempts. Try again later.",
        lockedUntil: committee.pinLockedUntil,
      },
      { status: 429 }
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = pinLoginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid PIN" }, { status: 400 });
  }

  const valid = await verifyPin(parsed.data.pin, committee.adminPinHash);
  if (!valid) {
    const { failedAttempts } = await recordFailedPinAttempt(committee);
    if (shouldLock(failedAttempts)) {
      await lockPin(committee.id, computeLockoutExpiry());
      return NextResponse.json(
        { error: "Too many failed attempts. Try again in 15 minutes." },
        { status: 429 }
      );
    }
    return NextResponse.json({ error: "Incorrect PIN" }, { status: 401 });
  }

  await resetPinAttempts(committee.id);

  const token = await signSession({ sub: committee.id, role: "admin" });
  const cookieStore = await cookies();
  cookieStore.set(sessionCookieName("admin", committee.id), token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_COOKIE_MAX_AGE,
  });

  return NextResponse.json({ ok: true });
}
