#!/usr/bin/env bash
# Merge a feature branch into main, push, and confirm the resulting
# Vercel production deployment goes Ready - the whole "deploy to prod"
# flow from one command instead of a dozen manual steps.
#
# Usage: scripts/deploy.sh [branch]
#   branch defaults to the current branch. Refuses to run from main itself.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

BRANCH="${1:-$(git branch --show-current)}"

if [ "$BRANCH" = "main" ]; then
  echo "Already on main - pass the feature branch to merge, e.g. scripts/deploy.sh feature/x" >&2
  exit 1
fi

if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "Uncommitted changes present - commit or stash them first." >&2
  exit 1
fi

echo "==> Verifying $BRANCH (tsc, eslint, tests)"
git checkout "$BRANCH"
npx tsc --noEmit
npx eslint .
npm test

echo "==> Fetching origin and checking main hasn't diverged"
git fetch origin
LOCAL_MAIN=$(git rev-parse main)
REMOTE_MAIN=$(git rev-parse origin/main)
if [ "$LOCAL_MAIN" != "$REMOTE_MAIN" ]; then
  echo "Local main ($LOCAL_MAIN) and origin/main ($REMOTE_MAIN) disagree - fetch/rebase manually before deploying." >&2
  exit 1
fi

echo "==> Fast-forward merging $BRANCH into main"
git checkout main
git merge --ff-only "$BRANCH"

echo "==> Pushing main (triggers Vercel production deployment)"
git push origin main
COMMIT=$(git rev-parse HEAD)

echo "==> Waiting for the Vercel production deployment of $COMMIT"
for i in $(seq 1 30); do
  RESULT=$(node "$(dirname "$0")/lib/vercel-status.js" "$COMMIT" production)
  STATE="${RESULT%%|*}"
  URL="${RESULT#*|}"

  case "$STATE" in
    READY)
      echo "==> Deployment ready: $URL"
      exit 0
      ;;
    ERROR)
      echo "==> Deployment failed. Logs:" >&2
      npx --yes vercel inspect "$URL" --logs 2>&1 | tail -60 >&2
      exit 1
      ;;
    NONE|QUEUED|BUILDING|INITIALIZING)
      sleep 5
      ;;
    *)
      echo "==> Unexpected state: $STATE" >&2
      sleep 5
      ;;
  esac
done

echo "==> Timed out waiting for deployment status. Check: npx vercel ls" >&2
exit 1
