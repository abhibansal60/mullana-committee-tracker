"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Stamp from "@/components/Stamp";

export default function SettingsForm({
  adminToken,
  name: initialName,
  runnerUpBonus: initialRunnerUpBonus,
  reservedMonthNumber: initialReservedMonthNumber,
  durationMonths,
  reservedMonthLocked,
}: {
  adminToken: string;
  name: string;
  runnerUpBonus: number;
  reservedMonthNumber: number;
  durationMonths: number;
  reservedMonthLocked: boolean;
}) {
  const router = useRouter();

  const [name, setName] = useState(initialName);
  const [runnerUpBonus, setRunnerUpBonus] = useState(initialRunnerUpBonus);
  const [reservedMonthNumber, setReservedMonthNumber] = useState(
    initialReservedMonthNumber
  );
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [generalSaved, setGeneralSaved] = useState(false);

  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [pinError, setPinError] = useState<string | null>(null);
  const [pinSaved, setPinSaved] = useState(false);

  const [newMemberLink, setNewMemberLink] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState(false);

  async function saveGeneral(e: React.FormEvent) {
    e.preventDefault();
    setGeneralError(null);
    setGeneralSaved(false);
    const res = await fetch(`/api/committees/${adminToken}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, runnerUpBonus, reservedMonthNumber }),
    });
    const data = await res.json();
    if (!res.ok) {
      setGeneralError(data.error ?? "Failed to save");
      return;
    }
    setGeneralSaved(true);
    router.refresh();
  }

  async function changePin(e: React.FormEvent) {
    e.preventDefault();
    setPinError(null);
    setPinSaved(false);
    const res = await fetch(`/api/committees/${adminToken}/change-pin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPin, newPin }),
    });
    const data = await res.json();
    if (!res.ok) {
      setPinError(data.error ?? "Failed to change PIN");
      return;
    }
    setPinSaved(true);
    setCurrentPin("");
    setNewPin("");
  }

  async function regenerateMemberLink() {
    setRegenerating(true);
    try {
      const res = await fetch(
        `/api/committees/${adminToken}/regenerate-member-token`,
        { method: "POST" }
      );
      const data = await res.json();
      if (res.ok) {
        setNewMemberLink(`${window.location.origin}/c/${data.memberToken}`);
      }
    } finally {
      setRegenerating(false);
    }
  }

  return (
    <div className="space-y-8">
      <form onSubmit={saveGeneral} className="card space-y-4 p-4">
        <h2 className="eyebrow">General</h2>

        <label className="block">
          <span className="field-label">Committee name</span>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input"
          />
        </label>

        <label className="block">
          <span className="field-label">Runner-up bonus (₹)</span>
          <input
            type="number"
            required
            min={0}
            value={runnerUpBonus}
            onChange={(e) => setRunnerUpBonus(Number(e.target.value))}
            className="input money"
          />
        </label>

        <label className="block">
          <span className="field-label">Reserved month #</span>
          <input
            type="number"
            required
            min={1}
            max={durationMonths}
            disabled={reservedMonthLocked}
            value={reservedMonthNumber}
            onChange={(e) => setReservedMonthNumber(Number(e.target.value))}
            className="input money disabled:opacity-50"
          />
          {reservedMonthLocked && (
            <span className="mt-1.5 block text-xs text-[var(--muted)]">
              Locked &mdash; an auction has already been recorded for this
              committee.
            </span>
          )}
        </label>

        {generalError && (
          <p className="rounded-md border border-[var(--stamp)] bg-[var(--stamp-tint)] p-2.5 text-sm text-[var(--stamp)]">
            {generalError}
          </p>
        )}
        {generalSaved && (
          <p className="flex items-center gap-2 text-sm text-[var(--cloth)]">
            <Stamp tone="cloth">Saved</Stamp>
          </p>
        )}

        <button type="submit" className="btn-primary">
          Save
        </button>
      </form>

      <form onSubmit={changePin} className="card space-y-4 p-4">
        <h2 className="eyebrow">Change PIN</h2>

        <label className="block">
          <span className="field-label">Current PIN</span>
          <input
            type="password"
            inputMode="numeric"
            required
            value={currentPin}
            onChange={(e) => setCurrentPin(e.target.value)}
            className="input"
          />
        </label>

        <label className="block">
          <span className="field-label">New PIN</span>
          <input
            type="password"
            inputMode="numeric"
            required
            pattern="\d{4,6}"
            value={newPin}
            onChange={(e) => setNewPin(e.target.value)}
            className="input"
          />
        </label>

        {pinError && (
          <p className="rounded-md border border-[var(--stamp)] bg-[var(--stamp-tint)] p-2.5 text-sm text-[var(--stamp)]">
            {pinError}
          </p>
        )}
        {pinSaved && (
          <p className="flex items-center gap-2 text-sm">
            <Stamp tone="cloth">PIN changed</Stamp>
          </p>
        )}

        <button type="submit" className="btn-primary">
          Change PIN
        </button>
      </form>

      <div className="card space-y-3 p-4">
        <h2 className="eyebrow">Read-only link</h2>
        <p className="text-sm text-[var(--muted)]">
          If the shared link has leaked, regenerate it &mdash; the old link
          will stop working immediately.
        </p>
        <button
          type="button"
          onClick={regenerateMemberLink}
          disabled={regenerating}
          className="btn-secondary"
        >
          {regenerating ? "Regenerating…" : "Regenerate read-only link"}
        </button>
        {newMemberLink && (
          <div className="rounded-md border border-[var(--stamp)] bg-[var(--stamp-tint)] p-3">
            <p className="mb-1.5 text-xs font-medium text-[var(--stamp)]">
              New link &mdash; share this with members now
            </p>
            <code className="money block break-all rounded border border-[var(--border-subtle)] bg-[var(--surface)] p-2 text-xs">
              {newMemberLink}
            </code>
          </div>
        )}
      </div>
    </div>
  );
}
