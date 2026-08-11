import { NextResponse } from "next/server";
import { paymentSchema } from "@/lib/validation/schemas";
import {
  getMonthByIdWithCommittee,
  getMembersForCommittee,
  addPayment,
} from "@/lib/db/queries";
import { requireAdminForCommittee, UnauthorizedError } from "@/lib/auth/guard";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ monthId: string }> }
) {
  const { monthId } = await params;
  const found = await getMonthByIdWithCommittee(monthId);
  if (!found) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { committee } = found;

  try {
    await requireAdminForCommittee(committee.id);
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw err;
  }

  const body = await request.json().catch(() => null);
  const parsed = paymentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", issues: parsed.error.issues },
      { status: 400 }
    );
  }
  const input = parsed.data;

  const members = await getMembersForCommittee(committee.id);
  if (!members.some((m) => m.id === input.memberId)) {
    return NextResponse.json(
      { error: "memberId does not belong to this committee" },
      { status: 400 }
    );
  }

  const payment = await addPayment({
    monthId,
    memberId: input.memberId,
    amount: input.amount,
    mode: input.mode,
    note: input.note,
  });

  return NextResponse.json({ payment });
}
