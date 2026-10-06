import Link from "next/link";
import { requireAdminByToken } from "@/lib/auth/guard";
import LogoutButton from "./logout-button";
import { isPracticeCommittee } from "@/lib/live/rules";
import { getPracticeParentToken } from "@/lib/live/practice";
import PracticeBanner from "@/components/admin/PracticeBanner";

export default async function ProtectedAdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ adminToken: string }>;
}) {
  const { adminToken } = await params;
  const committee = await requireAdminByToken(adminToken);
  const practice = isPracticeCommittee(committee);
  const parentAdminToken = practice ? await getPracticeParentToken(committee) : null;

  return (
    <div className="min-h-full flex flex-col">
      <header className="border-b border-[var(--gold-deep)]/40 bg-spine">
        <div className="mx-auto flex max-w-lg items-center justify-between gap-3 px-5 py-3.5">
          <Link
            href={`/admin/${adminToken}`}
            className="min-w-0 truncate font-[family-name:var(--font-display)] text-[15px] font-semibold text-spine-foreground"
          >
            {committee.name}
          </Link>
          <div className="flex shrink-0 items-center gap-3 text-[13px] whitespace-nowrap text-spine-muted">
            <Link
              href={`/admin/${adminToken}/live`}
              className="font-semibold text-[var(--gold)] hover:text-spine-foreground"
            >
              Live
            </Link>
            <Link
              href={`/admin/${adminToken}/players`}
              className="hover:text-spine-foreground"
            >
              Players
            </Link>
            <Link
              href={`/admin/${adminToken}/settings`}
              className="hover:text-spine-foreground"
            >
              Settings
            </Link>
            <LogoutButton adminToken={adminToken} />
          </div>
        </div>
      </header>
      {practice && <PracticeBanner parentAdminToken={parentAdminToken} />}
      <main className="flex-1">{children}</main>
    </div>
  );
}
