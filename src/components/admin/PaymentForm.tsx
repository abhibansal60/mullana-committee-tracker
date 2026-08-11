"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatRupees } from "@/lib/money";
import StatusBadge from "@/components/StatusBadge";
import type { MemberMonthView } from "@/lib/db/queries";

export default function PaymentForm({
  monthId,
  member,
  selectable = false,
  selected = false,
  onToggleSelect,
}: {
  monthId: string;
  member: MemberMonthView;
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
}) {
  const router = useRouter();
  const [amount, setAmount] = useState(member.amountOwed - member.amountPaid);
  const [mode, setMode] = useState<"cash" | "upi">("cash");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function addPayment(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/months/${monthId}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId: member.memberId, amount, mode }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to add payment");
        return;
      }
      router.refresh();
    } catch {
      setError("Network error - please try again");
    } finally {
      setSubmitting(false);
    }
  }

  async function removePayment(paymentId: string) {
    setDeletingId(paymentId);
    try {
      await fetch(`/api/payments/${paymentId}`, { method: "DELETE" });
      router.refresh();
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="ledger-row py-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggleSelect}
            disabled={!selectable}
            aria-label={`Select ${member.memberName} for bulk payment`}
            className={`mt-0.5 h-4 w-4 shrink-0 accent-[var(--cloth)] ${
              selectable ? "" : "invisible"
            }`}
          />
          <div>
            <span className="text-sm font-medium">{member.memberName}</span>
            <p className="money mt-0.5 text-xs text-[var(--muted)]">
              owed {formatRupees(member.amountOwed)} · paid{" "}
              {formatRupees(member.amountPaid)}
            </p>
          </div>
        </div>
        <StatusBadge status={member.status} />
      </div>

      {member.payments.length > 0 && (
        <ul className="mt-2 space-y-1">
          {member.payments.map((p) => (
            <li
              key={p.id}
              className="money flex items-center justify-between text-xs text-[var(--muted)]"
            >
              <span>
                {p.mode === "cash" ? "Cash" : "UPI"} {formatRupees(p.amount)}
              </span>
              <button
                type="button"
                onClick={() => removePayment(p.id)}
                disabled={deletingId === p.id}
                className="font-sans font-medium text-[var(--muted)] hover:text-[var(--stamp)]"
              >
                {deletingId === p.id ? "Removing…" : "Remove"}
              </button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={addPayment} className="mt-2.5 flex items-center gap-2">
        <input
          type="number"
          required
          min={1}
          value={amount}
          onChange={(e) => setAmount(Number(e.target.value))}
          className="input money w-28"
        />
        <select
          value={mode}
          onChange={(e) => setMode(e.target.value as "cash" | "upi")}
          className="input w-24"
        >
          <option value="cash">Cash</option>
          <option value="upi">UPI</option>
        </select>
        <button
          type="submit"
          disabled={submitting}
          className="btn-primary shrink-0 px-3.5 py-2.5 text-xs"
        >
          {submitting ? "Adding…" : "Add"}
        </button>
      </form>
      {error && (
        <p className="mt-1.5 text-xs text-[var(--stamp)]">{error}</p>
      )}
    </div>
  );
}
