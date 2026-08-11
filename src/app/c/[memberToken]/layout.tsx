import Link from "next/link";
import { requireMemberByToken } from "@/lib/auth/guard";
import Stamp from "@/components/Stamp";

export default async function MemberLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ memberToken: string }>;
}) {
  const { memberToken } = await params;
  const committee = await requireMemberByToken(memberToken);

  return (
    <div className="min-h-full flex flex-col">
      <header className="border-b border-[var(--border-subtle)]">
        <div className="mx-auto flex max-w-lg items-center justify-between px-5 py-3.5">
          <Link
            href={`/c/${memberToken}`}
            className="font-[family-name:var(--font-display)] text-[15px] font-semibold"
          >
            {committee.name}
          </Link>
          <Stamp tone="muted">Read-only</Stamp>
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
