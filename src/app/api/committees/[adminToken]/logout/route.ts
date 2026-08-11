import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCommitteeByAdminTokenHash } from "@/lib/db/queries";
import { sha256Hex } from "@/lib/auth/tokens";
import { sessionCookieName } from "@/lib/auth/session";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ adminToken: string }> }
) {
  const { adminToken } = await params;
  const committee = await getCommitteeByAdminTokenHash(sha256Hex(adminToken));
  if (committee) {
    const cookieStore = await cookies();
    cookieStore.delete(sessionCookieName("admin", committee.id));
  }
  return NextResponse.json({ ok: true });
}
