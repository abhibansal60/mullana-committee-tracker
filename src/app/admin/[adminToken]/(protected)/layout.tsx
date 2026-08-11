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
      <header className="border-b border-neutral-200 dark:border-neutral-800">
        <div className="mx-auto max-w-lg px-6 py-3 flex items-center justify-between">
          <Link href={`/admin/${adminToken}`} className="font-medium text-sm">
            {committee.name}
          </Link>
          <div className="flex items-center gap-4 text-sm">
            <Link href={`/admin/${adminToken}/settings`} className="text-neutral-500">
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
