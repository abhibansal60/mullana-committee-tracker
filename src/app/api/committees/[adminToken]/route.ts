import { NextResponse } from "next/server";
import { updateSettingsSchema } from "@/lib/validation/schemas";
import {
  hasAnyAuctionRecorded,
  updateCommitteeSettings,
} from "@/lib/db/queries";
import { adminCommittee } from "@/lib/auth/guard";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ adminToken: string }> }
) {
  const { adminToken } = await params;
  const committee = await adminCommittee(adminToken);
  if (committee instanceof NextResponse) return committee;

  const body = await request.json().catch(() => null);
  const parsed = updateSettingsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", issues: parsed.error.issues },
      { status: 400 }
    );
  }
  const updates = parsed.data;

  if (updates.runnerUpBonus !== undefined) {
    const contribution =
      updates.runnerUpBonus >= committee.monthlyContribution;
    if (contribution) {
      return NextResponse.json(
        { error: "runnerUpBonus must be less than monthlyContribution" },
        { status: 400 }
      );
    }
  }

  if (updates.reservedMonthNumber !== undefined) {
    if (updates.reservedMonthNumber > committee.durationMonths) {
      return NextResponse.json(
        { error: "reservedMonthNumber must be within durationMonths" },
        { status: 400 }
      );
    }
    if (await hasAnyAuctionRecorded(committee.id)) {
      return NextResponse.json(
        {
          error:
            "reservedMonthNumber can no longer be changed - an auction has already been recorded for this committee",
        },
        { status: 400 }
      );
    }
  }

  await updateCommitteeSettings(committee.id, updates);
  return NextResponse.json({ ok: true });
}
