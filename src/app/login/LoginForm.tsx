"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type Choice = { memberId: string; memberName: string; committeeName: string };

export default function LoginForm({
  next,
  initialError,
  googleHref,
  googleChoices,
}: {
  next: string;
  initialError: string | null;
  googleHref: string | null; // null while Google sign-in is off
  googleChoices: Choice[] | null; // Google account linked to several committees
}) {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(initialError);
  const [choices, setChoices] = useState<Choice[] | null>(googleChoices);
  const [submitting, setSubmitting] = useState(false);

  async function login(memberId?: string) {
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(googleChoices ? { google: true, memberId } : { phone, memberId }),
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
        <p className="text-center text-sm text-[var(--arena-muted)]">
          {googleChoices ? "Your Google account is in more than one committee:" : "Your number is in more than one committee:"}
        </p>
        {error && <p className="text-center text-sm text-[var(--ember)]">{error}</p>}
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
      {googleHref && (
        <>
          <GoogleButton href={googleHref} />
          <p className="text-center text-xs tracking-[0.16em] text-[var(--arena-muted)] uppercase">or use your number</p>
        </>
      )}
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
            autoFocus={!googleHref}
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
      <button
        type="submit"
        disabled={submitting}
        className={`${googleHref ? "host-button" : "host-button-primary"} w-full py-4 text-base`}
      >
        {submitting ? "Checking…" : "Let me in →"}
      </button>
    </form>
  );
}

export function GoogleButton({ href }: { href: string }) {
  return (
    <a href={href} className="host-button-primary w-full gap-3 py-4 text-base">
      <svg aria-hidden="true" viewBox="0 0 48 48" className="h-5 w-5 rounded-full bg-white p-0.5">
        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
      </svg>
      Continue with Google
    </a>
  );
}
