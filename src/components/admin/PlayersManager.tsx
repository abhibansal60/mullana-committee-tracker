"use client";

import { useState } from "react";
import Avatar from "@/components/live/Avatar";
import Stamp from "@/components/Stamp";

export interface PlayerRow {
  memberId: string;
  name: string;
  isHolder: boolean;
  phone: string | null;
  joined: boolean;
  email: string | null;
  lastLoginAt: string | null;
  lastSeenAt: string | null;
}

function since(iso: string | null): string {
  if (!iso) return "never";
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

export default function PlayersManager({
  adminToken,
  committeeName,
  joinCode,
  phoneLogin,
  players: initialPlayers,
}: {
  adminToken: string;
  committeeName: string;
  joinCode: string;
  phoneLogin: boolean;
  players: PlayerRow[];
}) {
  const [players, setPlayers] = useState(initialPlayers);
  const [names, setNames] = useState<Record<string, string>>(Object.fromEntries(initialPlayers.map((p) => [p.memberId, p.name])));
  const [phones, setPhones] = useState<Record<string, string>>(Object.fromEntries(initialPlayers.map((p) => [p.memberId, p.phone ?? ""])));
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ memberId: string; text: string; bad?: boolean } | null>(null);
  const [copied, setCopied] = useState(false);

  async function call(body: object) {
    const res = await fetch(`/api/committees/${adminToken}/players`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? "Something went wrong");
    return data;
  }

  function update(memberId: string, patch: Partial<PlayerRow>) {
    setPlayers((ps) => ps.map((p) => (p.memberId === memberId ? { ...p, ...patch } : p)));
  }

  function joinUrl() {
    return `${window.location.origin}/join/${joinCode}`;
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(joinUrl());
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard blocked - the link is shown on screen anyway
    }
  }

  function shareLink() {
    const text = `${committeeName} is on the app 🪙 Tap to join with your Google account and pick your name: ${joinUrl()}\n\nOn committee day you can bid live from your phone.`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  }

  async function run(p: PlayerRow, key: string, fn: () => Promise<string>) {
    setBusy(`${key}-${p.memberId}`);
    setMessage(null);
    try {
      setMessage({ memberId: p.memberId, text: await fn() });
    } catch (err) {
      setMessage({ memberId: p.memberId, text: (err as Error).message, bad: true });
    } finally {
      setBusy(null);
    }
  }

  const saveName = (p: PlayerRow) =>
    run(p, "name", async () => {
      const data = await call({ action: "rename", memberId: p.memberId, name: names[p.memberId] ?? "" });
      update(p.memberId, { name: data.name });
      setNames((n) => ({ ...n, [p.memberId]: data.name }));
      return "Name updated";
    });

  const savePhone = (p: PlayerRow) =>
    run(p, "phone", async () => {
      const data = await call({ action: "phone", memberId: p.memberId, phone: phones[p.memberId] ?? "" });
      update(p.memberId, { phone: data.phone });
      setPhones((d) => ({ ...d, [p.memberId]: data.phone ?? "" }));
      return data.phone ? "Number saved" : "Number removed";
    });

  async function reset(p: PlayerRow) {
    if (!window.confirm(`Reset ${p.name}? They're logged out everywhere and their Google account is unlinked, so they pick their name again from the join link.`)) return;
    await run(p, "reset", async () => {
      await call({ action: "revoke", memberId: p.memberId });
      update(p.memberId, { joined: false, email: null, lastLoginAt: null });
      return "Reset - they can join again from the link";
    });
  }

  const joined = players.filter((p) => p.joined).length;

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <div className="flex items-center justify-between">
          <div>
            <span className="eyebrow">Joined the app</span>
            <p className="money mt-0.5 text-2xl font-medium">
              {joined}/{players.length}
            </p>
          </div>
        </div>
        <p className="mt-3 text-sm text-[var(--muted)]">
          Send everyone the same link. They sign in with Google and pick their own name.
        </p>
        <div className="mt-3 flex gap-2">
          <button type="button" className="btn-primary flex-1 bg-[#1f8f4e] hover:bg-[#187a41]" onClick={shareLink}>
            💬 Share on WhatsApp
          </button>
          <button type="button" className="btn-secondary" onClick={copyLink}>
            {copied ? "Copied!" : "Copy link"}
          </button>
        </div>
      </div>

      <ul className="space-y-3">
        {players.map((p) => {
          const nameDirty = (names[p.memberId] ?? p.name).trim() !== p.name;
          const phoneDirty = (phones[p.memberId] ?? "") !== (p.phone ?? "");
          return (
            <li key={p.memberId} className="card p-4">
              <div className="flex items-center gap-3">
                <Avatar name={p.name} size={38} />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 text-sm font-medium">
                    {p.name}
                    {p.isHolder && <Stamp tone="muted">Holder</Stamp>}
                  </p>
                  <p className="truncate text-xs text-[var(--muted)]">
                    {p.joined ? `Joined${p.email ? ` · ${p.email}` : ""}` : "Not joined yet"}
                    {p.lastSeenAt ? ` · seen ${since(p.lastSeenAt)}` : ""}
                  </p>
                </div>
                {(p.joined || p.lastLoginAt) && (
                  <button type="button" className="btn-danger px-3 py-1.5 text-xs" onClick={() => reset(p)} disabled={busy === `reset-${p.memberId}`}>
                    Reset
                  </button>
                )}
              </div>

              <form
                className="mt-3 flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  saveName(p);
                }}
              >
                <input
                  aria-label={`Name for ${p.name}`}
                  value={names[p.memberId] ?? ""}
                  maxLength={100}
                  onChange={(e) => setNames((n) => ({ ...n, [p.memberId]: e.target.value }))}
                  className="input"
                />
                {nameDirty && (
                  <button type="submit" className="btn-primary" disabled={busy === `name-${p.memberId}`}>
                    Save
                  </button>
                )}
              </form>

              {phoneLogin && (
                <form
                  className="mt-2 flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    savePhone(p);
                  }}
                >
                  <div className="flex flex-1 items-center rounded-md border border-[var(--border-strong)] bg-[var(--surface)] focus-within:border-[var(--cloth)]">
                    <span className="money pl-3 text-sm text-[var(--muted)]">+91</span>
                    <input
                      type="tel"
                      inputMode="numeric"
                      placeholder="Mobile number (optional)"
                      value={phones[p.memberId] ?? ""}
                      onChange={(e) => setPhones((d) => ({ ...d, [p.memberId]: e.target.value }))}
                      className="money w-full bg-transparent px-2 py-2.5 text-[15px] outline-none"
                    />
                  </div>
                  {phoneDirty && (
                    <button type="submit" className="btn-primary" disabled={busy === `phone-${p.memberId}`}>
                      Save
                    </button>
                  )}
                </form>
              )}

              {message?.memberId === p.memberId && (
                <p className={`mt-2 text-xs ${message.bad ? "text-[var(--stamp)]" : "text-[var(--cloth)]"}`}>{message.text}</p>
              )}
            </li>
          );
        })}
      </ul>
      <p className="px-1 text-xs text-[var(--muted)]">
        Members who haven&apos;t joined can still take part: on committee day you can bid for anyone from the Live room.
        {phoneLogin
          ? " Phone login is on (Live room settings)."
          : " Phone login is off; turn it on in the Live room settings if you need it."}
      </p>
    </div>
  );
}
