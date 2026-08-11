"use client";

import { useState } from "react";
import Stamp from "@/components/Stamp";

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
      <main className="mx-auto w-full max-w-lg px-5 py-10 pb-16">
        <span className="eyebrow">Committee created</span>
        <h1 className="mt-1.5 font-[family-name:var(--font-display)] text-2xl font-semibold">
          Ledger opened
        </h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Save these links now &mdash; the admin link will not be shown
          again.
        </p>

        <div className="mt-6 card border-[var(--stamp)] p-4">
          <div className="mb-2 flex items-center gap-2">
            <Stamp tone="stamp">Admin only</Stamp>
          </div>
          <h2 className="text-sm font-medium">
            Grants full edit access &mdash; keep this to yourself
          </h2>
          <code className="money mt-2 block break-all rounded-md border border-[var(--border-subtle)] bg-[var(--background)] p-2.5 text-xs">
            {created.adminUrl}
          </code>
        </div>

        <div className="mt-4 card p-4">
          <div className="mb-2 flex items-center gap-2">
            <Stamp tone="cloth">Read-only</Stamp>
          </div>
          <h2 className="text-sm font-medium">Share this with all members</h2>
          <code className="money mt-2 block break-all rounded-md border border-[var(--border-subtle)] bg-[var(--background)] p-2.5 text-xs">
            {created.memberUrl}
          </code>
        </div>

        <a href={created.adminUrl} className="btn-primary mt-6 w-full">
          Go to admin dashboard
        </a>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-lg px-5 py-10 pb-16">
      <span className="eyebrow">New committee</span>
      <h1 className="mt-1.5 mb-6 font-[family-name:var(--font-display)] text-2xl font-semibold">
        Set up a committee
      </h1>

      <form onSubmit={handleSubmit} className="space-y-5">
        <section className="card space-y-4 p-4">
          <h2 className="eyebrow">Access</h2>
          <Field label="Setup passphrase">
            <input
              type="password"
              required
              value={setupPassphrase}
              onChange={(e) => setSetupPassphrase(e.target.value)}
              className="input"
            />
          </Field>
        </section>

        <section className="card space-y-4 p-4">
          <h2 className="eyebrow">Committee</h2>
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

          <div className="grid grid-cols-2 gap-3">
            <Field label="Monthly contribution (₹)">
              <input
                type="number"
                required
                min={1}
                value={monthlyContribution}
                onChange={(e) => setMonthlyContribution(Number(e.target.value))}
                className="input money"
              />
            </Field>
            <Field label="Duration (months)">
              <input
                type="number"
                required
                min={3}
                value={durationMonths}
                onChange={(e) => setDurationMonths(Number(e.target.value))}
                className="input money"
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Reserved month #">
              <input
                type="number"
                required
                min={1}
                max={durationMonths}
                value={reservedMonthNumber}
                onChange={(e) =>
                  setReservedMonthNumber(Number(e.target.value))
                }
                className="input money"
              />
            </Field>
            <Field label="Runner-up bonus (₹)">
              <input
                type="number"
                required
                min={0}
                value={runnerUpBonus}
                onChange={(e) => setRunnerUpBonus(Number(e.target.value))}
                className="input money"
              />
            </Field>
          </div>
          <p className="text-xs text-[var(--muted)]">
            The reserved month is the holder&rsquo;s free month &mdash; no
            auction runs, everyone pays the flat contribution.
          </p>
        </section>

        <section className="card space-y-4 p-4">
          <h2 className="eyebrow">Admin PIN</h2>
          <div className="grid grid-cols-2 gap-3">
            <Field label="PIN (4-6 digits)">
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
        </section>

        <section className="card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="eyebrow">Members ({members.length})</h2>
            <button
              type="button"
              onClick={addMember}
              className="text-sm font-medium text-[var(--cloth)] hover:text-[var(--cloth-strong)]"
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
                  className="h-4 w-4 accent-[var(--cloth)]"
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
                    className="px-1 text-[var(--muted)] hover:text-[var(--stamp)]"
                    aria-label={`Remove member ${i + 1}`}
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-[var(--muted)]">
            The marked member is the committee holder (organizer) &mdash;
            they get the reserved month and run the auctions.
          </p>
        </section>

        {error && (
          <p className="rounded-md border border-[var(--stamp)] bg-[var(--stamp-tint)] p-3 text-sm text-[var(--stamp)]">
            {error}
          </p>
        )}

        <button type="submit" disabled={submitting} className="btn-primary w-full">
          {submitting ? "Creating…" : "Create committee"}
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
      <span className="field-label">{label}</span>
      {children}
    </label>
  );
}
