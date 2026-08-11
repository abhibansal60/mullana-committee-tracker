"use client";

import { useState } from "react";

interface MemberRow {
  name: string;
}

interface CreatedLinks {
  adminUrl: string;
  memberUrl: string;
}

export default function NewCommitteePage() {
  const [setupPassphrase, setSetupPassphrase] = useState("");
  const [name, setName] = useState("");
  const [monthlyContribution, setMonthlyContribution] = useState(20000);
  const [durationMonths, setDurationMonths] = useState(12);
  const [reservedMonthNumber, setReservedMonthNumber] = useState(2);
  const [runnerUpBonus, setRunnerUpBonus] = useState(1000);
  const [adminPin, setAdminPin] = useState("");
  const [adminPinConfirm, setAdminPinConfirm] = useState("");
  const [members, setMembers] = useState<MemberRow[]>(
    Array.from({ length: 12 }, () => ({ name: "" }))
  );
  const [holderIndex, setHolderIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<CreatedLinks | null>(null);

  function updateMemberName(index: number, value: string) {
    setMembers((prev) =>
      prev.map((m, i) => (i === index ? { name: value } : m))
    );
  }

  function addMember() {
    setMembers((prev) => [...prev, { name: "" }]);
  }

  function removeMember(index: number) {
    setMembers((prev) => prev.filter((_, i) => i !== index));
    setHolderIndex((prev) => {
      if (index === prev) return 0;
      if (index < prev) return prev - 1;
      return prev;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (adminPin !== adminPinConfirm) {
      setError("PIN and confirmation do not match");
      return;
    }
    const trimmedNames = members.map((m) => m.name.trim());
    if (trimmedNames.some((n) => n.length === 0)) {
      setError("All member names must be filled in");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/committees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          setupPassphrase,
          name,
          monthlyContribution,
          durationMonths,
          reservedMonthNumber,
          runnerUpBonus,
          adminPin,
          memberNames: trimmedNames,
          holderIndex,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong");
        return;
      }
      const origin = window.location.origin;
      setCreated({
        adminUrl: `${origin}/admin/${data.adminToken}`,
        memberUrl: `${origin}/c/${data.memberToken}`,
      });
    } catch {
      setError("Network error - please try again");
    } finally {
      setSubmitting(false);
    }
  }

  if (created) {
    return (
      <main className="mx-auto max-w-lg p-6">
        <h1 className="text-xl font-semibold mb-2">Committee created</h1>
        <p className="text-sm text-neutral-600 mb-6">
          Save these links now - the admin link will not be shown again.
        </p>

        <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 p-4">
          <h2 className="font-medium text-sm mb-1">
            Admin link (yours only - grants full edit access)
          </h2>
          <code className="block break-all text-xs bg-white rounded p-2 border">
            {created.adminUrl}
          </code>
        </div>

        <div className="mb-6 rounded-lg border border-neutral-300 bg-neutral-50 p-4">
          <h2 className="font-medium text-sm mb-1">
            Read-only link (share with all members)
          </h2>
          <code className="block break-all text-xs bg-white rounded p-2 border">
            {created.memberUrl}
          </code>
        </div>

        <a
          href={created.adminUrl}
          className="inline-block rounded-md bg-neutral-900 text-white px-4 py-2 text-sm"
        >
          Go to admin dashboard
        </a>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-lg p-6 pb-16">
      <h1 className="text-xl font-semibold mb-6">Set up a committee</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Field label="Setup passphrase">
          <input
            type="password"
            required
            value={setupPassphrase}
            onChange={(e) => setSetupPassphrase(e.target.value)}
            className="input"
          />
        </Field>

        <Field label="Committee name">
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input"
            placeholder="e.g. 2026 Friends Committee"
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Monthly contribution (₹)">
            <input
              type="number"
              required
              min={1}
              value={monthlyContribution}
              onChange={(e) => setMonthlyContribution(Number(e.target.value))}
              className="input"
            />
          </Field>
          <Field label="Duration (months)">
            <input
              type="number"
              required
              min={3}
              value={durationMonths}
              onChange={(e) => setDurationMonths(Number(e.target.value))}
              className="input"
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Reserved month # (holder's free month)">
            <input
              type="number"
              required
              min={1}
              max={durationMonths}
              value={reservedMonthNumber}
              onChange={(e) => setReservedMonthNumber(Number(e.target.value))}
              className="input"
            />
          </Field>
          <Field label="Runner-up bonus (₹)">
            <input
              type="number"
              required
              min={0}
              value={runnerUpBonus}
              onChange={(e) => setRunnerUpBonus(Number(e.target.value))}
              className="input"
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Admin PIN (4-6 digits)">
            <input
              type="password"
              inputMode="numeric"
              required
              pattern="\d{4,6}"
              value={adminPin}
              onChange={(e) => setAdminPin(e.target.value)}
              className="input"
            />
          </Field>
          <Field label="Confirm PIN">
            <input
              type="password"
              inputMode="numeric"
              required
              pattern="\d{4,6}"
              value={adminPinConfirm}
              onChange={(e) => setAdminPinConfirm(e.target.value)}
              className="input"
            />
          </Field>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">
              Members ({members.length})
            </span>
            <button
              type="button"
              onClick={addMember}
              className="text-sm text-blue-700"
            >
              + Add member
            </button>
          </div>
          <div className="space-y-2">
            {members.map((m, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="radio"
                  name="holder"
                  checked={holderIndex === i}
                  onChange={() => setHolderIndex(i)}
                  title="Mark as committee holder"
                />
                <input
                  type="text"
                  required
                  value={m.name}
                  onChange={(e) => updateMemberName(i, e.target.value)}
                  placeholder={`Member ${i + 1} name`}
                  className="input flex-1"
                />
                {members.length > 3 && (
                  <button
                    type="button"
                    onClick={() => removeMember(i)}
                    className="text-neutral-400 hover:text-red-600 text-sm"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>
          <p className="text-xs text-neutral-500 mt-2">
            The radio button marks the committee holder (organizer).
          </p>
        </div>

        {error && (
          <p className="text-sm text-red-600 rounded-md bg-red-50 p-2">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-md bg-neutral-900 text-white py-2 text-sm disabled:opacity-50"
        >
          {submitting ? "Creating..." : "Create committee"}
        </button>
      </form>
    </main>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-sm font-medium mb-1">{label}</span>
      {children}
    </label>
  );
}
