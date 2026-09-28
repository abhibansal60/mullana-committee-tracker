# Committee Tracker

A lightweight tracker for a bidding chit fund ("committee") run among
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

## Committee Day: the live auction room

Members join once with Google (valid for the whole committee year) and
bid live from the app on auction day.

**Holder flow** (admin link):
1. **Players** tab - share the one join link on WhatsApp. Each member signs
   in with Google and picks their own name (taken names disappear from the
   list). You see who joined and with which Google account, can fix a name,
   and **Reset** a member to unlink them. Members who never join can still
   take part: during live bidding, **Bid for a member** places a bid as them.
2. **Live** tab (or the "Committee day" card on the dashboard) - pick the
   month, check the opening bid / minimum raise / fuse length, and **Open
   the auction room**. Members' home screens light up and they drop into a
   lobby where everyone can see who's joined.
3. **Start bidding** - a 3-2-1 countdown, then bidding opens. Host controls:
   pause/resume, +10s, SOLD now, undo last bid (mistaken taps), cancel.
4. When the fuse burns out it's SOLD. **Confirm & record** writes the
   winner, bid and runner-up into the month exactly as the manual auction
   form would; payments are collected from the dashboard as before.

**Practice room**: the dashboard's "🧪 Practice room" card makes a
throwaway copy of the committee (members, numbers, settings and results so
far; no payments) at its own admin link, and signs the holder straight in.
Bots play every seat nobody has logged into - they bid while the host
console is open with "Bots" ticked, then fold so the fuse burns out.
Friends can join with their number and pick the practice committee at
login (or switch from their home screen). "Reset" wipes and recreates it at
the same link; nothing in it can touch the real committee. No extra
tables: the copy's admin token is derived from the real committee id with
`AUTH_SECRET` (`src/lib/live/practice.ts`).

**Member flow**: `/login` with their number (or tap the personal link) →
`/play` is their passbook (season track, what they owe, winners so far) →
`/play/live` is the room: one big gold button bids the next amount, side
buttons jump higher, every bid relights the fuse, emoji reactions float
across everyone's screen, sounds/haptics for bids, outbids and the hammer.
Members who've already won (and the holder) watch and react but can't bid.
Profit/loss is never shown in the member experience.

**Rules** live in `src/lib/live/rules.ts` (tested): bids are the discount,
in steps of ₹500, from the opening bid up to the largest bid
`computeMonthDues` accepts; the runner-up is the last person the winner
outbid. Bids are placed with a single conditional SQL statement, so two
people tapping at the same instant can't both win - the loser gets "Too
slow!". Sync is by polling (~1s while live), so it works on Vercel with no
extra services; the fuse closes lazily on the first read after it expires.

### One-time database update

The live room uses five new tables (`member_profiles`, `live_settings`,
`auction_sessions`, `auction_bids`, `auction_reactions`) and touches no
existing ones - until they exist, the rest of the app keeps working and
the live pages show a "one quick setup step" notice. Create them with:

```bash
npm run db:push      # against the production DATABASE_URL
```

(`drizzle/0001_live_auction.sql` is the same change as a migration file,
if the database is managed with `db:migrate`.)

## Local development

1. Copy `.env.example` to `.env.local` and fill in:
   - `DATABASE_URL` - a Postgres connection string. Recommended: create a
     free [Neon](https://neon.tech) project and use a dev branch, so local
     dev matches production. A plain local Postgres
     (`postgres://user:pass@localhost/db`) also works - `src/lib/db/index.ts`
     switches to node-postgres for localhost URLs.
   - `AUTH_SECRET` - 32+ random bytes:
     `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`
   - `SETUP_PASSPHRASE` - any passphrase; required to create a committee via
     `/new` (a crude anti-spam gate, not a real user system).
   - Optional, for "Continue with Google" (see below): `GOOGLE_CLIENT_ID`,
     `GOOGLE_CLIENT_SECRET`, `BETTER_AUTH_SECRET` (32+ random bytes) and
     `BETTER_AUTH_URL` (the app's origin, e.g. `http://localhost:3000`).

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

### Short links

`/go/admin` and `/go/member` redirect to whatever URLs are set in the
`GO_ADMIN_URL` and `GO_MEMBER_URL` environment variables (unset by default -
each responds 404 until configured). Set these in Vercel's environment
variables to the full admin/member links for your committee, redeploy, and
share `https://<your-domain>/go/admin` / `/go/member` instead of the long
tokenized URLs. Keep `GO_ADMIN_URL` as private as the admin link itself - it
grants the same access.

### Google sign-in

Off unless `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set. The join
link is `/join/<committee id>.<signature>` (signed with `AUTH_SECRET`, nothing
stored). Google's stable account id, not the email, identifies a member.
After joining, members log in at `/login` with Google. Phone-number login
still exists but is **off by default**; the holder can turn it on in the Live
room settings, and phone fields then appear on the Players page.

[Better Auth](https://www.better-auth.com) runs the OAuth round trip in
stateless mode (no tables of its own); links live in `member_google_accounts`.
The OAuth client needs the redirect URI `<origin>/api/auth/callback/google`
for every origin (localhost and production; Google allows no wildcards, so
Vercel preview URLs can't sign in with Google).

## Deploying

1. Create a Neon project for production, grab its connection string.
2. Push this repo to GitHub, import it into Vercel.
3. Set `DATABASE_URL`, `AUTH_SECRET`, `SETUP_PASSPHRASE` in the Vercel
   project's environment variables.
4. Run `npm run db:migrate` against the production `DATABASE_URL` (or apply
   migrations as part of the build step) before first use.
5. Visit `/new` on the deployed URL to create the real committee.

## Out of scope for v1

Notifications/reminders, OTP-verified login,
late-payment penalties/interest, edit audit history.
