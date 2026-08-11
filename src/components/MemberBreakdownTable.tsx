import { formatRupees } from "@/lib/money";
import StatusBadge from "./StatusBadge";
import Stamp from "./Stamp";
import type { MemberMonthView } from "@/lib/db/queries";

export default function MemberBreakdownTable({
  members,
  runnerUpBonus,
}: {
  members: MemberMonthView[];
  runnerUpBonus: number;
}) {
  return (
    <ul className="divide-y divide-[var(--border-subtle)]">
      {members.map((m) => (
        <li key={m.memberId} className="ledger-row py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium">{m.memberName}</span>
                {m.role === "winner" && <Stamp tone="brass">Won</Stamp>}
                {m.role === "runnerUp" && (
                  <Stamp tone="carbon">
                    Runner-up &middot; &minus;{formatRupees(runnerUpBonus)}
                  </Stamp>
                )}
              </div>
              <p className="money mt-1 text-[13px] text-[var(--muted)]">
                Owed {formatRupees(m.amountOwed)} &middot; Paid{" "}
                {formatRupees(m.amountPaid)}
              </p>
              {m.payments.length > 0 && (
                <p className="money mt-0.5 text-[13px] text-[var(--muted)]">
                  {m.payments
                    .map(
                      (p) =>
                        `${p.mode === "cash" ? "Cash" : "UPI"} ${formatRupees(p.amount)}`
                    )
                    .join(" + ")}
                </p>
              )}
            </div>
            <StatusBadge status={m.status} />
          </div>
        </li>
      ))}
    </ul>
  );
}
