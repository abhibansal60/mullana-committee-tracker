import type { Committee } from "@/lib/db/queries";
import { getPracticeCommittee } from "@/lib/live/practice";

/** Real dashboard's door into the practice room. */
export default async function PracticeCard({
  committee,
  adminToken,
  justDeleted,
}: {
  committee: Committee;
  adminToken: string;
  justDeleted: boolean;
}) {
  const practice = await getPracticeCommittee(committee);
  return (
    <section className="card border-dashed p-5">
      <span className="eyebrow">🧪 Practice room</span>
      <p className="mt-1.5 text-sm text-[var(--muted)]">
        Rehearse committee day on a copy of this committee — bots fill the empty seats, friends can
        join with their number, and nothing touches the real bids, dues or payments.
      </p>
      {justDeleted && <p className="mt-2 text-sm text-[var(--cloth)]">Practice room deleted.</p>}
      <div className="mt-4 flex flex-wrap gap-2">
        {/* Plain links: these hit a route handler that sets cookies and redirects. */}
        <a href={`/admin/${adminToken}/practice`} className="btn-primary">
          {practice ? "Open practice room" : "Create practice room"}
        </a>
        {practice && (
          <>
            <a href={`/admin/${adminToken}/practice?reset=1`} className="btn-secondary">
              Reset
            </a>
            <a href={`/admin/${adminToken}/practice?delete=1`} className="btn-danger">
              Delete
            </a>
          </>
        )}
      </div>
    </section>
  );
}
