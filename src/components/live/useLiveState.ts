"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { LiveState } from "@/lib/live/queries";

function pollDelay(state: LiveState | null, hidden: boolean): number {
  if (hidden) return 6000;
  switch (state?.session?.status) {
    case "live":
      return 900;
    case "lobby":
    case "paused":
    case "closed":
      return 1500;
    default:
      return 4000;
  }
}

/**
 * Keeps the room in sync by polling - simple, works on every serverless
 * host and every flaky mobile network. Also estimates the server clock
 * offset (from the fastest round trip seen) so every phone shows the same
 * countdown.
 */
export function useLiveState(endpoint: string, initial: LiveState | null) {
  const [state, setState] = useState<LiveState | null>(initial);
  const [connection, setConnection] = useState<"ok" | "flaky" | "lost">("ok");
  const [authLost, setAuthLost] = useState(false);
  // Refined from the first poll's round trip; until then assume clocks agree.
  const offsetRef = useRef(0);
  const bestRttRef = useRef(Infinity);
  const failuresRef = useRef(0);
  const stateRef = useRef(state);
  const inFlightRef = useRef(false);
  const lastVersionRef = useRef(-1);

  const accept = useCallback((next: LiveState, rtt?: number, sentAt?: number) => {
    if (rtt !== undefined && sentAt !== undefined && rtt <= bestRttRef.current * 1.5) {
      bestRttRef.current = Math.min(bestRttRef.current, rtt);
      offsetRef.current = next.serverNow - (sentAt + rtt / 2);
    }
    stateRef.current = next;
    lastVersionRef.current = next.session?.version ?? -1;
    setState(next);
  }, []);

  const refresh = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    const sentAt = Date.now();
    try {
      const res = await fetch(endpoint, { cache: "no-store" });
      if (res.status === 401) {
        setAuthLost(true);
        return;
      }
      if (!res.ok) throw new Error(String(res.status));
      const next = (await res.json()) as LiveState;
      accept(next, Date.now() - sentAt, sentAt);
      failuresRef.current = 0;
      setConnection("ok");
    } catch {
      failuresRef.current += 1;
      setConnection(failuresRef.current >= 4 ? "lost" : "flaky");
    } finally {
      inFlightRef.current = false;
    }
  }, [endpoint, accept]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    let cancelled = false;
    const loop = async () => {
      await refresh();
      if (cancelled) return;
      const backoff = failuresRef.current > 0 ? Math.min(8000, 1000 * 2 ** failuresRef.current) : 0;
      timer = setTimeout(loop, Math.max(backoff, pollDelay(stateRef.current, document.hidden)));
    };
    loop();
    const onVisible = () => {
      if (!document.hidden) {
        clearTimeout(timer);
        loop();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  const serverNow = useCallback(() => Date.now() + offsetRef.current, []);

  return { state, accept, refresh, serverNow, connection, authLost };
}

/** Re-renders every `ms` while `active` - drives the countdown. */
export function useTicker(active: boolean, ms = 100) {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setTick((t) => t + 1), ms);
    return () => clearInterval(id);
  }, [active, ms]);
}
