"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ICONS = {
  home: "M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z",
  players:
    "M16 19v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 17.5V19M10 10.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6M20 19v-1.5a3.5 3.5 0 0 0-2.5-3.35M15 4.6a3 3 0 0 1 0 5.8",
  live: "M12 3v2M5.6 5.6l1.4 1.4M3 12h2M18.4 5.6 17 7M21 12h-2M8 19h8M9 16a4 4 0 1 1 6 0l-1 1v2h-4v-2z",
  settings:
    "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1",
};

const ITEMS = [
  { key: "home", label: "Home", path: "" },
  { key: "players", label: "Players", path: "/players" },
  { key: "live", label: "Live", path: "/live" },
  { key: "settings", label: "Settings", path: "/settings" },
] as const;

/**
 * The admin's four places. Phones get a bottom tab bar (thumb reach); wider
 * screens get the same items as tabs in the header.
 */
export default function AdminNav({ adminToken, placement }: { adminToken: string; placement: "bottom" | "header" }) {
  const pathname = usePathname();
  const base = `/admin/${adminToken}`;
  const active = ITEMS.find((i) => i.path && pathname.startsWith(base + i.path))?.key ?? "home";

  if (placement === "header") {
    return (
      <nav aria-label="Committee" className="hidden items-center gap-1 sm:flex">
        {ITEMS.map((i) => (
          <Link
            key={i.key}
            href={base + i.path}
            aria-current={active === i.key ? "page" : undefined}
            className={`rounded-md px-3 py-2 text-[13px] font-medium transition-colors ${
              active === i.key
                ? "bg-[var(--spine-border)] text-spine-foreground"
                : i.key === "live"
                  ? "text-[var(--gold)] hover:text-spine-foreground"
                  : "text-spine-muted hover:text-spine-foreground"
            }`}
          >
            {i.label}
          </Link>
        ))}
      </nav>
    );
  }

  return (
    <nav
      aria-label="Committee"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--gold-deep)]/40 bg-spine pb-[env(safe-area-inset-bottom)] sm:hidden"
    >
      <ul className="mx-auto grid max-w-lg grid-cols-4">
        {ITEMS.map((i) => {
          const on = active === i.key;
          return (
            <li key={i.key}>
              <Link
                href={base + i.path}
                aria-current={on ? "page" : undefined}
                className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold ${
                  on ? "text-[var(--gold)]" : "text-spine-muted"
                }`}
              >
                <svg
                  viewBox="0 0 24 24"
                  aria-hidden
                  className="h-[22px] w-[22px]"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={on ? 2.1 : 1.7}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d={ICONS[i.key]} />
                </svg>
                {i.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
