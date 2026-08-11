"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatRupees } from "@/lib/money";
import PaymentForm from "./PaymentForm";
import type { MemberMonthView } from "@/lib/db/queries";

export default function PaymentsSection({
  monthId,
  members,
}: {
  monthId: string;
  members: MemberMonthView[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState<"cash" | "upi">("cash");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remaining = (m: MemberMonthView) => m.amountOwed - m.amountPaid;
  const selectableMembers = members.filter((m) => remaining(m) > 0);
  const allSelected =
    selectableMembers.length > 0 &&
    selectableMembers.every((m) => selected.has(m.memberId));

  function toggle(memberId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(memberId)) next.delete(memberId);
      else next.add(memberId);
      return next;
    });
  }

  function toggleAll() {
    setSelected(
      allSelected
        ? new Set()
        : new Set(selectableMembers.map((m) => m.memberId))
    );
  }

  const selectedMembers = members.filter((m) => selected.has(m.memberId));
  const selectedTotal = selectedMembers.reduce(
    (sum, m) => sum + remaining(m),
    0
  );

  async function markSelectedPaid() {
    setError(null);
    setSubmitting(true);
    try {
      const results = await Promise.all(
        selectedMembers.map((m) =>
          fetch(`/api/months/${monthId}/payments`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              memberId: m.memberId,
              amount: remaining(m),
              mode,
            }),
          })
        )
      );
      const failedCount = results.filter((r) => !r.ok).length;
      if (failedCount > 0) {
        setError(
          `${failedCount} of ${selectedMembers.length} payments failed to save — check below and retry.`
        );
      }
      setSelected(new Set());
      router.refresh();
    } catch {
      setError("Network error - please try again");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3 px-1">
        <label className="flex items-center gap-2 text-xs font-medium text-[var(--muted)]">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={toggleAll}
            disabled={selectableMembers.length === 0}
            className="h-4 w-4 accent-[var(--cloth)] disabled:opacity-40"
          />
          Select all unpaid ({selectableMembers.length})
        </label>
        {selected.size > 0 && (
          <span className="money text-xs text-[var(--muted)]">
            {selected.size} selected · {formatRupees(selectedTotal)}
          </span>
        )}
      </div>

      {selected.size > 0 && (
        <div className="card mb-3 flex flex-wrap items-center gap-2.5 p-3">
          <span className="text-sm font-medium">
            Mark {selected.size} as paid
          </span>
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as "cash" | "upi")}
            className="input w-24 py-1.5 text-xs"
          >
            <option value="cash">Cash</option>
            <option value="upi">UPI</option>
          </select>
          <button
            type="button"
            onClick={markSelectedPaid}
            disabled={submitting}
            className="btn-primary ml-auto px-3.5 py-1.5 text-xs"
          >
            {submitting ? "Saving…" : `Mark paid · ${formatRupees(selectedTotal)}`}
          </button>
        </div>
      )}
      {error && (
        <p className="mb-3 rounded-md border border-[var(--stamp)] bg-[var(--stamp-tint)] p-2.5 text-xs text-[var(--stamp)]">
          {error}
        </p>
      )}

      <div className="card divide-y divide-[var(--border-subtle)] px-4">
        {members.map((m) => (
          <PaymentForm
            key={m.memberId}
            monthId={monthId}
            member={m}
            selectable={remaining(m) > 0}
            selected={selected.has(m.memberId)}
            onToggleSelect={() => toggle(m.memberId)}
          />
        ))}
      </div>
    </div>
  );
}
