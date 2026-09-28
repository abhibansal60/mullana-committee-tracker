"use client";

import { useRouter } from "next/navigation";

export default function LogoutLink() {
  const router = useRouter();
  return (
    <button
      type="button"
      className="text-xs text-spine-muted hover:text-spine-foreground"
      onClick={async () => {
        if (!window.confirm("Log out on this phone?")) return;
        await fetch("/api/logout", { method: "POST" });
        router.push("/login");
        router.refresh();
      }}
    >
      Log out
    </button>
  );
}
