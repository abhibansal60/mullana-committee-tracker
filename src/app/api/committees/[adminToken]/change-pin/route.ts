import { NextResponse } from "next/server";
import { changePinSchema } from "@/lib/validation/schemas";
import { updateCommitteeSettings } from "@/lib/db/queries";
import { hashPin, verifyPin } from "@/lib/auth/pin";
import { adminCommittee } from "@/lib/auth/guard";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ adminToken: string }> }
) {
  const { adminToken } = await params;
  const committee = await adminCommittee(adminToken);
  if (committee instanceof NextResponse) return committee;

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
