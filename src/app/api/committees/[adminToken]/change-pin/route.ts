import { NextResponse } from "next/server";
import { changePinSchema } from "@/lib/validation/schemas";
import { getCommitteeByAdminTokenHash, updateCommitteeSettings } from "@/lib/db/queries";
import { sha256Hex } from "@/lib/auth/tokens";
import { hashPin, verifyPin } from "@/lib/auth/pin";
import { requireAdminForCommittee, UnauthorizedError } from "@/lib/auth/guard";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ adminToken: string }> }
) {
  const { adminToken } = await params;
  const committee = await getCommitteeByAdminTokenHash(sha256Hex(adminToken));
  if (!committee) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    await requireAdminForCommittee(committee.id);
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw err;
  }

  const body = await request.json().catch(() => null);
  const parsed = changePinSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const valid = await verifyPin(parsed.data.currentPin, committee.adminPinHash);
  if (!valid) {
    return NextResponse.json({ error: "Current PIN is incorrect" }, { status: 401 });
  }

  const adminPinHash = await hashPin(parsed.data.newPin);
  await updateCommitteeSettings(committee.id, { adminPinHash });
  return NextResponse.json({ ok: true });
}
