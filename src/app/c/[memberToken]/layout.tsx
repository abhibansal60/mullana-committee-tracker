import Link from "next/link";
import { requireMemberByToken } from "@/lib/auth/guard";

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
      <header className="border-b border-neutral-200 dark:border-neutral-800">
        <div className="mx-auto max-w-lg px-6 py-3 flex items-center justify-between">
          <Link href={`/c/${memberToken}`} className="font-medium text-sm">
            {committee.name}
          </Link>
          <span className="text-xs rounded-full border border-neutral-300 px-2 py-0.5 text-neutral-500">
            Read-only
          </span>
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
