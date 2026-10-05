import { NextResponse } from "next/server";
import { paymentSchema } from "@/lib/validation/schemas";
import {
  getMonthByIdWithCommittee,
  getMembersForCommittee,
  addPayment,
} from "@/lib/db/queries";
import { adminGate } from "@/lib/auth/guard";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ monthId: string }> }
) {
  const { monthId } = await params;
  const found = await getMonthByIdWithCommittee(monthId);
  if (!found) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { committee } = found;

  const denied = await adminGate(committee);
  if (denied) return denied;

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
    id: input.id,
    monthId,
    memberId: input.memberId,
    amount: input.amount,
    mode: input.mode,
    note: input.note,
  });

  return NextResponse.json({ payment });
}
