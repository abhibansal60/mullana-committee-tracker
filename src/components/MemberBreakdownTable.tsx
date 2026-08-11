import { formatRupees } from "@/lib/money";
import StatusBadge from "./StatusBadge";
import type { MemberMonthView } from "@/lib/db/queries";

const ROLE_LABELS: Record<MemberMonthView["role"], string> = {
  winner: "Winner",
  runnerUp: "Runner-up (+₹1,000 off)",
  other: "",
};

export default function MemberBreakdownTable({
  members,
  runnerUpBonus,
}: {
  members: MemberMonthView[];
  runnerUpBonus: number;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="text-left text-neutral-500 border-b border-neutral-200 dark:border-neutral-800">
            <th className="py-2 pr-2 font-medium">Member</th>
            <th className="py-2 pr-2 font-medium">Owed</th>
            <th className="py-2 pr-2 font-medium">Paid</th>
            <th className="py-2 pr-2 font-medium">Mode</th>
            <th className="py-2 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {members.map((m) => (
            <tr
              key={m.memberId}
              className="border-b border-neutral-100 dark:border-neutral-900"
            >
              <td className="py-2 pr-2">
                <div>{m.memberName}</div>
                {m.role !== "other" && (
                  <div className="text-xs text-neutral-500">
                    {m.role === "runnerUp"
                      ? `Runner-up (+₹${runnerUpBonus.toLocaleString("en-IN")} off)`
                      : ROLE_LABELS[m.role]}
                  </div>
                )}
              </td>
              <td className="py-2 pr-2">{formatRupees(m.amountOwed)}</td>
              <td className="py-2 pr-2">{formatRupees(m.amountPaid)}</td>
              <td className="py-2 pr-2 text-neutral-500">
                {m.payments.length === 0
                  ? "-"
                  : m.payments
                      .map(
                        (p) =>
                          `${p.mode === "cash" ? "Cash" : "UPI"} ${formatRupees(p.amount)}`
                      )
                      .join(" + ")}
              </td>
              <td className="py-2">
                <StatusBadge status={m.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
