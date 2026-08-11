export type PaymentStatus = "unpaid" | "partial" | "paid" | "overpaid";

export function getPaymentStatus(
  amountOwed: number,
  amountPaid: number
): PaymentStatus {
  if (amountPaid <= 0) return "unpaid";
  if (amountPaid < amountOwed) return "partial";
  if (amountPaid === amountOwed) return "paid";
  return "overpaid";
}
