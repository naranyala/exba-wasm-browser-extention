#!/bin/bash
set -e

# Get absolute path of this script's directory
ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
DIST_DIR="$ROOT_DIR/dist"
PROFILE_DIR="$ROOT_DIR/.chrome-profile"

# Ensure dist exists (build it if it doesn't)
if [ ! -d "$DIST_DIR" ]; then
  echo -e "\033[0;34m=== Building extension first... ===\033[0m"
  "$ROOT_DIR/build.sh"
fi

# Detect available browsers
BROWSERS=("chromium" "chromium-browser" "google-chrome-stable" "google-chrome" "brave-browser")
BROWSER_CMD=""

for b in "${BROWSERS[@]}"; do
  if command -v "$b" >/dev/null 2>&1; then
    BROWSER_CMD="$b"
    break
  fi
done

if [ -z "$BROWSER_CMD" ]; then
  echo -e "\033[0;31mError: No supported Chromium-based browser found!\033[0m"
  echo "Please install Brave, Chromium, or Google Chrome."
  exit 1
fi

echo -e "\033[0;32m=== Starting $BROWSER_CMD with EXBA Extension ===\033[0m"
echo -e "\033[0;32mProfile directory: $PROFILE_DIR\033[0m"
echo -e "\033[0;32mExtension directory: $DIST_DIR\033[0m"
echo "Press Ctrl+C to exit."

# Start the browser with the extension loaded and isolated user profile
"$BROWSER_CMD" \
  --load-extension="$DIST_DIR" \
  --user-data-dir="$PROFILE_DIR" \
  --no-first-run \
  --no-default-browser-check \
  --start-maximized \
  "$@"
