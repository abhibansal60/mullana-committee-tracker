#!/usr/bin/env bash
# Throwaway local Postgres 17 for the DB-backed tests (they only run against localhost).
# Prints an `export DATABASE_URL=...` line, so: eval "$(scripts/test-db.sh)" && npm test
# Postgres comes from conda (no Docker or root needed); data lives in /tmp. Stop it with: scripts/test-db.sh stop
set -euo pipefail
cd "$(dirname "$0")/.."
ENV=${PG_ENV:-$HOME/.cache/pg17}
DATA=${PG_DATA:-/tmp/committee-test-pg}
if [ "${1:-}" = stop ]; then "$ENV/bin/pg_ctl" -D "$DATA" stop -m fast >&2; exit; fi

if [ ! -x "$ENV/bin/pg_ctl" ]; then
  echo "installing Postgres 17 into $ENV (one time)..." >&2
  source "$(conda info --base)/etc/profile.d/conda.sh"
  conda create -y -q -p "$ENV" --override-channels -c conda-forge postgresql=17 >&2
fi
if ! "$ENV/bin/pg_ctl" -D "$DATA" status >/dev/null 2>&1; then
  [ -d "$DATA" ] || "$ENV/bin/initdb" -D "$DATA" -U postgres --auth=trust >/dev/null
  # A free port: something else on the machine may already hold 5432 or any fixed choice.
  port=$(python3 -c 'import socket; s = socket.socket(); s.bind(("127.0.0.1", 0)); print(s.getsockname()[1])')
  "$ENV/bin/pg_ctl" -D "$DATA" -o "-p $port -k /tmp" -l "$DATA/log" -w start >&2
  "$ENV/bin/createdb" -h localhost -p "$port" -U postgres committee_test 2>/dev/null || true
fi
port=$(sed -n 4p "$DATA/postmaster.pid")
url="postgres://postgres@localhost:$port/committee_test"
# Same as CI and production: the schema comes from schema.ts.
DATABASE_URL=$url npx drizzle-kit push --force >&2
echo "export DATABASE_URL=$url AUTH_SECRET=\${AUTH_SECRET:-local-only-secret-at-least-32-bytes-long}"
