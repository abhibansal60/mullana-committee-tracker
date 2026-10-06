"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { formatRupees } from "@/lib/money";
import StatusBadge from "@/components/StatusBadge";
import { paymentIds } from "@/lib/payment-ids";
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
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const remaining = member.amountOwed - member.amountPaid;
  const ids = useRef(paymentIds()).current;

  async function addPayment(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/months/${monthId}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: ids.get(member.memberId, amount, mode), memberId: member.memberId, amount, mode }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to add payment");
        return;
      }
      ids.clear();
      setOpen(false);
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

  function openForm() {
    setAmount(Math.max(remaining, 0) || member.amountOwed);
    setError(null);
    setOpen(true);
  }

  return (
    <div className="py-2.5">
      <div className="flex min-h-11 items-center gap-3">
        {selectable && (
          <label className="-m-2 flex shrink-0 cursor-pointer p-2">
            <input
              type="checkbox"
              checked={selected}
              onChange={onToggleSelect}
              aria-label={`Select ${member.memberName} for bulk payment`}
              className="h-5 w-5 accent-[var(--cloth)]"
            />
          </label>
        )}
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-sm font-medium">
            <span className="truncate">{member.memberName}</span>
            {member.status === "partial" && <StatusBadge status="partial" />}
          </p>
          <p className="money mt-0.5 text-xs text-[var(--muted)]">
            {remaining > 0
              ? `owed ${formatRupees(member.amountOwed)} · paid ${formatRupees(member.amountPaid)}`
              : member.payments.map((p) => `${p.mode === "cash" ? "Cash" : "UPI"} ${formatRupees(p.amount)}`).join(" + ")}
          </p>
        </div>
        {remaining > 0 ? (
          !open && (
            <button type="button" onClick={openForm} className="btn-secondary money min-h-11 shrink-0 px-3 text-xs">
              Collect {formatRupees(remaining)}
            </button>
          )
        ) : (
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            aria-expanded={expanded}
            aria-label={`${member.memberName}: payment details`}
            className="-mr-2 flex min-h-11 shrink-0 items-center gap-1.5 px-2"
          >
            <StatusBadge status={member.status} />
            <span aria-hidden className={`text-[var(--muted)] transition-transform ${expanded ? "rotate-90" : ""}`}>›</span>
          </button>
        )}
      </div>

      {member.payments.length > 0 && (remaining > 0 || expanded) && (
        <ul className={`mt-1 ${selectable ? "pl-8" : ""}`}>
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
                className="-mr-2 min-h-9 px-2 font-sans font-medium text-[var(--muted)] hover:text-[var(--stamp)]"
              >
                {deletingId === p.id ? "Removing…" : "Remove"}
              </button>
            </li>
          ))}
        </ul>
      )}

      {open ? (
        <form onSubmit={addPayment} className={`mt-2 flex items-center gap-2 ${selectable ? "pl-8" : ""}`}>
          <input
            type="number"
            required
            min={1}
            aria-label={`Amount from ${member.memberName}`}
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            className="input money min-w-0 flex-1"
          />
          <select
            value={mode}
            aria-label="Payment mode"
            onChange={(e) => setMode(e.target.value as "cash" | "upi")}
            className="input w-[5.5rem]"
          >
            <option value="cash">Cash</option>
            <option value="upi">UPI</option>
          </select>
          <button type="submit" disabled={submitting} className="btn-primary min-h-11 shrink-0 px-3.5">
            {submitting ? "Adding…" : "Add"}
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Cancel"
            className="btn-secondary min-h-11 shrink-0 px-3"
          >
            ✕
          </button>
        </form>
      ) : (
        remaining <= 0 &&
        expanded && (
          <button
            type="button"
            onClick={openForm}
            className="-ml-2 min-h-9 px-2 text-xs font-medium text-[var(--muted)] hover:text-[var(--foreground)]"
          >
            + Add payment
          </button>
        )
      )}
      {error && (
        <p className="mt-1.5 text-xs text-[var(--stamp)]">{error}</p>
      )}
    </div>
  );
}
