"use client";

import { useRouter } from "next/navigation";

export default function LogoutButton({ adminToken }: { adminToken: string }) {
  const router = useRouter();

  async function handleLogout() {
    await fetch(`/api/committees/${adminToken}/logout`, { method: "POST" });
    router.push(`/admin/${adminToken}/login`);
    router.refresh();
  }

  return (
    <button onClick={handleLogout} className="min-h-11 rounded-md px-2 text-[13px] text-spine-muted hover:text-spine-foreground">
      Log out
    </button>
  );
}
