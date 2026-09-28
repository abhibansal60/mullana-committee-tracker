"use client";

import { useState } from "react";
import Avatar from "@/components/live/Avatar";
import Stamp from "@/components/Stamp";

export interface PlayerRow {
  memberId: string;
  name: string;
  isHolder: boolean;
  phone: string | null;
  hasInvite: boolean;
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
  players: initialPlayers,
}: {
  adminToken: string;
  committeeName: string;
  players: PlayerRow[];
}) {
  const [players, setPlayers] = useState(initialPlayers);
  const [drafts, setDrafts] = useState<Record<string, string>>(
    Object.fromEntries(initialPlayers.map((p) => [p.memberId, p.phone ?? ""]))
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ memberId: string; text: string; bad?: boolean } | null>(null);
  const [links, setLinks] = useState<Record<string, string>>({});

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

  async function savePhone(p: PlayerRow) {
    setBusy(`phone-${p.memberId}`);
    setMessage(null);
    try {
      const data = await call({ action: "phone", memberId: p.memberId, phone: drafts[p.memberId] ?? "" });
      update(p.memberId, { phone: data.phone });
      setDrafts((d) => ({ ...d, [p.memberId]: data.phone ?? "" }));
      setMessage({ memberId: p.memberId, text: data.phone ? "Number saved" : "Number removed" });
    } catch (err) {
      setMessage({ memberId: p.memberId, text: (err as Error).message, bad: true });
    } finally {
      setBusy(null);
    }
  }

  async function invite(p: PlayerRow, via: "whatsapp" | "copy") {
    setBusy(`invite-${p.memberId}`);
    setMessage(null);
    // Open the WhatsApp window synchronously (inside the tap) so popup
    // blockers allow it, then point it at the real link once we have one.
    const win = via === "whatsapp" ? window.open("about:blank", "_blank") : null;
    try {
      const data = await call({ action: "invite", memberId: p.memberId });
      const url = `${window.location.origin}${data.path}`;
      setLinks((l) => ({ ...l, [p.memberId]: url }));
      update(p.memberId, { hasInvite: true });
      const text =
        `Hi ${p.name.split(" ")[0]}! 🪙 ${committeeName} is now on the app. ` +
        `Tap your personal link to log in (it's just for you, don't forward it): ${url}\n\n` +
        `On committee day you can bid live right from your phone.`;
      if (win) {
        const target = p.phone ? `https://wa.me/91${p.phone}?text=${encodeURIComponent(text)}` : `https://wa.me/?text=${encodeURIComponent(text)}`;
        win.location.href = target;
      } else {
        await navigator.clipboard.writeText(url).catch(() => {});
        setMessage({ memberId: p.memberId, text: "Personal link copied" });
      }
    } catch (err) {
      win?.close();
      setMessage({ memberId: p.memberId, text: (err as Error).message, bad: true });
    } finally {
      setBusy(null);
    }
  }

  async function revoke(p: PlayerRow) {
    if (!window.confirm(`Log ${p.name} out everywhere, cancel their invite link and unlink any Google account?`)) return;
    setBusy(`revoke-${p.memberId}`);
    try {
      await call({ action: "revoke", memberId: p.memberId });
      update(p.memberId, { hasInvite: false });
      setLinks((l) => {
        const next = { ...l };
        delete next[p.memberId];
        return next;
      });
      setMessage({ memberId: p.memberId, text: "Logged out everywhere" });
    } catch (err) {
      setMessage({ memberId: p.memberId, text: (err as Error).message, bad: true });
    } finally {
      setBusy(null);
    }
  }

  const loggedIn = players.filter((p) => p.lastLoginAt).length;

  return (
    <div className="space-y-4">
      <div className="card flex items-center justify-between p-4">
        <div>
          <span className="eyebrow">Joined the app</span>
          <p className="money mt-0.5 text-2xl font-medium">
            {loggedIn}/{players.length}
          </p>
        </div>
        <p className="max-w-[60%] text-right text-xs text-[var(--muted)]">
          Tap <b>WhatsApp</b> to send each member their personal login link. Or they can log in at{" "}
          <span className="money">/login</span> with the number saved here.
        </p>
      </div>

      <ul className="space-y-3">
        {players.map((p) => {
          const draft = drafts[p.memberId] ?? "";
          const dirty = draft !== (p.phone ?? "");
          return (
            <li key={p.memberId} className="card p-4">
              <div className="flex items-center gap-3">
                <Avatar name={p.name} size={38} />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 text-sm font-medium">
                    {p.name}
                    {p.isHolder && <Stamp tone="muted">Holder</Stamp>}
                  </p>
                  <p className="text-xs text-[var(--muted)]">
                    {p.lastLoginAt ? `Logged in ${since(p.lastLoginAt)}` : "Not joined yet"}
                    {p.lastSeenAt ? ` · seen ${since(p.lastSeenAt)}` : ""}
                  </p>
                </div>
              </div>

              <form
                className="mt-3 flex gap-2"
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
                    placeholder="Mobile number"
                    value={draft}
                    onChange={(e) => setDrafts((d) => ({ ...d, [p.memberId]: e.target.value }))}
                    className="money w-full bg-transparent px-2 py-2.5 text-[15px] outline-none"
                  />
                </div>
                {dirty && (
                  <button type="submit" className="btn-primary" disabled={busy === `phone-${p.memberId}`}>
                    Save
                  </button>
                )}
              </form>

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn-primary flex-1 bg-[#1f8f4e] hover:bg-[#187a41]"
                  disabled={busy === `invite-${p.memberId}`}
                  onClick={() => invite(p, "whatsapp")}
                >
                  💬 WhatsApp invite
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={busy === `invite-${p.memberId}`}
                  onClick={() => invite(p, "copy")}
                >
                  Copy link
                </button>
                {(p.hasInvite || p.lastLoginAt) && (
                  <button type="button" className="btn-danger" onClick={() => revoke(p)} disabled={busy === `revoke-${p.memberId}`}>
                    Reset
                  </button>
                )}
              </div>

              {links[p.memberId] && (
                <code className="money mt-2 block break-all rounded border border-[var(--border-subtle)] bg-[var(--background)] p-2 text-[11px]">
                  {links[p.memberId]}
                </code>
              )}
              {message?.memberId === p.memberId && (
                <p className={`mt-2 text-xs ${message.bad ? "text-[var(--stamp)]" : "text-[var(--cloth)]"}`}>{message.text}</p>
              )}
            </li>
          );
        })}
      </ul>
      <p className="px-1 text-xs text-[var(--muted)]">
        A new invite replaces that member&apos;s previous invite link; anyone already logged in stays logged in.
        &ldquo;Reset&rdquo; logs them out on every phone.
      </p>
    </div>
  );
}
