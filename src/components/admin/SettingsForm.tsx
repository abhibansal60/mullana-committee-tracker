"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

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
    <div className="space-y-10">
      <form onSubmit={saveGeneral} className="space-y-4">
        <h2 className="text-sm font-medium text-neutral-500">General</h2>

        <label className="block">
          <span className="block text-xs font-medium mb-1">Committee name</span>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input"
          />
        </label>

        <label className="block">
          <span className="block text-xs font-medium mb-1">
            Runner-up bonus (₹)
          </span>
          <input
            type="number"
            required
            min={0}
            value={runnerUpBonus}
            onChange={(e) => setRunnerUpBonus(Number(e.target.value))}
            className="input"
          />
        </label>

        <label className="block">
          <span className="block text-xs font-medium mb-1">
            Reserved month #
          </span>
          <input
            type="number"
            required
            min={1}
            max={durationMonths}
            disabled={reservedMonthLocked}
            value={reservedMonthNumber}
            onChange={(e) => setReservedMonthNumber(Number(e.target.value))}
            className="input disabled:opacity-50"
          />
          {reservedMonthLocked && (
            <span className="block text-xs text-neutral-500 mt-1">
              Locked - an auction has already been recorded for this
              committee.
            </span>
          )}
        </label>

        {generalError && <p className="text-sm text-red-600">{generalError}</p>}
        {generalSaved && (
          <p className="text-sm text-green-600">Saved.</p>
        )}

        <button
          type="submit"
          className="rounded-md bg-neutral-900 text-white px-4 py-2 text-sm"
        >
          Save
        </button>
      </form>

      <form onSubmit={changePin} className="space-y-4">
        <h2 className="text-sm font-medium text-neutral-500">Change PIN</h2>

        <label className="block">
          <span className="block text-xs font-medium mb-1">Current PIN</span>
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
          <span className="block text-xs font-medium mb-1">New PIN</span>
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

        {pinError && <p className="text-sm text-red-600">{pinError}</p>}
        {pinSaved && <p className="text-sm text-green-600">PIN changed.</p>}

        <button
          type="submit"
          className="rounded-md bg-neutral-900 text-white px-4 py-2 text-sm"
        >
          Change PIN
        </button>
      </form>

      <div className="space-y-3">
        <h2 className="text-sm font-medium text-neutral-500">
          Read-only link
        </h2>
        <p className="text-sm text-neutral-600">
          If the shared link has leaked, regenerate it - the old link will
          stop working immediately.
        </p>
        <button
          type="button"
          onClick={regenerateMemberLink}
          disabled={regenerating}
          className="rounded-md border border-neutral-300 px-4 py-2 text-sm disabled:opacity-50"
        >
          {regenerating ? "Regenerating..." : "Regenerate read-only link"}
        </button>
        {newMemberLink && (
          <div className="rounded-md border border-amber-300 bg-amber-50 p-3">
            <p className="text-xs font-medium mb-1">
              New link - share this with members now:
            </p>
            <code className="block break-all text-xs bg-white rounded p-2 border">
              {newMemberLink}
            </code>
          </div>
        )}
      </div>
    </div>
  );
}
