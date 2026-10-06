"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { formatRupees } from "@/lib/money";
import PaymentForm from "./PaymentForm";
import { paymentIds } from "@/lib/payment-ids";
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
  const ids = useRef(paymentIds()).current;

  const membersByName = [...members].sort((a, b) =>
    a.memberName.localeCompare(b.memberName)
  );

  const remaining = (m: MemberMonthView) => m.amountOwed - m.amountPaid;
  const selectableMembers = membersByName.filter((m) => remaining(m) > 0);
  const paidMembers = membersByName.filter((m) => remaining(m) <= 0);
  const totalOwed = members.reduce((sum, m) => sum + m.amountOwed, 0);
  const stillOut = selectableMembers.reduce((sum, m) => sum + remaining(m), 0);
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

  // Skips anyone already paid in full, e.g. saved by a request whose reply was lost before a retry.
  const selectedMembers = members.filter((m) => selected.has(m.memberId) && remaining(m) > 0);
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
              id: ids.get(m.memberId, remaining(m), mode),
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
      } else ids.clear();
      setSelected(new Set());
      router.refresh();
    } catch {
      // Some may have saved: show them. A retry reuses the same ids, so none is recorded twice.
      setError("Network error - please try again");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  const row = (m: MemberMonthView) => (
    <PaymentForm
      key={m.memberId}
      monthId={monthId}
      member={m}
      selectable={remaining(m) > 0}
      selected={selected.has(m.memberId)}
      onToggleSelect={() => toggle(m.memberId)}
    />
  );

  return (
    <div className={`space-y-5 ${selected.size > 0 ? "pb-20" : ""}`}>
      <div className="card p-4">
        <div className="flex items-baseline justify-between gap-3">
          <span className="eyebrow">Collected</span>
          <span className="money text-xs text-[var(--muted)]">
            {paidMembers.length} of {members.length} paid
          </span>
        </div>
        <p className="money mt-1 text-2xl font-medium">
          {formatRupees(totalOwed - stillOut)}
          <span className="text-base text-[var(--muted)]"> of {formatRupees(totalOwed)}</span>
        </p>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--border-subtle)]">
          <div
            className="h-full rounded-full bg-[var(--cloth)]"
            style={{ width: `${totalOwed ? ((totalOwed - stillOut) / totalOwed) * 100 : 0}%` }}
          />
        </div>
        {stillOut > 0 ? (
          <p className="money mt-2 text-sm text-[var(--stamp)]">{formatRupees(stillOut)} still to collect</p>
        ) : (
          <p className="mt-2 text-sm text-[var(--cloth)]">Fully collected ✓</p>
        )}
      </div>

      {error && (
        <p className="rounded-md border border-[var(--stamp)] bg-[var(--stamp-tint)] p-2.5 text-xs text-[var(--stamp)]">
          {error}
        </p>
      )}

      {selectableMembers.length > 0 && (
        <section>
          <div className="mb-1 flex items-center justify-between gap-3 px-1">
            <h2 className="eyebrow">To collect · {selectableMembers.length}</h2>
            <label className="flex min-h-11 cursor-pointer items-center gap-2 text-xs font-medium text-[var(--muted)]">
              Select all
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleAll}
                className="h-5 w-5 accent-[var(--cloth)]"
              />
            </label>
          </div>
          <div className="card divide-y divide-[var(--border-subtle)] px-4">{selectableMembers.map(row)}</div>
        </section>
      )}

      {paidMembers.length > 0 && (
        <section>
          <h2 className="eyebrow mb-2 px-1">Paid · {paidMembers.length}</h2>
          <div className="card divide-y divide-[var(--border-subtle)] px-4">{paidMembers.map(row)}</div>
        </section>
      )}

      {selected.size > 0 && (
        <div className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-30 border-t border-[var(--border-strong)] bg-[var(--surface)] px-4 py-3 shadow-[0_-8px_24px_-12px_#0004] sm:bottom-0">
          <div className="mx-auto flex max-w-lg items-center gap-2">
            <span className="money min-w-0 flex-1 text-sm font-medium">
              {selected.size} selected
              <span className="block text-xs text-[var(--muted)]">{formatRupees(selectedTotal)}</span>
            </span>
            <select
              value={mode}
              aria-label="Payment mode"
              onChange={(e) => setMode(e.target.value as "cash" | "upi")}
              className="input w-[5.5rem]"
            >
              <option value="cash">Cash</option>
              <option value="upi">UPI</option>
            </select>
            <button
              type="button"
              onClick={markSelectedPaid}
              disabled={submitting}
              className="btn-primary min-h-11"
            >
              {submitting ? "Saving…" : "Mark paid"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
