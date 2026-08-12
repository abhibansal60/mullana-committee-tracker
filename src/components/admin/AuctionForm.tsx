"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface EligibleMember {
  id: string;
  name: string;
}

export default function AuctionForm({
  monthId,
  isReservedMonth,
  eligibleMembers,
}: {
  monthId: string;
  isReservedMonth: boolean;
  eligibleMembers: EligibleMember[];
}) {
  const router = useRouter();
  const membersByName = [...eligibleMembers].sort((a, b) =>
    a.name.localeCompare(b.name)
  );
  const [winnerMemberId, setWinnerMemberId] = useState("");
  const [runnerUpMemberId, setRunnerUpMemberId] = useState("");
  const [winningBid, setWinningBid] = useState(15000);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(body: object) {
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/months/${monthId}/auction`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to save");
        return;
      }
      router.refresh();
    } catch {
      setError("Network error - please try again");
    } finally {
      setSubmitting(false);
    }
  }

  if (isReservedMonth) {
    return (
      <div className="card p-4">
        <p className="mb-3 text-sm text-[var(--muted)]">
          This is the holder&apos;s reserved month &mdash; no auction needed.
        </p>
        {error && (
          <p className="mb-3 rounded-md border border-[var(--stamp)] bg-[var(--stamp-tint)] p-2.5 text-sm text-[var(--stamp)]">
            {error}
          </p>
        )}
        <button
          disabled={submitting}
          onClick={() => submit({ isReserved: true })}
          className="btn-primary"
        >
          {submitting ? "Saving…" : "Confirm reserved month"}
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!winnerMemberId || !runnerUpMemberId) {
          setError("Select both a winner and a runner-up");
          return;
        }
        if (winnerMemberId === runnerUpMemberId) {
          setError("Winner and runner-up must be different members");
          return;
        }
        submit({
          isReserved: false,
          winnerMemberId,
          runnerUpMemberId,
          winningBid,
        });
      }}
      className="card space-y-3 p-4"
    >
      <h3 className="eyebrow">Record auction result</h3>

      <label className="block">
        <span className="field-label">Winner</span>
        <select
          required
          value={winnerMemberId}
          onChange={(e) => setWinnerMemberId(e.target.value)}
          className="input"
        >
          <option value="">Select member</option>
          {membersByName.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="field-label">Runner-up</span>
        <select
          required
          value={runnerUpMemberId}
          onChange={(e) => setRunnerUpMemberId(e.target.value)}
          className="input"
        >
          <option value="">Select member</option>
          {membersByName.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="field-label">Winning bid (₹, multiple of 500)</span>
        <input
          type="number"
          required
          step={500}
          min={500}
          value={winningBid}
          onChange={(e) => setWinningBid(Number(e.target.value))}
          className="input money"
        />
      </label>

      {error && (
        <p className="rounded-md border border-[var(--stamp)] bg-[var(--stamp-tint)] p-2.5 text-sm text-[var(--stamp)]">
          {error}
        </p>
      )}

      <button type="submit" disabled={submitting} className="btn-primary w-full">
        {submitting ? "Saving…" : "Save auction result"}
      </button>
    </form>
  );
}
