Use the `frontend-design` skill to redesign the UI of this app. Read the skill first, then follow its brainstorm → plan → critique → build → critique process before writing any code.

## What this app is

`mullana-committee-tracker` (repo: this directory, deployed at https://mullana-committee-tracker.vercel.app) is a tracker for a real, currently-running bidding chit fund ("committee"/"kameti") among 12 friends in India. One friend (the holder) runs a monthly auction over WhatsApp; the app records who won, the bid, the runner-up, and each member's cash/UPI payments, and shows a running per-month ledger. It's real money, real friends, used maybe once or twice a month (auction day, collection days) — not a daily-use product.

Two audiences, two very different needs:
- **11 members**: a single shared read-only link (`/c/[memberToken]`). They check it occasionally to see who won, what they owe, whether they've paid. No login friction, no clutter — glanceable trust.
- **1 holder**: a PIN-protected admin link (`/admin/[adminToken]`). They use it actively on auction day and collection days to record results and log payments. This surface needs to be fast and unambiguous under real transactional pressure (they're doing this while people are messaging them cash/UPI confirmations).

The current UI is functional but purely default Tailwind utility classes — flat gray borders, no type scale, no personality, indistinguishable from a scaffolding tutorial. That's the problem to fix. The money math and data model are correct and already verified against real recorded auctions — do not touch `src/lib/calc/`, `src/lib/db/`, `src/lib/auth/`, or any `route.ts` API handler logic. This is a presentation-layer redesign: layouts, components, Tailwind config/tokens, typography, copy. If a page needs new data to support a better layout, it's fine to reshape what a server component queries/passes down, but the underlying calculation and auth functions are off-limits.

## Ground it in the actual subject, not a generic dashboard

Before defaulting to a shadcn-admin-template look: this is a *kameti*, a specific, old, trust-based financial ritual with its own vernacular — the pot, the bid, the auction, the passbook/ledger tradition many Indian committees still track by hand, the WhatsApp group as the real social venue this app is a companion to. Real competitors worth glancing at for how they've handled this exact domain (don't copy, but notice what they get right/wrong): the "Kameti – Chit Fund Manager" and "Golak" apps on the Play Store, the "Committee" ROSCA app (committee-app.com), and this Behance case study: https://www.behance.net/gallery/179149089/chit-fund-application-UI-design. For general clarity/hierarchy patterns in financial ledger UIs (not to copy the look, just the discipline), Mercury and Ramp's dashboards and the shadcn/ui admin ecosystem (e.g. https://github.com/satnaing/shadcn-admin) are reasonable references for restraint and information density done well.

Per the skill's own calibration notes: avoid the three generic-AI-design defaults (cream/serif/terracotta; near-black/neon-accent; broadsheet/hairline-newspaper) unless you have a specific reason tied to this brief. This app's real texture — a monthly auction among friends, rupee amounts, a ledger that builds up over 12 months, one person (the holder) acting almost like a scorekeeper — should suggest its own direction rather than reaching for a fintech-SaaS template.

## Constraints

- **Stack**: Next.js App Router, TypeScript, Tailwind CSS v4 (already configured, `@theme inline` in `src/app/globals.css`). Stay on Tailwind; don't introduce a component library or CSS-in-JS unless you have a strong reason and say so explicitly.
- **Mobile-first**: links are shared and opened via WhatsApp, almost always on a phone. Every view must work at narrow widths before it matters on desktop.
- **Light/dark**: the app currently respects `prefers-color-scheme`. Preserve that (or make a deliberate, stated choice to commit to one mode — but say so).
- **Accessibility floor**: visible keyboard focus, respect `prefers-reduced-motion`, sufficient contrast on real rupee figures (money should never be low-contrast).
- **Real production data**: there's a real committee live in the database right now (real names, a real recorded auction). Don't run destructive scripts against it. Work in a branch, verify with `npm run dev` against `.env.local` (already configured), and don't `git push` to `main` without the user's OK.
- **Don't break what's tested**: `npm test`, `npx tsc --noEmit`, and `npx eslint .` must stay clean. The 29 tests in `src/lib/calc/dues.test.ts` encode the actual payout formula, verified against a real auction — they are the source of truth for the numbers, not a UI concern, but any UI change that touches how those numbers are displayed should still show the exact figures those tests assert.

## Pages in scope

1. `/new` — committee setup wizard (currently a long flat form)
2. `/admin/[adminToken]` — holder's dashboard (members list, monthly log)
3. `/admin/[adminToken]/months/[monthId]` — record auction result / log payments (the highest-pressure screen, used in real time while collecting money)
4. `/admin/[adminToken]/settings`
5. `/admin/[adminToken]/login` — PIN entry
6. `/c/[memberToken]` — read-only member dashboard
7. `/c/[memberToken]/months/[monthId]` — read-only month breakdown

Shared components worth designing once and reusing: `MemberBreakdownTable`, `StatusBadge`, the auction/payment forms.

## Process

Follow the skill exactly: brainstorm a compact token system (color as 4–6 named hex values, type pairing, layout concept with ASCII wireframes, one signature element), critique it against this brief and revise anything that reads as generic, then build. Take one real aesthetic risk you can justify from the subject matter. Screenshot your own work as you go and critique it before calling it done.

## Definition of done

- All pages in scope redesigned and consistent with each other (shared tokens, not seven different spacing systems).
- `npm test`, `npx tsc --noEmit`, `npx eslint .` all clean.
- Verified in a real browser (dev server) at mobile width and desktop width, both color schemes.
- Work committed on a feature branch (not `main`), pushed, ready for review — not merged.
