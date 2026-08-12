# Committee Tracker

A lightweight tracker for a bidding chit fund ("committee"/"kameti") run among
a group of friends: monthly auction results, cash/UPI payment tracking, and a
per-month ledger. Built for infrequent use (once or twice a month) with two
access levels - a read-only shared link for members, and a PIN-protected
admin link for the committee holder.

## Stack

Next.js (App Router, TypeScript) · Tailwind CSS · Drizzle ORM · Postgres via
[Neon](https://neon.tech) · deployed on Vercel.

## How the money math works

See `src/lib/calc/dues.ts` (`computeMonthDues`) - the single source of truth
for all payout/dues calculations, covered by unit tests in
`src/lib/calc/dues.test.ts`.

- One month per cycle is reserved for the committee holder: no auction, they
  still pay their own contribution in, then take the full pot.
- All other months are auctioned among members who haven't won yet. The
  winner pays their own contribution and receives (pot − their bid). The
  runner-up (second-lowest bidder) gets a flat discount off their
  contribution. The remaining discount splits evenly across everyone else.

## Local development

1. Copy `.env.example` to `.env.local` and fill in:
   - `DATABASE_URL` - a Postgres connection string. Recommended: create a
     free [Neon](https://neon.tech) project and use a dev branch, so local
     dev matches production.
   - `AUTH_SECRET` - 32+ random bytes:
     `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`
   - `SETUP_PASSPHRASE` - any passphrase; required to create a committee via
     `/new` (a crude anti-spam gate, not a real user system).

2. Push the schema to your database:
   ```bash
   npm run db:push
   ```

3. Run the dev server:
   ```bash
   npm run dev
   ```

4. Run tests:
   ```bash
   npm test
   ```

## Creating a committee

Visit `/new`, enter the setup passphrase, and fill in the committee terms and
member list. On success you'll see two links **once**:

- **Admin link** (`/admin/<token>`) - give this only to the committee holder.
  It's protected by a PIN set during setup.
- **Read-only link** (`/c/<token>`) - share this with all other members.

Save both immediately; the admin link is not shown again (though it can be
recovered by anyone with database access - there's no "forgot admin link"
flow in v1).

## Deploying

1. Create a Neon project for production, grab its connection string.
2. Push this repo to GitHub, import it into Vercel.
3. Set `DATABASE_URL`, `AUTH_SECRET`, `SETUP_PASSPHRASE` in the Vercel
   project's environment variables.
4. Run `npm run db:migrate` against the production `DATABASE_URL` (or apply
   migrations as part of the build step) before first use.
5. Visit `/new` on the deployed URL to create the real committee.

## Out of scope for v1

Live in-app bidding (auctions happen on WhatsApp, results are recorded
after), notifications/reminders, late-payment penalties/interest, edit
audit history, per-person member links.
