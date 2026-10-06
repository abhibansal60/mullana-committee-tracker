import type { Metadata } from "next";
import { requireAdminByToken } from "@/lib/auth/guard";
import { committeeTerms } from "@/lib/db/queries";
import {
  getAuctionableMonths,
  getLiveSettings,
  getLiveState,
  isLiveSchemaMissing,
} from "@/lib/live/queries";
import { computeMaxBid, isPracticeCommittee, minOpeningBid } from "@/lib/live/rules";
import { getPracticeParentToken } from "@/lib/live/practice";
import HostConsole from "@/components/live/HostConsole";
import SchemaMissing from "@/components/live/SchemaMissing";

export const metadata: Metadata = { title: "Auction room · Host" };

export default async function HostLivePage({ params, searchParams }: PageProps<"/admin/[adminToken]/live">) {
  const { adminToken } = await params;
  const { parent } = await searchParams;
  const committee = await requireAdminByToken(adminToken);
  const practice = isPracticeCommittee(committee);
  const parentAdminToken = practice
    ? await getPracticeParentToken(committee, typeof parent === "string" ? parent : undefined)
    : null;

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
      practice={practice}
      parentAdminToken={parentAdminToken}
    />
  );
}
