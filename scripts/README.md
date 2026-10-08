# Scripts

Tooling built while doing the frontend redesign + profit/loss work, kept
around so the same manual steps don't get re-derived (and re-paid-for in
tokens) every session.

## Local test database

```
npm run test:local                       # .env.local points at a local Postgres (e.g. Docker `committee-pg`)
eval "$(scripts/test-db.sh)" && npm test # no local Postgres yet: a throwaway one from conda
```

The DB-backed tests (`*.test.ts` that import `@/lib/db`) skip unless `DATABASE_URL` points at localhost. `test-db.sh`
starts a throwaway Postgres 17 from conda in `/tmp` on a free port, pushes the schema, and prints the env to export.
`scripts/test-db.sh stop` stops it.

### Live auction e2e

```
npm run e2e:live
```

One command: throwaway Postgres (`test-db.sh`), dev server on a free port, `scripts/qa/live-e2e.mjs`, then both stop.
Prints `ALL GOOD` on success. Run it after any change under `src/lib/live/` or `src/components/live/`.

## Deploying

```
scripts/deploy.sh [branch]
```

Runs `tsc`/`eslint`/`npm test` on the branch, fast-forward merges it into
`main` (refuses if `main` has moved on origin - no force-anything), pushes,
and polls Vercel until the resulting production deployment is `Ready`
(or prints the build logs and exits non-zero if it fails). Defaults to the
current branch if none is given. This is the whole "deploy to prod" flow
from earlier sessions, as one command.

Needs `gh` authenticated (`gh auth status`) so `git push` has working
credentials, and the Vercel CLI (`npx vercel`, already logged in via
`vercel whoami`).

## Visual QA (screenshots, click-through checks)

Playwright lives in `scripts/qa/` with its own `package.json`, deliberately
separate from the app's own dependencies - it's QA tooling, not something
`next build` should ever need to know about.

```
(cd scripts/qa && npm install)   # one-time per checkout
```

On mini (a normal Ubuntu desktop) the downloaded Chromium runs as is. Only a sandbox with no
root and missing system libraries needs `scripts/qa/setup.sh` (downloads the
shared libraries as unprivileged `.deb`s) and `source scripts/qa/env.sh` in
every new shell.

In a fresh worktree, install the app's own dependencies with `npm ci`, not
`npm install`: a different npm version rewrites `package-lock.json`.

### Dev server

The main checkout's dev server usually holds port 3000, so worktrees use
3417 (the QA scripts' default `BASE_URL`). Start it from the repo root in
the same command (`cd <repo> && npx next dev -p 3417`): a background command
that inherits another directory fails with "Couldn't find any `pages` or
`app` directory".

### Screenshots and click-through: `ux-shots.mjs`

Needs the dev server and a local `DATABASE_URL`; it refuses anything else.

```
node --env-file=.env.local scripts/qa/ux-shots.mjs seed            # two "UX QA" committees: fresh, and mid-season
node --env-file=.env.local scripts/qa/ux-shots.mjs shoot docs/ux/x # every admin, member and practice page, 390px + 1280px
node --env-file=.env.local scripts/qa/ux-shots.mjs check           # clicks through key flows; records one payment
node --env-file=.env.local scripts/qa/ux-shots.mjs cleanup         # deletes every "UX QA" committee and practice copy
python3 scripts/qa/shrink.py docs/ux/x                             # palette-quantize before committing PNGs
```

`check` asserts the committee-day button, Start bidding, Enter the auction
room and You owe are on the first phone screen, and that the practice room's
Exit and Reset links point at the right places. Run it after any layout
change.

Before/after on identical data: `seed`, then commit your work, put the old
UI back with `git checkout <base> -- src`, move aside any files that are new
since `<base>`, run `shoot docs/ux/before`, restore with
`git checkout HEAD -- src`, then run `shoot docs/ux/after`. Shoot `before`
first, because `check` changes the data.

### One throwaway committee: `fixture.mjs`

```
node --env-file=.env.local scripts/qa/fixture.mjs create "QA Committee"
# -> prints admin/member URLs, tokens, and PIN as JSON

node --env-file=.env.local scripts/qa/fixture.mjs delete "QA Committee"
# -> ALWAYS run this once you're done looking; matches by exact name only
```

## Notes for future sessions

- `gh` (GitHub CLI) is the credential source for `git push` in this
  environment - it was installed to `~/.local/bin/gh` and authenticated via
  device flow because the VS Code git-askpass bridge
  (`VSCODE_GIT_IPC_HANDLE`) turned out to be unreliable (breaks whenever
  the VS Code window disconnects from this machine). If push starts
  failing with a `vscode-git-*.sock` `ECONNREFUSED` error again, that's
  why - `gh auth status` to check it's still logged in, `gh auth
  setup-git` to re-register it as the credential helper.
- Vercel Preview deployments need `DATABASE_URL`/`AUTH_SECRET`/
  `SETUP_PASSPHRASE` in the Preview environment (`vercel env ls`) - they
  were originally Production-only, which is why the first auto-triggered
  preview build failed.
