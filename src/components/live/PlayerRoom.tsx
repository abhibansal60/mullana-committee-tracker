"use client";

import type { LiveState } from "@/lib/live/queries";
import LiveRoom from "./LiveRoom";

export default function PlayerRoom({ initial }: { initial: LiveState }) {
  return (
    <LiveRoom
      mode="player"
      endpoint="/api/play/state"
      bidEndpoint="/api/play/bid"
      initial={initial}
      homeHref="/play"
      react={async (emoji) => {
        await fetch("/api/play/react", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ emoji }),
        });
      }}
    />
  );
}
