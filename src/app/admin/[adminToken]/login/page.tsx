"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLoginPage({
  params,
}: {
  params: Promise<{ adminToken: string }>;
}) {
  const { adminToken } = use(params);
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/committees/${adminToken}/auth`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Login failed");
        return;
      }
      router.push(`/admin/${adminToken}`);
      router.refresh();
    } catch {
      setError("Network error - please try again");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center bg-spine px-6 py-16">
      <div className="w-full max-w-xs">
        <span className="block text-center font-mono text-xs font-semibold uppercase tracking-[0.08em] text-spine-muted">
          Admin
        </span>
        <h1 className="mt-1.5 text-center font-[family-name:var(--font-display)] text-2xl font-semibold text-spine-foreground">
          Enter your PIN
        </h1>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <input
            type="password"
            inputMode="numeric"
            autoFocus
            required
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            className="w-full rounded-md border border-spine-border bg-spine-strong px-3 py-3 text-center text-2xl tracking-[0.5em] text-spine-foreground outline-none focus-visible:border-[var(--cloth)]"
            placeholder="••••"
          />
          {error && (
            <p className="rounded-md border border-spine-danger bg-spine-danger-tint p-2.5 text-center text-sm text-spine-danger">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-md bg-spine-foreground py-2.5 text-sm font-medium text-spine transition-colors hover:opacity-90 disabled:opacity-50"
          >
            {submitting ? "Checking…" : "Unlock"}
          </button>
        </form>
      </div>
    </main>
  );
}
