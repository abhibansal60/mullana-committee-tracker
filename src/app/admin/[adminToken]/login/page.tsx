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
    <main className="mx-auto max-w-xs p-6 pt-24">
      <h1 className="text-lg font-semibold mb-4">Enter admin PIN</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="password"
          inputMode="numeric"
          autoFocus
          required
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          className="input text-center text-lg tracking-widest"
          placeholder="••••"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-md bg-neutral-900 text-white py-2 text-sm disabled:opacity-50"
        >
          {submitting ? "Checking..." : "Unlock"}
        </button>
      </form>
    </main>
  );
}
