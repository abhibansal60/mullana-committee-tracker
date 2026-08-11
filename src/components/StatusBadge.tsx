import type { PaymentStatus } from "@/lib/calc/status";
import Stamp, { type StampTone } from "./Stamp";

const TONES: Record<PaymentStatus, StampTone> = {
  unpaid: "stamp",
  partial: "brass",
  paid: "cloth",
  overpaid: "carbon",
};

const LABELS: Record<PaymentStatus, string> = {
  unpaid: "Unpaid",
  partial: "Partial",
  paid: "Paid",
  overpaid: "Overpaid",
};

export default function StatusBadge({ status }: { status: PaymentStatus }) {
  return <Stamp tone={TONES[status]}>{LABELS[status]}</Stamp>;
}
