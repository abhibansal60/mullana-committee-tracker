import Link from "next/link";
import { requireAdminByToken } from "@/lib/auth/guard";
import LogoutButton from "./logout-button";
import { isPracticeCommittee } from "@/lib/live/rules";
import { getPracticeParentToken } from "@/lib/live/practice";
import PracticeBanner from "@/components/admin/PracticeBanner";
import AdminNav from "@/components/admin/AdminNav";

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
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-5 py-2">
          <Link
            href={`/admin/${adminToken}`}
            className="flex min-h-11 min-w-0 items-center truncate font-[family-name:var(--font-display)] text-[15px] font-semibold text-spine-foreground"
          >
            {committee.name}
          </Link>
          <div className="flex shrink-0 items-center gap-2">
            <AdminNav adminToken={adminToken} placement="header" />
            <LogoutButton adminToken={adminToken} />
          </div>
        </div>
      </header>
      {practice && <PracticeBanner parentAdminToken={parentAdminToken} />}
      <main className="flex-1 pb-24 sm:pb-10">{children}</main>
      <AdminNav adminToken={adminToken} placement="bottom" />
    </div>
  );
}
