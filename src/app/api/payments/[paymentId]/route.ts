import { NextResponse } from "next/server";
import { getPaymentWithCommittee, deletePayment } from "@/lib/db/queries";
import { adminGate } from "@/lib/auth/guard";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ paymentId: string }> }
) {
  const { paymentId } = await params;
  const found = await getPaymentWithCommittee(paymentId);
  if (!found) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const denied = await adminGate(found.committee);
  if (denied) return denied;

  await deletePayment(paymentId);
  return NextResponse.json({ ok: true });
}
