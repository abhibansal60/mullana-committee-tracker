"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SwitchCommittee({
  options,
}: {
  options: { memberId: string; label: string; primary?: boolean }[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  if (options.length === 0) return null;

  async function go(memberId: string) {
    setBusy(memberId);
    try {
      const res = await fetch("/api/play/switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId }),
      });
      if (res.ok) router.refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o.memberId}
          type="button"
          disabled={!!busy}
          onClick={() => go(o.memberId)}
          className={o.primary ? "btn-primary w-full" : "btn-secondary text-xs"}
        >
          {busy === o.memberId ? "Switching…" : o.label}
        </button>
      ))}
    </div>
  );
}
