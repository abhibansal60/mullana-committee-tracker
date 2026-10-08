#!/usr/bin/env bash
# One command for the live-auction e2e: throwaway Postgres (scripts/test-db.sh), dev server on
# a free port, scripts/qa/live-e2e.mjs, then everything is stopped. Local only; touches no real DB.
#   npm run e2e:live
set -euo pipefail
cd "$(dirname "$0")/../.."
eval "$(scripts/test-db.sh)"
export SETUP_PASSPHRASE=e2e-local   # shell env beats .env.local, so the server and script agree
port=$(python3 -c 'import socket; s = socket.socket(); s.bind(("127.0.0.1", 0)); print(s.getsockname()[1])')
setsid npx next dev -p "$port" >/tmp/live-e2e-dev.log 2>&1 &
dev=$!
trap 'kill -- -$dev 2>/dev/null; scripts/test-db.sh stop' EXIT  # -pid: the whole group, npx spawns children
for _ in $(seq 60); do curl -s -o /dev/null "localhost:$port" && break; sleep 1; done
BASE_URL="http://localhost:$port" node scripts/qa/live-e2e.mjs
