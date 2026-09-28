import type { Metadata } from "next";
import { requireAdminByToken } from "@/lib/auth/guard";
import {
  committeeTerms,
  getAuctionableMonths,
  getLiveSettings,
  getLiveState,
  isLiveSchemaMissing,
} from "@/lib/live/queries";
import { computeMaxBid, minOpeningBid } from "@/lib/live/rules";
import HostConsole from "@/components/live/HostConsole";
import SchemaMissing from "@/components/live/SchemaMissing";

export const metadata: Metadata = { title: "Auction room · Host" };

export default async function HostLivePage({ params }: PageProps<"/admin/[adminToken]/live">) {
  const { adminToken } = await params;
  const committee = await requireAdminByToken(adminToken);

  let data;
  try {
    data = await Promise.all([
      getLiveState(committee, { kind: "host" }),
      getLiveSettings(committee),
      getAuctionableMonths(committee),
    ]);
  } catch (err) {
    if (!isLiveSchemaMissing(err)) throw err;
  }
  if (!data) return <SchemaMissing backHref={`/admin/${adminToken}`} />;

  const [state, settings, months] = data;
  const terms = committeeTerms(committee);
  return (
    <HostConsole
      adminToken={adminToken}
      initial={state}
      auctionableMonths={months.map((m) => ({ id: m.id, monthNumber: m.monthNumber }))}
      settings={settings}
      maxBid={computeMaxBid(terms)}
      minOpeningBid={minOpeningBid(terms)}
    />
  );
}
