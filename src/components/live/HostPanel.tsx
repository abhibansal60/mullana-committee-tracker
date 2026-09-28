"use client";

import Link from "next/link";
import { useState } from "react";
import type { LiveState } from "@/lib/live/queries";
import { ROUND_SECONDS_MAX, ROUND_SECONDS_MIN } from "@/lib/live/rules";
import { formatRupees } from "@/lib/money";
import type { HostSlotProps } from "./LiveRoom";
import { unlockAudio } from "./sfx";

export interface HostSettings {
  openingBid: number;
  bidIncrement: number;
  roundSeconds: number;
  allowPhoneLogin: boolean;
}

export default function HostPanel({
  adminToken,
  auctionableMonths,
  settings: initialSettings,
  maxBid,
  minOpeningBid,
  state,
  accept,
  refresh,
}: HostSlotProps & {
  adminToken: string;
  auctionableMonths: { id: string; monthNumber: number }[];
  settings: HostSettings;
  maxBid: number;
  minOpeningBid: number;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pickedMonthId, setMonthId] = useState("");
  const [settings, setSettings] = useState(initialSettings);
  const [editing, setEditing] = useState(false);
  const [runnerUpPick, setRunnerUpPick] = useState("");
  const [copied, setCopied] = useState(false);

  const s = state.session;
  const status = s?.status ?? null;
  // The list came from the server at page load; drop a month this room has
  // since recorded.
  const openableMonths = auctionableMonths.filter(
    (m) => !(status === "finalized" && m.monthNumber === s?.monthNumber)
  );
  const monthId = openableMonths.some((m) => m.id === pickedMonthId)
    ? pickedMonthId
    : openableMonths[0]?.id ?? "";

  async function act(action: string, extra: object = {}, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return;
    unlockAudio();
    setBusy(action);
    setError(null);
    try {
      const res = await fetch(`/api/committees/${adminToken}/live`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setError(data.error ?? "Something went wrong");
      if (data.state) accept(data.state);
      else void refresh();
    } catch {
      setError("Network error - try again");
    } finally {
      setBusy(null);
    }
  }

  async function saveSettings() {
    setBusy("settings");
    setError(null);
    try {
      const res = await fetch(`/api/committees/${adminToken}/live/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Couldn't save");
        return false;
      }
      setEditing(false);
      return true;
    } finally {
      setBusy(null);
    }
  }

  async function shareRoom() {
    const url = `${window.location.origin}/play/live`;
    const text = `🔔 Committee day! Month ${s?.monthNumber ?? ""} auction room is open. Join here: ${url}`;
    if (navigator.share) {
      try {
        await navigator.share({ text });
        return;
      } catch {
        // fall through to WhatsApp
      }
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  }

  async function copyRoomLink() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/play/live`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  }

  const b = (key: string) => busy === key;
  const eligibleForRunnerUp = state.players.filter((p) => p.eligible && p.id !== s?.leaderId);

  return (
    <div className="arena-card border-[var(--gold-deep)]/60 p-4">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xs font-bold tracking-[0.18em] text-[var(--gold)] uppercase">Host controls</h2>
        {status && status !== "finalized" && (
          <div className="flex gap-2">
            <button type="button" className="text-xs text-[var(--arena-muted)] underline" onClick={copyRoomLink}>
              {copied ? "Copied!" : "Copy link"}
            </button>
            <button type="button" className="text-xs font-semibold text-[var(--win)] underline" onClick={shareRoom}>
              Share on WhatsApp
            </button>
          </div>
        )}
      </div>

      {error && (
        <p className="mb-3 rounded-xl border border-[var(--ember)] bg-[var(--ember)]/15 px-3 py-2 text-sm text-[var(--ember)]">
          {error}
        </p>
      )}

      {(!s || status === "finalized") && (
        <div className="space-y-4">
          {status === "finalized" && (
            <p className="rounded-xl bg-[var(--win)]/10 px-3 py-2 text-sm text-[var(--win)]">
              ✓ Month {s!.monthNumber} recorded.{" "}
              <Link href={`/admin/${adminToken}`} className="underline">
                Collect payments from the dashboard
              </Link>
            </p>
          )}
          {openableMonths.length === 0 ? (
            <p className="text-sm text-[var(--arena-muted)]">Every auctionable month has been recorded. 🎉</p>
          ) : (
            <>
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-[var(--arena-muted)] uppercase">Month to auction</span>
                <select className="arena-input" value={monthId} onChange={(e) => setMonthId(e.target.value)}>
                  {openableMonths.map((m) => (
                    <option key={m.id} value={m.id}>
                      Month {m.monthNumber}
                    </option>
                  ))}
                </select>
              </label>

              {!editing ? (
                <div className="flex items-center justify-between rounded-xl border border-[var(--arena-line)] px-3 py-2.5 text-sm">
                  <span className="money">
                    Opening {formatRupees(settings.openingBid)} · +{formatRupees(settings.bidIncrement)} · {settings.roundSeconds}s
                  </span>
                  <button type="button" className="text-xs font-semibold text-[var(--gold)] underline" onClick={() => setEditing(true)}>
                    Change
                  </button>
                </div>
              ) : (
                <div className="space-y-3 rounded-xl border border-[var(--arena-line)] p-3">
                  <label className="block">
                    <span className="mb-1 block text-xs text-[var(--arena-muted)]">
                      Opening bid (₹{minOpeningBid.toLocaleString("en-IN")}–₹{maxBid.toLocaleString("en-IN")}, steps of 500)
                    </span>
                    <input
                      type="number"
                      step={500}
                      min={minOpeningBid}
                      max={maxBid}
                      className="arena-input money"
                      value={settings.openingBid}
                      onChange={(e) => setSettings({ ...settings, openingBid: Number(e.target.value) })}
                    />
                  </label>
                  <div>
                    <span className="mb-1 block text-xs text-[var(--arena-muted)]">Minimum raise per bid</span>
                    <div className="grid grid-cols-4 gap-2">
                      {[500, 1000, 2000, 5000].map((v) => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => setSettings({ ...settings, bidIncrement: v })}
                          className={`chip-button money ${settings.bidIncrement === v ? "border-[var(--gold)] text-[var(--gold)]" : ""}`}
                        >
                          {formatRupees(v)}
                        </button>
                      ))}
                    </div>
                  </div>
                  <label className="block">
                    <span className="mb-1 block text-xs text-[var(--arena-muted)]">
                      Fuse after each bid: <b className="text-[var(--arena-text)]">{settings.roundSeconds}s</b>
                    </span>
                    <input
                      type="range"
                      min={ROUND_SECONDS_MIN}
                      max={ROUND_SECONDS_MAX}
                      step={5}
                      value={settings.roundSeconds}
                      onChange={(e) => setSettings({ ...settings, roundSeconds: Number(e.target.value) })}
                      className="w-full accent-[var(--gold)]"
                    />
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={settings.allowPhoneLogin}
                      onChange={(e) => setSettings({ ...settings, allowPhoneLogin: e.target.checked })}
                      className="h-4 w-4 accent-[var(--gold)]"
                    />
                    Members can log in with just their mobile number
                  </label>
                  <div className="flex gap-2">
                    <button type="button" className="host-button-primary flex-1" disabled={b("settings")} onClick={saveSettings}>
                      {b("settings") ? "Saving…" : "Save"}
                    </button>
                    <button
                      type="button"
                      className="host-button"
                      onClick={() => {
                        setSettings(initialSettings);
                        setEditing(false);
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              <button
                type="button"
                className="host-button-primary w-full py-4 text-base"
                disabled={!monthId || b("open") || editing}
                onClick={() => act("open", { monthId })}
              >
                {b("open") ? "Opening…" : "🔔 Open the auction room"}
              </button>
              <p className="text-center text-xs text-[var(--arena-muted)]">
                Members see a lobby and join in. You start the bidding when everyone&apos;s here.
              </p>
            </>
          )}
        </div>
      )}

      {status === "lobby" && (
        <div className="space-y-2">
          <button type="button" className="host-button-primary w-full py-4 text-base" disabled={!!busy} onClick={() => act("start")}>
            ▶ Start bidding (3-2-1)
          </button>
          <button
            type="button"
            className="host-button w-full"
            disabled={!!busy}
            onClick={() => act("cancel", {}, "Close the room without an auction?")}
          >
            Close room
          </button>
        </div>
      )}

      {(status === "live" || status === "paused") && (
        <div className="grid grid-cols-2 gap-2">
          {status === "live" ? (
            <button type="button" className="host-button" disabled={!!busy} onClick={() => act("pause")}>
              ⏸ Pause
            </button>
          ) : (
            <button type="button" className="host-button-primary" disabled={!!busy} onClick={() => act("resume")}>
              ▶ Resume
            </button>
          )}
          <button type="button" className="host-button" disabled={!!busy} onClick={() => act("extend")}>
            +10s
          </button>
          <button
            type="button"
            className="host-button col-span-2 border-[var(--ember)] text-[var(--ember)]"
            disabled={!!busy || !s?.bidCount}
            onClick={() => act("hammer", {}, `Sell now to the highest bidder at ${formatRupees(s?.currentBid ?? 0)}?`)}
          >
            🔨 SOLD — close bidding now
          </button>
          <button
            type="button"
            className="host-button"
            disabled={!!busy || !s?.bidCount}
            onClick={() => act("undo", {}, "Remove the last bid? (use this for mistaken taps)")}
          >
            ↩ Undo last bid
          </button>
          <button
            type="button"
            className="host-button"
            disabled={!!busy}
            onClick={() => act("cancel", {}, "Cancel this auction? All bids will be discarded.")}
          >
            ✕ Cancel auction
          </button>
        </div>
      )}

      {status === "closed" && (
        <div className="space-y-3">
          <Summary state={state} />
          {!s?.runnerUpId && (
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-[var(--arena-muted)] uppercase">
                Only one person bid — who&apos;s the runner-up?
              </span>
              <select className="arena-input" value={runnerUpPick} onChange={(e) => setRunnerUpPick(e.target.value)}>
                <option value="">Select member</option>
                {eligibleForRunnerUp.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <button
            type="button"
            className="host-button-primary w-full py-4 text-base"
            disabled={!!busy || (!s?.runnerUpId && !runnerUpPick)}
            onClick={() =>
              act("finalize", s?.runnerUpId ? {} : { runnerUpMemberId: runnerUpPick })
            }
          >
            {b("finalize") ? "Recording…" : "✓ Confirm & record result"}
          </button>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" className="host-button" disabled={!!busy} onClick={() => act("reopen", {}, "Reopen bidding with a fresh clock?")}>
              Reopen bidding
            </button>
            <button type="button" className="host-button" disabled={!!busy} onClick={() => act("undo", {}, "Remove the last bid and reopen?")}>
              ↩ Undo last bid
            </button>
          </div>
        </div>
      )}

      {status && (
        <div className="mt-4 flex justify-center gap-1.5 border-t border-[var(--arena-line)] pt-3 text-xs text-[var(--arena-muted)]">
          Viewing as host · members see the same stage with a bid button
        </div>
      )}
    </div>
  );
}

function Summary({ state }: { state: LiveState }) {
  const s = state.session!;
  const name = (id: string | null) => state.players.find((p) => p.id === id)?.name ?? "—";
  return (
    <dl className="grid grid-cols-2 gap-2 text-sm">
      <div className="rounded-xl bg-[var(--arena)] p-3">
        <dt className="text-[10px] tracking-wider text-[var(--arena-muted)] uppercase">Winner</dt>
        <dd className="font-semibold">{name(s.leaderId)}</dd>
      </div>
      <div className="rounded-xl bg-[var(--arena)] p-3">
        <dt className="text-[10px] tracking-wider text-[var(--arena-muted)] uppercase">Winning bid</dt>
        <dd className="money font-semibold">{formatRupees(s.currentBid ?? 0)}</dd>
      </div>
      <div className="rounded-xl bg-[var(--arena)] p-3">
        <dt className="text-[10px] tracking-wider text-[var(--arena-muted)] uppercase">Runner-up</dt>
        <dd className="font-semibold">{s.runnerUpId ? name(s.runnerUpId) : "—"}</dd>
      </div>
      <div className="rounded-xl bg-[var(--arena)] p-3">
        <dt className="text-[10px] tracking-wider text-[var(--arena-muted)] uppercase">Takes home</dt>
        <dd className="money font-semibold">{formatRupees(s.takesHome ?? 0)}</dd>
      </div>
    </dl>
  );
}

export type { LiveState };
