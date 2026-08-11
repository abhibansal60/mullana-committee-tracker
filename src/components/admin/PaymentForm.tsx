"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatRupees } from "@/lib/money";
import StatusBadge from "@/components/StatusBadge";
import type { MemberMonthView } from "@/lib/db/queries";

export default function PaymentForm({
  monthId,
  member,
}: {
  monthId: string;
  member: MemberMonthView;
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
    <div className="border-b border-neutral-100 dark:border-neutral-900 py-3">
      <div className="flex items-center justify-between mb-2">
        <div>
          <span className="text-sm font-medium">{member.memberName}</span>
          <span className="text-xs text-neutral-500 ml-2">
            owed {formatRupees(member.amountOwed)} · paid{" "}
            {formatRupees(member.amountPaid)}
          </span>
        </div>
        <StatusBadge status={member.status} />
      </div>

      {member.payments.length > 0 && (
        <ul className="mb-2 space-y-1">
          {member.payments.map((p) => (
            <li
              key={p.id}
              className="flex items-center justify-between text-xs text-neutral-600"
            >
              <span>
                {p.mode === "cash" ? "Cash" : "UPI"} {formatRupees(p.amount)}
              </span>
              <button
                type="button"
                onClick={() => removePayment(p.id)}
                disabled={deletingId === p.id}
                className="text-neutral-400 hover:text-red-600"
              >
                {deletingId === p.id ? "Removing..." : "Remove"}
              </button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={addPayment} className="flex items-center gap-2">
        <input
          type="number"
          required
          min={1}
          value={amount}
          onChange={(e) => setAmount(Number(e.target.value))}
          className="input w-28"
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
          className="rounded-md bg-neutral-900 text-white px-3 py-2 text-xs disabled:opacity-50"
        >
          {submitting ? "Adding..." : "Add"}
        </button>
      </form>
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}
