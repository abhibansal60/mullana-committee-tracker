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
    <section className="card border-dashed p-4">
      <span className="eyebrow">🧪 Practice room</span>
      <p className="mt-1 text-sm text-[var(--muted)]">
        Rehearse on a copy of this committee. Bots fill empty seats; nothing touches real bids,
        dues or payments.
      </p>
      {justDeleted && <p className="mt-2 text-sm text-[var(--cloth)]">Practice room deleted.</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        {/* Plain links: these hit a route handler that sets cookies and redirects. */}
        <a href={`/admin/${adminToken}/practice`} className="btn-primary min-h-11">
          {practice ? "Open practice room" : "Create practice room"}
        </a>
        {practice && (
          <>
            <a href={`/admin/${adminToken}/practice?reset=1`} className="btn-secondary min-h-11">
              Reset
            </a>
            <a href={`/admin/${adminToken}/practice?delete=1`} className="btn-danger min-h-11">
              Delete
            </a>
          </>
        )}
      </div>
    </section>
  );
}
