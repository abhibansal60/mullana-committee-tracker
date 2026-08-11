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
      <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-4">
        <p className="text-sm text-neutral-600 mb-3">
          This is the holder&apos;s reserved month - no auction needed.
        </p>
        {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
        <button
          disabled={submitting}
          onClick={() => submit({ isReserved: true })}
          className="rounded-md bg-neutral-900 text-white px-4 py-2 text-sm disabled:opacity-50"
        >
          {submitting ? "Saving..." : "Confirm reserved month"}
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
      className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-4 space-y-3"
    >
      <h3 className="text-sm font-medium">Record auction result</h3>

      <label className="block">
        <span className="block text-xs font-medium mb-1">Winner</span>
        <select
          required
          value={winnerMemberId}
          onChange={(e) => setWinnerMemberId(e.target.value)}
          className="input"
        >
          <option value="">Select member</option>
          {eligibleMembers.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="block text-xs font-medium mb-1">Runner-up</span>
        <select
          required
          value={runnerUpMemberId}
          onChange={(e) => setRunnerUpMemberId(e.target.value)}
          className="input"
        >
          <option value="">Select member</option>
          {eligibleMembers.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="block text-xs font-medium mb-1">
          Winning bid (₹, multiple of 500)
        </span>
        <input
          type="number"
          required
          step={500}
          min={500}
          value={winningBid}
          onChange={(e) => setWinningBid(Number(e.target.value))}
          className="input"
        />
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="rounded-md bg-neutral-900 text-white px-4 py-2 text-sm disabled:opacity-50"
      >
        {submitting ? "Saving..." : "Save auction result"}
      </button>
    </form>
  );
}
