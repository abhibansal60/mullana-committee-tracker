"use client";

import { useEffect, useState } from "react";
import type { LiveState } from "@/lib/live/queries";
import LiveRoom from "./LiveRoom";
import HostPanel, { type HostSettings } from "./HostPanel";
import PracticeBar from "./PracticeBar";

const BOTS_KEY = "practice-bots";

export default function HostConsole({
  adminToken,
  initial,
  auctionableMonths,
  settings,
  maxBid,
  minOpeningBid,
  practice,
  parentAdminToken,
}: {
  adminToken: string;
  initial: LiveState;
  auctionableMonths: { id: string; monthNumber: number }[];
  settings: HostSettings;
  maxBid: number;
  minOpeningBid: number;
  practice: boolean;
  parentAdminToken: string | null;
}) {
  const [bots, setBots] = useState(true);

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage is only readable after mount
      if (window.localStorage.getItem(BOTS_KEY) === "0") setBots(false);
    } catch {
      // private mode - keep the default
    }
  }, []);

  function changeBots(on: boolean) {
    setBots(on);
    try {
      window.localStorage.setItem(BOTS_KEY, on ? "1" : "0");
    } catch {
      // not remembered - fine
    }
  }

  const base = `/api/committees/${adminToken}/live`;
  return (
    <LiveRoom
      mode="host"
      endpoint={practice && bots ? `${base}?bots=1` : base}
      initial={initial}
      homeHref={`/admin/${adminToken}`}
      react={async (emoji) => {
        await fetch(base, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "react", emoji }),
        });
      }}
      hostSlot={(p) => (
        <>
          <HostPanel
            {...p}
            adminToken={adminToken}
            auctionableMonths={auctionableMonths}
            settings={settings}
            maxBid={maxBid}
            minOpeningBid={minOpeningBid}
          />
          {practice && (
            <PracticeBar state={p.state} bots={bots} onBotsChange={changeBots} parentAdminToken={parentAdminToken} />
          )}
        </>
      )}
    />
  );
}
