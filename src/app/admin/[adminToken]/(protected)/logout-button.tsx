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
    <button onClick={handleLogout} className="hover:text-[#f2eee2]">
      Log out
    </button>
  );
}
