import Link from "next/link";
import { requireAdminByToken } from "@/lib/auth/guard";
import LogoutButton from "./logout-button";

export default async function ProtectedAdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ adminToken: string }>;
}) {
  const { adminToken } = await params;
  const committee = await requireAdminByToken(adminToken);

  return (
    <div className="min-h-full flex flex-col">
      <header className="bg-spine">
        <div className="mx-auto flex max-w-lg items-center justify-between px-5 py-3.5">
          <Link
            href={`/admin/${adminToken}`}
            className="font-[family-name:var(--font-display)] text-[15px] font-semibold text-spine-foreground"
          >
            {committee.name}
          </Link>
          <div className="flex items-center gap-4 text-sm text-spine-muted">
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
      <main className="flex-1">{children}</main>
    </div>
  );
}
