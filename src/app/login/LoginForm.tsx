"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Choice = { memberId: string; memberName: string; committeeName: string };

export default function LoginForm({ next, inviteExpired }: { next: string; inviteExpired: boolean }) {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(
    inviteExpired ? "That invite link has been replaced. Log in with your number, or ask for a fresh link." : null
  );
  const [choices, setChoices] = useState<Choice[] | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function login(memberId?: string) {
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, memberId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Couldn't log you in");
        return;
      }
      if (data.choose) {
        setChoices(data.choose);
        return;
      }
      router.push(next === "live" ? "/play/live" : "/play?welcome=1");
      router.refresh();
    } catch {
      setError("Network error - please try again");
    } finally {
      setSubmitting(false);
    }
  }

  if (choices) {
    return (
      <div className="space-y-3">
        <p className="text-center text-sm text-[var(--arena-muted)]">Your number is in more than one committee:</p>
        {choices.map((c) => (
          <button
            key={c.memberId}
            type="button"
            disabled={submitting}
            onClick={() => login(c.memberId)}
            className="host-button w-full justify-between"
          >
            <span>{c.committeeName}</span>
            <span className="text-[var(--arena-muted)]">as {c.memberName} →</span>
          </button>
        ))}
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        login();
      }}
      className="space-y-4"
    >
      <label className="block">
        <span className="mb-2 block text-xs font-semibold tracking-[0.16em] text-[var(--arena-muted)] uppercase">
          Your WhatsApp number
        </span>
        <div className="flex items-center overflow-hidden rounded-2xl border border-[var(--arena-line)] bg-[var(--arena)] focus-within:border-[var(--gold)]">
          <span className="money border-r border-[var(--arena-line)] px-4 py-4 text-lg text-[var(--arena-muted)]">+91</span>
          <input
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            autoFocus
            required
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="98765 43210"
            className="money w-full bg-transparent px-4 py-4 text-xl tracking-wider text-[var(--arena-text)] outline-none placeholder:text-[#4b5a4f]"
          />
        </div>
      </label>
      {error && (
        <p className="rounded-xl border border-[var(--ember)] bg-[var(--ember)]/15 px-3 py-2.5 text-sm text-[var(--ember)]">
          {error}
        </p>
      )}
      <button type="submit" disabled={submitting} className="host-button-primary w-full py-4 text-base">
        {submitting ? "Checking…" : "Let me in →"}
      </button>
    </form>
  );
}
