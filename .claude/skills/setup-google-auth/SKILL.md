---
name: setup-google-auth
description: Add "Continue with Google" sign-in for committee members (free, no new services), replacing number-only login. Walks through creating the Google OAuth client, the code changes in this repo, a safe database change, testing, and deploying. Use when asked to set up / enable / add Google auth or Google login.
---

# Set up Google sign-in for members

You are working in `mullana-committee-tracker` (Next.js 16 App Router +
Drizzle + Neon Postgres, deployed on Vercel). Read `AGENTS.md` first: this
Next.js version differs from your training data, so check
`node_modules/next/dist/docs/` before using any Next API you're unsure of.

Work through the phases **in order**. Stop and ask the user whenever a step
needs them (Google Console, Vercel dashboard, running SQL on production).
Never ask them to paste secrets into the chat - they go in `.env.local` and
Vercel env vars only.

## Goal and design (already agreed with the user)

- Cost: ₹0. Google OAuth is free; no Auth.js/NextAuth or other new service.
  `jose` (already a dependency) verifies Google's ID token.
- **Linking**: the holder's WhatsApp invite link (`/in/<token>`) becomes a
  one-time "link your Google account" step. After linking, only that Google
  account can log in as that member.
- **Login**: `/login` shows **Continue with Google** as the main button. The
  existing phone-number form stays as a fallback that the holder can switch
  off (the `allowPhoneLogin` toggle already exists in live settings).
- **Reset** on the Players page (`revokeMemberAccess`) also unlinks Google, so
  a member who changes phone/account can be re-invited.
- One Google account may be linked in several committees (real + practice
  copy) - login shows the existing "which committee?" chooser.
- Feature is **off unless `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are
  set**: no button, old behaviour. So code can deploy before the env vars.
- Keep member sessions exactly as they are (`src/lib/auth/player.ts`: the
  `player` cookie with `committeeId`, `memberId`, `epoch`). Google only
  changes *how* someone gets that cookie.

## Phase 0 - Ground rules for this repo (read before touching anything)

1. **`.env.local` may point at the PRODUCTION database** (see
   `scripts/README.md`). Before developing, make sure `DATABASE_URL` in
   `.env.local` points at a Neon **dev branch** or a local Postgres
   (`postgres://user:pass@localhost/db` works - `src/lib/db/index.ts` switches
   to node-postgres for localhost). Ask the user which they want; if they
   have neither, help them create a Neon branch ("Branches → Create branch"
   in the Neon console) and put its connection string in `.env.local`.
2. **New data goes in a new table**, never a new column on an existing
   table. Production has twice broken when code selected a column the
   database didn't have yet. A missing *table* only affects the new feature,
   and `isLiveSchemaMissing()` in `src/lib/live/queries.ts` already degrades
   gracefully on "relation does not exist".
3. **Production schema changes are applied by hand** (Neon SQL editor) or
   with `npm run db:push`. Do **not** use `npm run db:migrate` against
   production - migration 0001 was applied by hand, so drizzle's migration
   journal there is out of sync.
4. Checks that must stay green: `npx tsc --noEmit`, `npx eslint .`,
   `npm test`, `npx next build`.
5. Branch → PR → merge; never push straight to `main` without the user's OK.

## Phase 1 - Create the Google OAuth client (user does this, you guide)

Walk the user through it step by step, one screen at a time:

1. Open https://console.cloud.google.com/ and create a project, e.g.
   "Mullana Committee" (top bar → project picker → New project).
2. **Google Auth Platform → Branding** (older consoles call this "OAuth
   consent screen"): app name "Mullana Committee", user support email, and
   developer contact email. Audience: **External**.
3. **Data access / Scopes**: only `openid`, `.../auth/userinfo.email`,
   `.../auth/userinfo.profile`. These are non-sensitive, so no Google
   verification review is needed.
4. **Audience**: click **Publish app** ("In production"). In "Testing" mode
   only listed test users can sign in, which would block members.
5. **Clients → Create client → Web application**, name "Mullana web".
   - Authorized JavaScript origins:
     `http://localhost:3000`, `https://mullana-committee-tracker.vercel.app`
   - Authorized redirect URIs:
     - `http://localhost:3000/api/auth/google/callback`
     - `https://mullana-committee-tracker.vercel.app/api/auth/google/callback`
     - optional, for testing on the branch preview:
       `https://mullana-committee-tracker-git-claude-mullan-e09407-just-me-9d1e.vercel.app/api/auth/google/callback`
       (preview URLs of other branches won't work unless added here).
6. Copy the **Client ID** and **Client secret** into `.env.local`:
   ```
   GOOGLE_CLIENT_ID=...apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=...
   ```
   Confirm with the user that it's saved - don't ask to see the values.

## Phase 2 - Database: one new table

Add to `src/lib/db/schema.ts` (next to `memberProfiles`):

```ts
/** A verified external login (Google) linked to one member seat. */
export const memberIdentities = pgTable(
  "member_identities",
  {
    id: uuid("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    memberId: uuid("member_id").notNull().references(() => members.id, { onDelete: "cascade" }),
    committeeId: uuid("committee_id").notNull().references(() => committees.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(), // "google"
    subject: text("subject").notNull(), // Google's stable `sub`, never the email
    email: text("email"), // for display on the Players page only
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("member_identities_member_provider_idx").on(t.memberId, t.provider),
    uniqueIndex("member_identities_committee_subject_idx").on(t.committeeId, t.provider, t.subject),
    index("member_identities_subject_idx").on(t.provider, t.subject),
  ]
);
```

Then `npm run db:generate` (rename the file to `drizzle/0002_member_identities.sql`
and fix the tag in `drizzle/meta/_journal.json`, the way 0001 was done) and
apply it to the dev database.

## Phase 3 - Server code

Create `src/lib/auth/google.ts`:

- `googleEnabled()` → both env vars set.
- `buildAuthUrl({ redirectUri, state, nonce })` →
  `https://accounts.google.com/o/oauth2/v2/auth` with `client_id`,
  `redirect_uri`, `response_type=code`, `scope=openid email profile`,
  `state`, `nonce`, `prompt=select_account`.
- `exchangeCode(code, redirectUri)` → POST
  `https://oauth2.googleapis.com/token` (form-encoded: code, client_id,
  client_secret, redirect_uri, grant_type=authorization_code) → `id_token`.
- `verifyIdToken(idToken, nonce)` with jose:
  `createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"))`
  (create once, module level) and `jwtVerify` with
  `issuer: ["https://accounts.google.com", "accounts.google.com"]`,
  `audience: GOOGLE_CLIENT_ID`. Then check `payload.nonce === nonce` and
  `payload.email_verified === true`. Return `{ sub, email, name }`.
- The redirect URI is `${origin}/api/auth/google/callback`, where origin
  comes from the request URL (works on localhost, production and preview).

**OAuth state cookie.** Before redirecting to Google, set a short-lived
(10 min), httpOnly, `sameSite: "lax"` cookie `google_oauth` containing a
signed JWT (reuse the `AUTH_SECRET` + jose pattern from
`src/lib/auth/player.ts`) with `{ state, nonce, intent, loginToken?, next? }`.
On callback: verify it, compare `state`, then delete it.

Add to `src/lib/live/queries.ts` (wrap DB errors with `isLiveSchemaMissing`
the way the other functions there do):

- `linkGoogleIdentity(loginToken, identity)` - resolve the invite token like
  `consumeLoginToken` does; if the member already has a *different* Google
  account linked, refuse ("This seat is linked to another Google account -
  ask the holder to Reset it"). Otherwise upsert the identity row and
  return the `LoginMatch`.
- `findLoginsByGoogle(sub)` - all seats linked to that subject, joined like
  `findLoginsByPhone` (committee name, member name, session epoch).
- `markIdentityUsed(memberId)`.
- In `revokeMemberAccess`, also `delete from member_identities where
  member_id = …`.
- In `getProfilesForCommittee` callers / the Players page: load identities
  so the page can show "Google: linked (email)".

Routes (all route handlers, `RouteContext` typing like existing routes):

- `GET /api/auth/google/start?intent=login|link&token=…&next=live` - 404 if
  `!googleEnabled()`; set the state cookie; redirect to Google.
- `GET /api/auth/google/callback` - verify state cookie → exchange code →
  verify ID token → then:
  - `intent=link`: `linkGoogleIdentity(loginToken, identity)` → set the
    `player` cookie (`signPlayerSession`, `playerCookieOptions`) → redirect
    `/play?welcome=1`.
  - `intent=login`: `findLoginsByGoogle(sub)`; none → redirect
    `/login?google=unlinked`; exactly one → set cookie, redirect `/play`
    (or `/play/live` if `next=live`); several → put the candidate
    `memberId`s in a short signed cookie and redirect `/login?choose=1`,
    where the page lists them and POSTs the pick to a small
    `/api/auth/google/choose` route that re-checks the pick is in the cookie.
  - Any failure → `/login?google=error` (never show raw errors).
- Change `src/app/in/[loginToken]/route.ts`: when `googleEnabled()`, don't
  log in directly - redirect to a new page `/in/[loginToken]/link` that
  says "Hi <name>! Link your Google account to finish" with a **Continue
  with Google** button pointing at `/api/auth/google/start?intent=link&token=…`.
  (A route.ts and page.tsx can't share a segment, hence the `/link`
  sub-route.) When Google isn't configured, keep today's behaviour.
- Phone login (`src/app/api/login/route.ts`): unchanged, still gated by
  `allowPhoneLogin`. Suggest to the user that the holder turns it off once
  everyone has linked Google.

Practice room: in `createPracticeCommittee` (`src/lib/live/practice.ts`),
copy identity rows onto the new member ids so people can use Google there
too.

## Phase 4 - UI

- `/login`: when `googleEnabled()` (pass it from the server page), show a
  white **Continue with Google** button (Google "G" logo inline SVG, per
  Google's branding guidelines) above the phone form; phone form moves under
  "or use your number". Messages for `?google=unlinked` ("This Google
  account isn't linked yet - open the invite link the holder sent you on
  WhatsApp") and `?google=error`.
- `/in/[loginToken]/link`: same dark "arena" styling as `/login`.
- Players page (`src/components/admin/PlayersManager.tsx`): show "Google ✓
  <email>" or "Not linked" per member; the invite message text should say
  "tap the link and continue with Google".
- Keep the existing design tokens (`arena-bg`, `arena-card`,
  `host-button-primary`, etc. in `src/app/globals.css`).

## Phase 5 - Test

1. Unit tests (vitest): the state-cookie sign/verify round trip, rejecting
   a tampered/expired state, `googleEnabled()` on/off. Mock `fetch` + a
   locally generated JWKS (jose `generateKeyPair` + `exportJWK`) to test
   `verifyIdToken` accepts a good token and rejects wrong `aud`, wrong
   `nonce`, and `email_verified: false`.
2. Run `npm run dev` (port 3000, so the redirect URI matches) against the
   **dev** database and click through with the user's real Google account:
   create a committee at `/new`, add a phone in Players, send yourself an
   invite, open it → link Google → land on `/play`; log out → Continue with
   Google → back in; Players "Reset" → Google login now says unlinked;
   practice room → Google login offers the chooser.
3. `node --env-file=.env.local scripts/qa/live-e2e.mjs` must still pass
   (it uses phone login, which stays).
4. `npx tsc --noEmit && npx eslint . && npm test && npx next build`.

## Phase 6 - Ship (order matters)

1. **Production database first**: have the user run the contents of
   `drizzle/0002_member_identities.sql` in the Neon SQL editor on the
   production branch (or `npm run db:push` with the production URL). The
   app keeps working without it, but Google login would show errors.
2. **Vercel env vars**: Project → Settings → Environment Variables → add
   `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` for **Production** (and
   **Preview** if testing on the preview URL). Env var changes only apply
   to new deployments.
3. Commit on a branch, open a PR, wait for the Vercel preview to go green,
   merge. The merge redeploys production with the env vars.
4. Smoke test on https://mullana-committee-tracker.vercel.app/login: the
   Google button appears and the user can link + log in.
5. Tell the user the rollout for the group: Shubham re-sends WhatsApp
   invites from Players; once everyone shows "Google ✓", switch off
   "Members can log in with just their mobile number" in the Live tab's
   settings.

## Done means

- Members can link Google via their invite link and log in with one tap.
- Reset unlinks; practice room works with Google.
- With the env vars unset, the app behaves exactly as before.
- All checks green, production DB table created, env vars set, PR merged,
  smoke test passed.
