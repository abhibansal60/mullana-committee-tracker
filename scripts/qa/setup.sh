#!/usr/bin/env bash
# One-time setup for visual QA: installs Playwright + a headless Chromium
# usable without root. On a minimal container/WSL box `playwright install
# --with-deps` needs sudo, which may not be available; this script instead
# downloads the handful of missing shared libraries as unprivileged .debs
# (`apt-get download` doesn't need root) and extracts them locally with
# `dpkg-deb -x`, then points LD_LIBRARY_PATH at them.
#
# Usage: scripts/qa/setup.sh
# After it succeeds, `source scripts/qa/env.sh` before running fixture.mjs
# or any other Playwright-based script.
set -euo pipefail
cd "$(dirname "$0")"

echo "==> Installing playwright"
npm install --no-audit --no-fund

echo "==> Downloading Chromium (no system deps yet)"
npx playwright install chromium

CHROME_BIN=$(find "$HOME/.cache/ms-playwright" -type f -name "chrome-headless-shell" 2>/dev/null | head -1)
if [ -z "$CHROME_BIN" ]; then
  CHROME_BIN=$(find "$HOME/.cache/ms-playwright" -type f -name "chrome" -path "*chrome-linux*" 2>/dev/null | head -1)
fi
if [ -z "$CHROME_BIN" ]; then
  echo "Could not locate the downloaded Chromium binary under ~/.cache/ms-playwright" >&2
  exit 1
fi

mkdir -p .libs
: > env.sh

echo "==> Checking for missing shared libraries"
MISSING=$(ldd "$CHROME_BIN" 2>/dev/null | grep "not found" | awk '{print $1}' || true)

if [ -z "$MISSING" ]; then
  echo "==> No missing libraries - system already has everything Chromium needs."
  echo "export LD_LIBRARY_PATH=\"\${LD_LIBRARY_PATH:-}\"" > env.sh
else
  echo "Missing: $MISSING"
  # Known Debian/Ubuntu package names for the libs Chromium commonly needs
  # that aren't present on a minimal base image. Extend this map if a
  # future Chromium version needs something not listed here.
  declare -A LIB_TO_PKG=(
    ["libnspr4.so"]="libnspr4"
    ["libnss3.so"]="libnss3"
    ["libnssutil3.so"]="libnss3"
    ["libasound.so.2"]="libasound2t64 libasound2"
  )

  PACKAGES=""
  for lib in $MISSING; do
    pkgs="${LIB_TO_PKG[$lib]:-}"
    if [ -z "$pkgs" ]; then
      echo "No known package for $lib - add it to LIB_TO_PKG in this script." >&2
      exit 1
    fi
    PACKAGES="$PACKAGES $pkgs"
  done

  mkdir -p .debs
  cd .debs
  echo "==> Downloading (no root needed): $PACKAGES"
  for pkg in $PACKAGES; do
    apt-get download "$pkg" 2>/dev/null || true
  done
  cd ..

  echo "==> Extracting into .libs (not installed system-wide)"
  for deb in .debs/*.deb; do
    [ -e "$deb" ] || continue
    dpkg-deb -x "$deb" .libs
  done

  LIBDIR="$(pwd)/.libs/usr/lib/x86_64-linux-gnu"
  echo "export LD_LIBRARY_PATH=\"$LIBDIR:\${LD_LIBRARY_PATH:-}\"" > env.sh
fi

echo "==> Verifying Chromium launches"
# shellcheck disable=SC1091
source env.sh
node -e '
const { chromium } = require("playwright");
(async () => {
  const browser = await chromium.launch();
  await browser.close();
  console.log("Chromium launched OK");
})().catch((e) => { console.error("LAUNCH FAILED:", e.message); process.exit(1); });
'

echo "==> Done. Run: source scripts/qa/env.sh"
