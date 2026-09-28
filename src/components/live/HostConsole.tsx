"use client";

import type { LiveState } from "@/lib/live/queries";
import LiveRoom from "./LiveRoom";
import HostPanel, { type HostSettings } from "./HostPanel";

export default function HostConsole({
  adminToken,
  initial,
  auctionableMonths,
  settings,
  maxBid,
  minOpeningBid,
}: {
  adminToken: string;
  initial: LiveState;
  auctionableMonths: { id: string; monthNumber: number }[];
  settings: HostSettings;
  maxBid: number;
  minOpeningBid: number;
}) {
  return (
    <LiveRoom
      mode="host"
      endpoint={`/api/committees/${adminToken}/live`}
      initial={initial}
      homeHref={`/admin/${adminToken}`}
      react={async (emoji) => {
        await fetch(`/api/committees/${adminToken}/live`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "react", emoji }),
        });
      }}
      hostSlot={(p) => (
        <HostPanel
          {...p}
          adminToken={adminToken}
          auctionableMonths={auctionableMonths}
          settings={settings}
          maxBid={maxBid}
          minOpeningBid={minOpeningBid}
        />
      )}
    />
  );
}
