# Scripts

Tooling built while doing the frontend redesign + profit/loss work, kept
around so the same manual steps don't get re-derived (and re-paid-for in
tokens) every session.

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

This sandbox has no GPU/display and no root, so `playwright install
--with-deps` doesn't work here - `scripts/qa/setup.sh` downloads the
missing shared libraries as unprivileged `.deb`s (`apt-get download`
doesn't need root) and extracts them locally instead of installing them
system-wide.

```
scripts/qa/setup.sh          # one-time per environment
source scripts/qa/env.sh     # every new shell, before using Playwright
```

Playwright lives in `scripts/qa/` with its own `package.json`, deliberately
separate from the app's own dependencies - it's QA tooling, not something
`next build` should ever need to know about.

### Throwaway test committees

The app's real committee lives in the same database as local dev
(`DATABASE_URL` in `.env.local`), so don't hand-write SQL against it.
Instead:

```
npm run dev -- -p 3417   # in one terminal

node --env-file=.env.local scripts/qa/fixture.mjs create "QA Committee"
# -> prints admin/member URLs, tokens, and PIN as JSON

node --env-file=.env.local scripts/qa/fixture.mjs delete "QA Committee"
# -> ALWAYS run this once you're done looking; matches by exact name only
```

Then drive it with Playwright directly (see git history for `scripts/qa/`
commits around the redesign/P&L work for example scripts that log in,
record an auction, add payments, and screenshot at mobile/desktop widths
in both color schemes) - there wasn't enough of a stable pattern yet to
lock into one more reusable script beyond fixture creation itself.

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
