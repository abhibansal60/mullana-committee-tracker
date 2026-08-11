import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createCommitteeSchema } from "@/lib/validation/schemas";
import { createCommittee } from "@/lib/db/queries";
import { generateToken, sha256Hex } from "@/lib/auth/tokens";
import { hashPin } from "@/lib/auth/pin";

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export async function POST(request: Request) {
  const expectedPassphrase = process.env.SETUP_PASSPHRASE;
  if (!expectedPassphrase) {
    return NextResponse.json(
      { error: "Server is not configured for committee creation" },
      { status: 500 }
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = createCommitteeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", issues: parsed.error.issues },
      { status: 400 }
    );
  }
  const input = parsed.data;

  if (!safeEqual(input.setupPassphrase, expectedPassphrase)) {
    return NextResponse.json({ error: "Incorrect passphrase" }, { status: 403 });
  }

  const adminToken = generateToken();
  const memberToken = generateToken();
  const adminPinHash = await hashPin(input.adminPin);

  const committee = await createCommittee({
    name: input.name,
    monthlyContribution: input.monthlyContribution,
    durationMonths: input.durationMonths,
    reservedMonthNumber: input.reservedMonthNumber,
    runnerUpBonus: input.runnerUpBonus,
    adminTokenHash: sha256Hex(adminToken),
    memberTokenHash: sha256Hex(memberToken),
    adminPinHash,
    memberNames: input.memberNames,
    holderIndex: input.holderIndex,
  });

  return NextResponse.json({
    committeeId: committee.id,
    adminToken,
    memberToken,
  });
}
