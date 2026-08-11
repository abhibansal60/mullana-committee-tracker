import { NextResponse } from "next/server";
import { getPaymentWithCommitteeId, deletePayment } from "@/lib/db/queries";
import { requireAdminForCommittee, UnauthorizedError } from "@/lib/auth/guard";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ paymentId: string }> }
) {
  const { paymentId } = await params;
  const found = await getPaymentWithCommitteeId(paymentId);
  if (!found) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    await requireAdminForCommittee(found.committeeId);
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw err;
  }

  await deletePayment(paymentId);
  return NextResponse.json({ ok: true });
}
