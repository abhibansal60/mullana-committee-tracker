import Link from "next/link";
import type { Committee } from "@/lib/db/queries";
import { getAuctionableMonths, getOpenSession, isLiveSchemaMissing } from "@/lib/live/queries";

const STATUS_COPY: Record<string, string> = {
  lobby: "Room open — people are joining",
  live: "Bidding is LIVE",
  paused: "Bidding paused",
  closed: "Sold — confirm the result",
};

/** The holder's entry point to the live auction room, top of the dashboard. */
export default async function CommitteeDayCard({
  committee,
  adminToken,
}: {
  committee: Committee;
  adminToken: string;
}) {
  let open;
  let nextMonthNumber: number | null = null;
  try {
    open = await getOpenSession(committee.id);
    if (!open) nextMonthNumber = (await getAuctionableMonths(committee))[0]?.monthNumber ?? null;
  } catch (err) {
    if (isLiveSchemaMissing(err)) {
      return (
        <section className="card border-dashed p-4 text-sm text-[var(--muted)]">
          Live auction room is ready to switch on — it needs a one-time database update (
          <code className="money">npm run db:push</code>).
        </section>
      );
    }
    throw err;
  }

  if (!open && nextMonthNumber == null) return null;

  return (
    <Link
      href={`/admin/${adminToken}/live`}
      className="arena-bg block overflow-hidden rounded-2xl p-5 shadow-lg transition-transform active:scale-[0.99]"
    >
      <span className="flex items-center gap-2 text-xs font-semibold tracking-[0.18em] text-[var(--gold)] uppercase">
        {open && (
          <span className="animate-live-pulse h-2 w-2 rounded-full bg-[var(--ember)]" aria-hidden />
        )}
        Committee day
      </span>
      <span className="mt-1.5 block font-[family-name:var(--font-display)] text-2xl font-semibold">
        {open ? STATUS_COPY[open.status] : `Ready for Month ${nextMonthNumber}?`}
      </span>
      <span className="mt-1 block text-sm text-[var(--arena-muted)]">
        {open
          ? "Tap to open the host console."
          : "Open the live auction room — everyone bids from their phone."}
      </span>
      <span className="bid-button mt-4 block py-3 text-center text-base">
        {open ? "Go to the room →" : "🔔 Start committee day"}
      </span>
    </Link>
  );
}
