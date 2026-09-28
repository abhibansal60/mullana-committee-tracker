"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function JoinPicker({ code, members }: { code: string; members: { id: string; name: string }[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function pick(memberId: string) {
    setBusy(memberId);
    setError(null);
    try {
      const res = await fetch("/api/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, memberId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Couldn't join");
        if (res.status === 409) router.refresh(); // someone took that name: show the fresh list
        return;
      }
      router.push("/play?welcome=1");
      router.refresh();
    } catch {
      setError("Network error - please try again");
    } finally {
      setBusy(null);
    }
  }

  if (members.length === 0) {
    return (
      <p className="text-center text-sm text-[var(--arena-muted)]">
        Every name has been taken. If yours is wrong or taken by mistake, ask the holder to reset it.
      </p>
    );
  }

  return (
    <div className="space-y-2.5">
      {error && (
        <p className="rounded-xl border border-[var(--ember)] bg-[var(--ember)]/15 px-3 py-2.5 text-sm text-[var(--ember)]">{error}</p>
      )}
      {members.map((m) => (
        <button key={m.id} type="button" disabled={!!busy} onClick={() => pick(m.id)} className="host-button w-full justify-between">
          <span>{m.name}</span>
          <span className="text-[var(--arena-muted)]">{busy === m.id ? "Joining…" : "That's me →"}</span>
        </button>
      ))}
      <p className="pt-1 text-center text-xs text-[var(--arena-muted)]">Pick your own name — the holder can see who picked what.</p>
    </div>
  );
}
