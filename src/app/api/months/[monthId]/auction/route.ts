import { NextResponse } from "next/server";
import { auctionResultSchema } from "@/lib/validation/schemas";
import {
  getMonthByIdWithCommittee,
  getEligibleAuctionMembers,
  getMembersForCommittee,
  recordAuctionResult,
} from "@/lib/db/queries";
import { requireAdminForCommittee, UnauthorizedError } from "@/lib/auth/guard";
import { computeMonthDues } from "@/lib/calc/dues";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ monthId: string }> }
) {
  const { monthId } = await params;
  const found = await getMonthByIdWithCommittee(monthId);
  if (!found) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { month, committee } = found;

  try {
    await requireAdminForCommittee(committee.id);
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw err;
  }

  const body = await request.json().catch(() => null);
  const parsed = auctionResultSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", issues: parsed.error.issues },
      { status: 400 }
    );
  }
  const input = parsed.data;

  const isReservedMonth = month.monthNumber === committee.reservedMonthNumber;
  if (input.isReserved !== isReservedMonth) {
    return NextResponse.json(
      {
        error: isReservedMonth
          ? "This is the reserved month - no auction to record"
          : "This is not the reserved month - an auction result is required",
      },
      { status: 400 }
    );
  }

  const allMembers = await getMembersForCommittee(committee.id);
  const memberIds = allMembers.map((m) => m.id);
  const holder = allMembers.find((m) => m.isHolder);
  if (!holder) {
    return NextResponse.json(
      { error: "Committee has no holder configured" },
      { status: 500 }
    );
  }

  if (input.isReserved) {
    await recordAuctionResult(monthId, { isReserved: true });
    return NextResponse.json({ ok: true });
  }

  const eligible = await getEligibleAuctionMembers(committee.id, monthId);
  const eligibleIds = new Set(eligible.map((m) => m.id));
  if (!eligibleIds.has(input.winnerMemberId)) {
    return NextResponse.json(
      { error: "winnerMemberId is not eligible (already won, or is the holder)" },
      { status: 400 }
    );
  }
  if (!eligibleIds.has(input.runnerUpMemberId)) {
    return NextResponse.json(
      {
        error:
          "runnerUpMemberId is not eligible (already won, or is the holder)",
      },
      { status: 400 }
    );
  }
  if (input.winnerMemberId === input.runnerUpMemberId) {
    return NextResponse.json(
      { error: "Winner and runner-up must be different members" },
      { status: 400 }
    );
  }

  try {
    computeMonthDues(
      {
        memberCount: committee.memberCount,
        monthlyContribution: committee.monthlyContribution,
        runnerUpBonus: committee.runnerUpBonus,
      },
      memberIds,
      {
        isReserved: false,
        winnerMemberId: input.winnerMemberId,
        winningBid: input.winningBid,
        runnerUpMemberId: input.runnerUpMemberId,
      }
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Invalid auction result" },
      { status: 400 }
    );
  }

  await recordAuctionResult(monthId, {
    isReserved: false,
    winnerMemberId: input.winnerMemberId,
    winningBid: input.winningBid,
    runnerUpMemberId: input.runnerUpMemberId,
  });

  return NextResponse.json({ ok: true });
}
