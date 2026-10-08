"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { LiveState } from "@/lib/live/queries";
import { REACTIONS, clockPhase } from "@/lib/live/rules";
import { formatRupees } from "@/lib/money";
import Avatar from "./Avatar";
import Confetti from "./Confetti";
import FloatingReactions from "./FloatingReactions";
import { useLiveState, useTicker } from "./useLiveState";
import { buzz, isMuted, setMuted, sfx, unlockAudio } from "./sfx";

type Toast = { id: number; text: string; tone: "info" | "bad" | "good" };

export interface HostSlotProps {
  state: LiveState;
  accept: (s: LiveState) => void;
  refresh: () => Promise<void>;
}

export default function LiveRoom({
  mode,
  endpoint,
  initial,
  homeHref,
  bidEndpoint,
  react,
  hostSlot,
}: {
  mode: "player" | "host";
  endpoint: string;
  initial: LiveState | null;
  homeHref: string;
  bidEndpoint?: string;
  react: (emoji: string) => Promise<void>;
  hostSlot?: (p: HostSlotProps) => ReactNode;
}) {
  const { state, accept, refresh, serverNow, connection, authLost } = useLiveState(endpoint, initial);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [pendingBid, setPendingBid] = useState<number | null>(null);
  const [shakeKey, setShakeKey] = useState(0);
  const [confettiKey, setConfettiKey] = useState(0);
  const [muted, setMutedState] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage/clock are only readable after mount
    setMutedState(isMuted());
    setMounted(true);
  }, []);

  const session = state?.session ?? null;
  const me = state?.me ?? null;
  const players = useMemo(() => state?.players ?? [], [state?.players]);
  const playerById = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);
  const nameOf = useCallback(
    (id: string | null) => (id ? playerById.get(id)?.name ?? "Someone" : state?.hostName ?? "Holder"),
    [playerById, state?.hostName]
  );

  const toast = useCallback((text: string, tone: Toast["tone"] = "info") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-2), { id, text, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }, []);

  // --- Clock -------------------------------------------------------------
  // Until hydration finishes, render against the server's own timestamp so
  // the countdown text matches the server HTML exactly.
  const now = mounted ? serverNow() : state?.serverNow ?? 0;
  const inCountdown = !!session && session.status === "live" && !!session.startsAt && session.startsAt > now;
  const clockRunning = !!session && (session.status === "live" || inCountdown);
  useTicker(clockRunning || session?.status === "paused", 100);

  const remainingMs =
    session?.status === "live" && session.roundEndsAt
      ? Math.max(0, session.roundEndsAt - now)
      : session?.status === "paused"
        ? session.pausedRemainingMs ?? null
        : null;
  const phase =
    remainingMs != null && session ? clockPhase(remainingMs, session.roundSeconds) : "open";

  // --- Event detection: sounds, haptics, toasts, confetti -----------------
  const prev = useRef<LiveState | null>(null);
  useEffect(() => {
    const before = prev.current;
    prev.current = state;
    if (!state || !before) return;
    const a = before.session;
    const b = state.session;
    if (!b) return;

    if (a && b.id === a.id && b.bidCount > a.bidCount && b.leaderId) {
      if (b.leaderId === state.me?.memberId) {
        // our own bid - already celebrated on tap
      } else if (a.leaderId && a.leaderId === state.me?.memberId) {
        sfx.outbid();
        buzz([90, 50, 90]);
        toast(`${nameOf(b.leaderId)} outbid you! ${formatRupees(b.currentBid ?? 0)}`, "bad");
      } else {
        sfx.bid();
        buzz(20);
      }
    }
    if (a?.status !== "closed" && b.status === "closed") {
      sfx.sold();
      buzz([200, 80, 300]);
      if (b.leaderId && b.leaderId === state.me?.memberId) {
        setTimeout(() => sfx.win(), 500);
        // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot celebration on a polled transition
        setConfettiKey((k) => k + 1);
      }
    }
    if (a?.status !== "finalized" && b.status === "finalized") {
      setConfettiKey((k) => k + 1);
      sfx.win();
    }
    if (a && a.status !== "lobby" && b.status === "lobby") sfx.pop();
  }, [state, nameOf, toast]);

  // Countdown beeps (3-2-1-GO) and last-five-seconds ticks.
  const lastBeep = useRef<string>("");
  useEffect(() => {
    if (!session) return;
    if (inCountdown && session.startsAt) {
      const n = Math.ceil((session.startsAt - now) / 1000);
      const key = `c${session.id}${n}`;
      if (n <= 3 && n >= 1 && lastBeep.current !== key) {
        lastBeep.current = key;
        sfx.count();
        buzz(40);
      }
    } else if (session.status === "live" && session.startsAt && now - session.startsAt < 600) {
      const key = `go${session.id}${session.startsAt}`;
      if (lastBeep.current !== key) {
        lastBeep.current = key;
        sfx.go();
        buzz([60, 40, 60]);
      }
    } else if (session.status === "live" && remainingMs != null && remainingMs > 0 && remainingMs <= 5000) {
      const s = Math.ceil(remainingMs / 1000);
      const key = `t${session.id}${session.roundEndsAt}${s}`;
      if (lastBeep.current !== key) {
        lastBeep.current = key;
        sfx.tick();
      }
    }
  });

  // Keep the screen awake while the room is open.
  // Keyed on a boolean, not the session object: that changes on every poll,
  // which would release and re-request the lock about once a second.
  const roomOpen = !!session && session.status !== "finalized";
  useEffect(() => {
    if (!roomOpen) return;
    let gone = false;
    let lock: { release: () => Promise<void> } | null = null;
    const nav = navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } };
    nav.wakeLock
      ?.request("screen")
      .then((l) => {
        if (gone) l.release().catch(() => {});
        else lock = l;
      })
      .catch(() => {});
    return () => {
      gone = true;
      lock?.release().catch(() => {});
    };
  }, [roomOpen]);

  // --- Actions -------------------------------------------------------------
  async function bid(amount: number) {
    if (!session || !bidEndpoint || pendingBid != null) return;
    unlockAudio();
    setPendingBid(amount);
    sfx.myBid();
    buzz(30);
    try {
      const res = await fetch(bidEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expectedBid: session.currentBid, amount }),
      });
      const data = await res.json().catch(() => ({}));
      if (data.state) accept(data.state);
      if (!res.ok) {
        setShakeKey((k) => k + 1);
        buzz([40, 30, 40]);
        toast(data.error ?? "Bid didn't go through", "bad");
      } else {
        toast(`You bid ${formatRupees(amount)} 🔥`, "good");
      }
    } catch {
      toast("Network hiccup - tap again", "bad");
    } finally {
      setPendingBid(null);
    }
  }

  async function sendReaction(emoji: string) {
    unlockAudio();
    sfx.pop();
    buzz(10);
    try {
      await react(emoji);
      void refresh();
    } catch {
      // reactions are best-effort
    }
  }

  function toggleMute() {
    unlockAudio();
    setMuted(!muted);
    setMutedState(!muted);
  }

  // --- Render --------------------------------------------------------------
  if (authLost) {
    return (
      <Shell>
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
          <p className="text-lg font-semibold">You&apos;ve been logged out</p>
          <Link href="/login" className="host-button-primary">
            Log in again
          </Link>
        </div>
      </Shell>
    );
  }

  if (!state) {
    return (
      <Shell>
        <div className="flex flex-1 items-center justify-center text-[var(--arena-muted)]">Connecting…</div>
      </Shell>
    );
  }

  const online = players.filter((p) => p.online && !p.isHolder);
  const bidders = players.filter((p) => p.eligible);
  const biddersOnline = bidders.filter((p) => p.online);
  const leader = session?.leaderId ? playerById.get(session.leaderId) : null;
  const runnerUp = session?.runnerUpId ? playerById.get(session.runnerUpId) : null;
  const groupSaving =
    session?.currentBid != null
      ? Math.max(0, Math.floor((session.currentBid - state.committee.runnerUpBonus) / state.committee.memberCount))
      : null;
  // The host's next button belongs on the first screen: right under the
  // lobby header or the stage, not below the roster and the bid feed.
  const hostControls =
    mode === "host" && hostSlot ? <section className="mt-6">{hostSlot({ state, accept, refresh })}</section> : null;

  return (
    <Shell onPointerDown={unlockAudio}>
      {confettiKey > 0 && <Confetti key={confettiKey} />}
      <FloatingReactions reactions={state.reactions} nameOf={nameOf} />

      {/* Toasts */}
      <div className="pointer-events-none fixed inset-x-0 top-3 z-50 flex flex-col items-center gap-2 px-4" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`animate-slide-down rounded-full px-4 py-2 text-sm font-semibold shadow-xl ${
              t.tone === "bad"
                ? "bg-[var(--ember)] text-white"
                : t.tone === "good"
                  ? "bg-[var(--win)] text-[#08210f]"
                  : "bg-[var(--arena-text)] text-[var(--arena)]"
            }`}
          >
            {t.text}
          </div>
        ))}
      </div>

      {/* Top bar */}
      <header className="sticky top-0 z-30 border-b border-[var(--arena-line)] bg-[var(--arena)]/85 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <Link href={homeHref} className="text-[var(--arena-muted)] hover:text-[var(--arena-text)]" aria-label="Back">
              ←
            </Link>
            <StatusPill status={session?.status ?? null} inCountdown={inCountdown} />
            <span className="truncate text-sm font-semibold">
              {session ? `Month ${session.monthNumber}` : state.committee.name}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {connection !== "ok" && (
              <span className="rounded-full bg-[var(--ember)]/20 px-2 py-0.5 text-[11px] font-semibold text-[var(--ember)]">
                {connection === "lost" ? "Reconnecting…" : "Weak signal"}
              </span>
            )}
            <span className="flex items-center gap-1.5 rounded-full border border-[var(--arena-line)] px-2.5 py-1 text-xs font-semibold whitespace-nowrap">
              <span className="h-2 w-2 rounded-full bg-[var(--win)]" />
              {online.length} here
            </span>
            <button
              type="button"
              onClick={() => setShowHelp(true)}
              className="h-8 w-8 rounded-full border border-[var(--arena-line)] text-sm"
              aria-label="How it works"
            >
              ?
            </button>
            <button
              type="button"
              onClick={toggleMute}
              className="h-8 w-8 rounded-full border border-[var(--arena-line)] text-sm"
              aria-label={muted ? "Unmute" : "Mute"}
            >
              {muted ? "🔇" : "🔊"}
            </button>
          </div>
        </div>
      </header>

      {state.committee.practice && (
        <div className="bg-[var(--practice-arena)]/20 py-1.5 text-center text-xs font-semibold tracking-wide text-[var(--practice-arena-text)]">
          🧪 PRACTICE ROOM — nothing here is real ·{" "}
          <Link href={homeHref} className="underline">
            Exit
          </Link>
        </div>
      )}

      {/* Roster */}
      <div className="mx-auto w-full max-w-2xl overflow-x-auto px-4 pt-6 pb-2 [scrollbar-width:none]">
        <ul className="flex min-w-max gap-3.5">
          {[...players]
            .filter((p) => !p.isHolder)
            .sort((a, b) => Number(b.eligible) - Number(a.eligible) || Number(b.online) - Number(a.online) || a.name.localeCompare(b.name))
            .map((p) => (
              <li key={p.id} className="flex w-14 flex-col items-center gap-1.5">
                <Avatar
                  name={p.name}
                  size={44}
                  online={p.online}
                  crown={session?.leaderId === p.id && session.status !== "lobby"}
                  ring={session?.leaderId === p.id && session.status !== "lobby"}
                  dim={!p.eligible && !!session}
                  bot={p.bot && (p.eligible || !session)}
                />
                <span
                  className={`w-full truncate text-center text-[11px] ${
                    p.id === me?.memberId ? "font-bold text-[var(--gold)]" : "text-[var(--arena-muted)]"
                  }`}
                >
                  {p.id === me?.memberId ? "You" : p.name.split(" ")[0]}
                </span>
              </li>
            ))}
        </ul>
      </div>

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 pb-64">
        {!session && (
          <NoRoom mode={mode} hostName={state.hostName} homeHref={homeHref} />
        )}

        {session?.status === "lobby" && hostControls}

        {session?.status === "lobby" && (
          <Lobby
            state={state}
            biddersOnline={biddersOnline.length}
            bidders={bidders}
            meEligible={!!me?.eligible}
            mode={mode}
          />
        )}

        {session && (session.status === "live" || session.status === "paused" || session.status === "closed") && (
          <section className="relative mt-4 flex flex-col items-center text-center">
            {session.status === "closed" && leader && (
              <div className="pointer-events-none mb-3 flex justify-center">
                <span className="animate-stamp-slam rounded-xl border-4 border-[var(--ember)] bg-[var(--arena)] px-5 py-0.5 font-[family-name:var(--font-display)] text-4xl font-extrabold tracking-widest text-[var(--ember)] shadow-[0_0_40px_#ff6b3d55]">
                  SOLD!
                </span>
              </div>
            )}

            <span className="text-xs font-semibold tracking-[0.18em] text-[var(--arena-muted)] uppercase">
              {session.currentBid == null ? "Opening bid" : session.status === "closed" ? "Winning bid" : "Current bid"}
            </span>
            <div key={`${session.currentBid}-${shakeKey}`} className={`${shakeKey ? "animate-shake" : ""}`}>
              <p
                key={session.currentBid ?? "none"}
                className={`money gold-text animate-pop mt-1 text-[clamp(3.2rem,16vw,5.5rem)] leading-none font-semibold ${
                  session.currentBid == null ? "opacity-60" : ""
                }`}
              >
                {formatRupees(session.currentBid ?? session.openingBid)}
              </p>
            </div>

            <div className="mt-4 flex min-h-12 items-center justify-center gap-3">
              {leader ? (
                <>
                  <Avatar name={leader.name} size={40} />
                  <div className="text-left">
                    <p className="text-[15px] font-semibold">
                      {leader.id === me?.memberId
                        ? session.status === "closed"
                          ? "You won it!"
                          : "You're winning!"
                        : `${leader.name} ${session.status === "closed" ? "wins" : "is leading"}`}
                    </p>
                    <p className="money text-xs text-[var(--arena-muted)]">
                      Takes home {formatRupees(session.takesHome ?? 0)}
                    </p>
                  </div>
                </>
              ) : (
                <p className="text-[15px] text-[var(--arena-muted)]">
                  {inCountdown ? "Get ready…" : session.status === "paused" ? "Paused" : "Waiting for the first bid — be brave!"}
                </p>
              )}
            </div>

            {/* The fuse */}
            <Fuse
              remainingMs={remainingMs}
              roundSeconds={session.roundSeconds}
              phase={phase}
              status={session.status}
              hasBids={session.bidCount > 0}
            />

            {groupSaving != null && session.status !== "closed" && (
              <p className="mt-3 text-xs text-[var(--arena-muted)]">
                At this bid everyone saves <span className="money font-semibold text-[var(--win)]">{formatRupees(groupSaving)}</span> this month
                {runnerUp ? (
                  <>
                    {" "}·{" "}
                    {runnerUp.id === me?.memberId
                      ? "you get the runner-up bonus"
                      : `${runnerUp.name.split(" ")[0]} gets the runner-up bonus`}
                  </>
                ) : null}
              </p>
            )}

            {session.status === "closed" && (
              <p className="mt-4 rounded-full bg-[var(--arena-raised)] px-4 py-2 text-sm text-[var(--arena-muted)]">
                {mode === "host" ? "Confirm below to record the result" : `Waiting for ${state.hostName} to confirm…`}
              </p>
            )}
          </section>
        )}

        {(session?.status === "live" || session?.status === "paused" || session?.status === "closed") && hostControls}

        {session?.status === "finalized" && <Result state={state} mode={mode} homeHref={homeHref} />}

        {/* Bid feed */}
        {session && session.status !== "lobby" && state.bids.length > 0 && (
          <section className="mt-8">
            <h2 className="mb-2 text-xs font-semibold tracking-[0.18em] text-[var(--arena-muted)] uppercase">
              Bids · {session.bidCount}
            </h2>
            <ol className="arena-card divide-y divide-[var(--arena-line)] overflow-hidden">
              {state.bids.slice(0, 6).map((b, i) => (
                <li
                  key={b.id}
                  className={`flex items-center gap-3 px-4 py-2.5 ${i === 0 ? "animate-feed-in" : "opacity-70"}`}
                >
                  <Avatar name={nameOf(b.memberId)} size={28} />
                  <span className="flex-1 truncate text-sm">
                    {b.memberId === me?.memberId ? "You" : nameOf(b.memberId)}
                  </span>
                  <span className={`money text-sm font-semibold ${i === 0 ? "text-[var(--gold)]" : ""}`}>
                    {formatRupees(b.amount)}
                  </span>
                  <span className="w-10 text-right text-[11px] text-[var(--arena-muted)]">{ago(now - b.at)}</span>
                </li>
              ))}
            </ol>
          </section>
        )}

        {(!session || session.status === "finalized") && hostControls}
      </main>

      {/* Bottom dock: reactions + the button */}
      {session && session.status !== "finalized" && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--arena-line)] bg-[var(--arena)]/92 pb-[max(env(safe-area-inset-bottom),12px)] backdrop-blur">
          <div className="mx-auto max-w-2xl px-4 pt-3">
            <div className="mb-3 flex justify-between gap-1.5">
              {REACTIONS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => sendReaction(e)}
                  className="flex-1 rounded-xl bg-[var(--arena-raised)] py-2 text-xl transition-transform active:scale-90"
                  aria-label={`React ${e}`}
                >
                  {e}
                </button>
              ))}
            </div>
            {mode === "player" && (
              <BidDock
                state={state}
                inCountdown={inCountdown}
                pendingBid={pendingBid}
                onBid={bid}
              />
            )}
          </div>
        </div>
      )}

      {inCountdown && session?.startsAt && <CountdownOverlay ms={session.startsAt - now} />}
      {showHelp && <HowItWorks onClose={() => setShowHelp(false)} state={state} />}
    </Shell>
  );
}

// --- Pieces ------------------------------------------------------------------

function Shell({ children, onPointerDown }: { children: ReactNode; onPointerDown?: () => void }) {
  return (
    <div className="arena-bg flex min-h-dvh flex-col overflow-x-clip" onPointerDown={onPointerDown}>
      {children}
    </div>
  );
}

function StatusPill({ status, inCountdown }: { status: string | null; inCountdown: boolean }) {
  if (status === "live" || inCountdown) {
    return (
      <span className="animate-live-pulse flex items-center gap-1.5 rounded-full bg-[var(--ember)] px-2 py-0.5 text-[11px] font-bold tracking-wider text-white">
        <span className="h-1.5 w-1.5 rounded-full bg-white" /> LIVE
      </span>
    );
  }
  const labels: Record<string, string> = {
    lobby: "LOBBY",
    paused: "PAUSED",
    closed: "SOLD",
    finalized: "DONE",
  };
  if (!status || !labels[status]) return null;
  return (
    <span className="rounded-full border border-[var(--arena-line)] px-2 py-0.5 text-[11px] font-bold tracking-wider text-[var(--arena-muted)]">
      {labels[status]}
    </span>
  );
}

function Fuse({
  remainingMs,
  roundSeconds,
  phase,
  status,
  hasBids,
}: {
  remainingMs: number | null;
  roundSeconds: number;
  phase: ReturnType<typeof clockPhase>;
  status: string;
  hasBids: boolean;
}) {
  const fraction = remainingMs == null ? 1 : Math.max(0, Math.min(1, remainingMs / (roundSeconds * 1000)));
  const secs = remainingMs == null ? roundSeconds : Math.ceil(remainingMs / 1000);
  const urgent = phase === "going-twice";
  const call =
    status === "closed"
      ? "Hammer down"
      : status === "paused"
        ? "Clock paused"
        : !hasBids
          ? "Clock starts on the first bid"
          : phase === "sold"
            ? "Hammer falling…"
            : phase === "going-twice"
              ? "Going twice…"
              : phase === "going-once"
                ? "Going once…"
                : "Bidding open";

  return (
    <div className="mt-7 w-full max-w-sm">
      <div className="mb-2 flex items-baseline justify-between">
        <span
          className={`text-sm font-bold tracking-wide uppercase ${
            urgent && status === "live" ? "text-[var(--ember)]" : "text-[var(--arena-muted)]"
          }`}
        >
          {call}
        </span>
        <span className={`money text-lg font-semibold ${urgent && status === "live" ? "text-[var(--ember)]" : ""}`}>
          {status === "closed" ? "0s" : `${secs}s`}
        </span>
      </div>
      <div className="relative h-3 rounded-full bg-[#1c3325]">
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-100 ease-linear"
          style={{
            width: `${(status === "closed" ? 0 : fraction) * 100}%`,
            background: urgent
              ? "linear-gradient(90deg, #ff3d1f, var(--ember))"
              : "linear-gradient(90deg, var(--gold-deep), var(--gold))",
          }}
        />
        {status === "live" && hasBids && fraction > 0 && (
          <span
            className="animate-spark absolute top-1/2 h-5 w-5 rounded-full"
            style={{
              left: `${fraction * 100}%`,
              background: "radial-gradient(circle, #fff 0%, #ffd978 35%, #ff6b3d88 60%, transparent 70%)",
            }}
            aria-hidden
          />
        )}
      </div>
    </div>
  );
}

function BidDock({
  state,
  inCountdown,
  pendingBid,
  onBid,
}: {
  state: LiveState;
  inCountdown: boolean;
  pendingBid: number | null;
  onBid: (amount: number) => void;
}) {
  const session = state.session!;
  const me = state.me;

  if (!me) return null;

  if (!me.eligible) {
    return (
      <p className="rounded-2xl bg-[var(--arena-raised)] px-4 py-4 text-center text-sm text-[var(--arena-muted)]">
        You&apos;re watching this one 👀 — cheer them on!
      </p>
    );
  }
  if (session.status === "lobby") {
    return (
      <p className="rounded-2xl bg-[var(--arena-raised)] px-4 py-4 text-center text-sm font-semibold">
        You&apos;re in! Bidding opens when {state.hostName} starts.
      </p>
    );
  }
  if (session.status === "closed") {
    return (
      <p className="rounded-2xl bg-[var(--arena-raised)] px-4 py-4 text-center text-sm font-semibold">
        {me.isLeader ? "🎉 You won this round!" : "Bidding closed"}
      </p>
    );
  }
  if (me.isLeader) {
    return (
      <div className="animate-glow rounded-2xl bg-[var(--arena-raised)] px-4 py-4 text-center">
        <p className="text-base font-bold text-[var(--gold)]">👑 You&apos;re on top</p>
        <p className="text-xs text-[var(--arena-muted)]">Hold tight — if the fuse burns out, it&apos;s yours.</p>
      </div>
    );
  }

  const disabled = inCountdown || pendingBid != null || !me.canBid;
  const [first, ...jumps] = session.jumpOptions;
  if (first == null) {
    return (
      <p className="rounded-2xl bg-[var(--arena-raised)] px-4 py-4 text-center text-sm">
        Maximum bid reached
      </p>
    );
  }

  return (
    <div className="flex gap-2">
      <button type="button" className="bid-button flex-1" disabled={disabled} onClick={() => onBid(first)}>
        <span className="block text-[11px] font-bold tracking-[0.18em] uppercase opacity-70">
          {pendingBid ? "Placing…" : session.currentBid == null ? "Open the bidding" : "Tap to bid"}
        </span>
        <span className="money block text-3xl leading-tight font-bold">{formatRupees(first)}</span>
      </button>
      {jumps.length > 0 && (
        <div className="flex w-[34%] flex-col gap-2">
          {jumps.map((a) => (
            <button key={a} type="button" className="chip-button money flex-1" disabled={disabled} onClick={() => onBid(a)}>
              {formatRupees(a)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Lobby({
  state,
  biddersOnline,
  bidders,
  meEligible,
  mode,
}: {
  state: LiveState;
  biddersOnline: number;
  bidders: LiveState["players"];
  meEligible: boolean;
  mode: "player" | "host";
}) {
  const s = state.session!;
  return (
    <section className="mt-6 text-center">
      <p className="text-xs font-semibold tracking-[0.18em] text-[var(--gold)] uppercase">Committee day · Month {s.monthNumber}</p>
      <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl font-semibold">
        {mode === "host" ? "Your room is open" : meEligible ? "You're in the room" : "Welcome to the room"}
      </h1>
      <p className="mt-2 text-sm text-[var(--arena-muted)]">
        Up for grabs: <span className="money font-semibold text-[var(--arena-text)]">{formatRupees(state.committee.pot)}</span>
      </p>

      <div className="arena-card mt-6 grid grid-cols-3 divide-x divide-[var(--arena-line)] py-3">
        <Stat label="Opening" value={formatRupees(s.openingBid)} />
        <Stat label="Step" value={`+${formatRupees(s.bidIncrement)}`} />
        <Stat label="Clock" value={`${s.roundSeconds}s`} />
      </div>

      <div className="mt-8">
        <p className="text-sm font-semibold">
          <span className="money text-2xl text-[var(--win)]">{biddersOnline}</span>
          <span className="text-[var(--arena-muted)]"> of {bidders.length} bidders are here</span>
        </p>
        <ul className="mt-5 grid grid-cols-4 gap-x-2 gap-y-5 sm:grid-cols-6">
          {[...bidders].sort((a, b) => Number(b.online) - Number(a.online)).map((p) => (
            <li key={p.id} className={`flex flex-col items-center gap-1.5 ${p.online ? "animate-pop-in" : ""}`}>
              <Avatar name={p.name} size={52} online={p.online} dim={!p.online} bot={p.bot} />
              <span className={`w-full truncate text-xs ${p.online ? "" : "text-[var(--arena-muted)]"}`}>
                {p.id === state.me?.memberId ? "You" : p.name.split(" ")[0]}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {mode === "player" && (
        <p className="mt-8 flex items-center justify-center gap-2 text-sm text-[var(--arena-muted)]">
          <span className="inline-flex gap-1">
            <Dot delay="0ms" /> <Dot delay="150ms" /> <Dot delay="300ms" />
          </span>
          Waiting for {state.hostName} to start
          {!state.hostOnline && " (not here yet)"}
        </p>
      )}

      <ol className="arena-card mt-8 space-y-3 p-4 text-left text-sm">
        <li className="flex gap-3">
          <span className="text-lg">👆</span>
          <span>
            Tap <b className="text-[var(--gold)]">BID</b> to raise by {formatRupees(s.bidIncrement)} — or jump higher to scare everyone off.
          </span>
        </li>
        <li className="flex gap-3">
          <span className="text-lg">🧨</span>
          <span>Every bid relights the {s.roundSeconds}s fuse. When it burns out — SOLD!</span>
        </li>
        <li className="flex gap-3">
          <span className="text-lg">💰</span>
          <span>
            Highest bid takes home the pot minus their bid. The bid is shared out as everyone&apos;s discount.
          </span>
        </li>
      </ol>
    </section>
  );
}

function Result({ state, mode, homeHref }: { state: LiveState; mode: "player" | "host"; homeHref: string }) {
  const s = state.session!;
  const winner = state.players.find((p) => p.id === s.leaderId);
  const runnerUp = state.players.find((p) => p.id === s.runnerUpId);
  const isMe = winner && winner.id === state.me?.memberId;
  return (
    <section className="mt-6 flex flex-col items-center text-center">
      <p className="text-xs font-semibold tracking-[0.18em] text-[var(--gold)] uppercase">Month {s.monthNumber} · Recorded</p>
      {winner && (
        <div className="animate-pop-in mt-14">
          <Avatar name={winner.name} size={96} crown ring />
        </div>
      )}
      <h1 className="mt-5 font-[family-name:var(--font-display)] text-3xl font-semibold">
        {isMe ? "You won! 🎉" : `${winner?.name ?? "Winner"} wins!`}
      </h1>
      <p className="money gold-text mt-2 text-5xl font-semibold">{formatRupees(s.takesHome ?? 0)}</p>
      <p className="mt-1 text-sm text-[var(--arena-muted)]">
        taken home at a bid of <span className="money">{formatRupees(s.currentBid ?? 0)}</span>
      </p>
      {runnerUp && (
        <p className="mt-4 text-sm text-[var(--arena-muted)]">
          Runner-up: <b className="text-[var(--arena-text)]">{runnerUp.id === state.me?.memberId ? "You" : runnerUp.name}</b> (−
          {formatRupees(state.committee.runnerUpBonus)} bonus)
        </p>
      )}
      {mode === "player" && state.me?.dueThisMonth != null && (
        <div className="arena-card mt-8 w-full max-w-sm p-5">
          <p className="text-xs font-semibold tracking-[0.18em] text-[var(--arena-muted)] uppercase">Your contribution this month</p>
          <p className="money mt-1 text-4xl font-semibold text-[var(--win)]">{formatRupees(state.me.dueThisMonth)}</p>
          <p className="mt-1 text-xs text-[var(--arena-muted)]">
            instead of {formatRupees(state.committee.monthlyContribution)} — pay {state.hostName} by cash or UPI
          </p>
        </div>
      )}
      {mode === "player" && (
        <Link href={homeHref} className="host-button-primary mt-8">
          Back to my passbook
        </Link>
      )}
    </section>
  );
}

function NoRoom({
  mode,
  hostName,
  homeHref,
}: {
  mode: "player" | "host";
  hostName: string;
  homeHref: string;
}) {
  return (
    <section className="mt-12 flex flex-col items-center text-center">
      <span className="text-6xl">🪔</span>
      <h1 className="mt-4 font-[family-name:var(--font-display)] text-2xl font-semibold">
        {mode === "host" ? "No room open" : "No auction right now"}
      </h1>
      <p className="mt-2 max-w-xs text-sm text-[var(--arena-muted)]">
        {mode === "host"
          ? "Open the room below when you're ready - everyone's phone lights up."
          : `${hostName} opens the room on committee day. Keep this page handy - it lights up by itself.`}
      </p>
      {mode === "player" && (
        <Link href={homeHref} className="host-button mt-6">
          Back to my passbook
        </Link>
      )}
    </section>
  );
}

function CountdownOverlay({ ms }: { ms: number }) {
  const n = Math.max(1, Math.ceil(ms / 1000));
  const label = n > 3 ? "Ready?" : String(n);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0b1710]/85 backdrop-blur-sm" aria-live="assertive">
      <span key={label} className="animate-countdown gold-text font-[family-name:var(--font-display)] text-[9rem] leading-none font-extrabold">
        {label}
      </span>
    </div>
  );
}

function HowItWorks({ onClose, state }: { onClose: () => void; state: LiveState }) {
  const s = state.session;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center" onClick={onClose}>
      <div
        className="arena-card animate-slide-down m-3 w-full max-w-md p-6"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="How the auction works"
      >
        <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">How it works</h2>
        <ul className="mt-4 space-y-3 text-sm text-[var(--arena-muted)]">
          <li>🪙 The pot is <b className="text-[var(--arena-text)]">{formatRupees(state.committee.pot)}</b>. Your bid is the discount you give up to take it this month.</li>
          <li>👆 Tap the big gold button to bid the next amount{s ? ` (+${formatRupees(s.bidIncrement)})` : ""}. The side buttons jump higher.</li>
          <li>🧨 Every bid relights the fuse. If nobody beats you before it burns out, you win.</li>
          <li>🥈 The person you beat last is the runner-up and gets {formatRupees(state.committee.runnerUpBonus)} off.</li>
          <li>💸 Everyone&apos;s contribution drops by an equal share of the winning bid.</li>
          <li>👀 Already won a month? You can watch and react, but not bid.</li>
        </ul>
        <button type="button" onClick={onClose} className="host-button-primary mt-6 w-full">
          Got it
        </button>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-2">
      <p className="text-[10px] font-semibold tracking-[0.18em] text-[var(--arena-muted)] uppercase">{label}</p>
      <p className="money mt-0.5 text-base font-semibold">{value}</p>
    </div>
  );
}

function Dot({ delay }: { delay: string }) {
  return (
    <span
      className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--gold)]"
      style={{ animationDelay: delay }}
    />
  );
}

function ago(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.round(s / 60);
  return `${m}m`;
}
