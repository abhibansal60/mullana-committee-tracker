# Google sign-in: notes for this repo

Use your existing Google auth skill for the OAuth and Vercel setup itself.
These are the repo-specific constraints and design decisions it should follow.

## Constraints

- **`.env.local` may point at the production database** (see
  `scripts/README.md`). Develop against a Neon dev branch or a local Postgres
  (`postgres://…@localhost/…` works: `src/lib/db/index.ts` switches to
  node-postgres for localhost).
- **Store new data in a new table, never in a new column on an existing
  table.** Production has broken twice when code selected a column the
  database didn't have yet. A missing table only affects the new feature, and
  `isLiveSchemaMissing()` in `src/lib/live/queries.ts` already handles it
  gracefully.
- **Apply production schema changes by hand** (Neon SQL editor) or with
  `npm run db:push`. **Never run `db:migrate` against production**: migration
  0001 was applied by hand, so drizzle's journal there is out of sync.
- Apply the production SQL *before* merging code that uses it.
- Checks that must pass: `npx tsc --noEmit`, `npx eslint .`, `npm test`,
  `npx next build`, and `node --env-file=.env.local scripts/qa/live-e2e.mjs`.

## Design already agreed

- Keep member sessions as they are (`src/lib/auth/player.ts`: the `player`
  cookie with `committeeId`, `memberId`, `epoch`). Google only changes how a
  member gets that cookie.
- **Linking:** the holder's WhatsApp invite link (`/in/<token>`, see
  `consumeLoginToken`) becomes a one-time "continue with Google" step. After
  that, only the linked Google account (matched on its stable `sub`, not the
  email) can log in as that member.
- **Login:** `/login` shows Continue with Google first. The phone form stays
  as a fallback that the holder can switch off (`allowPhoneLogin` in live
  settings already exists).
- One Google account can be linked to several committees (the real one plus
  the practice copy), so login reuses the existing "which committee?"
  chooser.
- **Reset** on the Players page (`revokeMemberAccess`) must also unlink
  Google.
- `createPracticeCommittee` (`src/lib/live/practice.ts`) should copy linked
  identities onto the practice copy's members.
- The feature stays off unless `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`
  are set. When they're unset, the app behaves exactly as it does today.
