#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EXTENSION_DIR="${1:-"$ROOT_DIR/dist/cep"}"
VERIFY_DISTRIBUTION="${2:-}"
MANIFEST="$EXTENSION_DIR/CSXS/manifest.xml"

fail() {
  printf '[verify] ERROR: %s\n' "$1" >&2
  exit 1
}

ok_path() {
  local path="$1"
  local label="$2"
  if [ ! -e "$path" ]; then
    fail "$label not found: $path"
  fi
  printf '[verify] OK: %s found\n' "$label"
}

extract_first() {
  local pattern="$1"
  local file="$2"
  sed -nE "s|.*$pattern.*|\\1|p" "$file" | head -n 1
}

ok_path "$MANIFEST" "extension/CSXS/manifest.xml"
ok_path "$EXTENSION_DIR/main/index.html" "extension/main/index.html"
ok_path "$EXTENSION_DIR/assets" "extension/assets"
ok_path "$EXTENSION_DIR/jsx" "extension/jsx"
ok_path "$EXTENSION_DIR/jsx/index.js" "extension/jsx/index.js"

if [ "$VERIFY_DISTRIBUTION" = "--distribution" ]; then
  forbidden_file="$(find "$EXTENSION_DIR" -type f \( -name '.debug' -o -name '*.map' -o -name '.DS_Store' \) -print -quit)"
  [ -z "$forbidden_file" ] || fail "forbidden distribution file found: $forbidden_file"

  forbidden_dir="$(find "$EXTENSION_DIR" -type d -name 'node_modules' -print -quit)"
  [ -z "$forbidden_dir" ] || fail "forbidden distribution directory found: $forbidden_dir"

  if grep -R -n -E 'process\.env|ZXP_CERT_PASSWORD|/Users/[^/]+/' "$EXTENSION_DIR" >/dev/null; then
    fail "forbidden runtime config, secret reference, or absolute user path found"
  fi
fi

bundle_id="$(extract_first 'ExtensionBundleId="([^"]+)"' "$MANIFEST")"
extension_id="$(extract_first '<Extension Id="([^"]+)"' "$MANIFEST")"
main_path="$(extract_first '<MainPath>([^<]+)</MainPath>' "$MANIFEST")"
runtime="$(extract_first '<RequiredRuntime[^>]*Version="([^"]+)"' "$MANIFEST")"
hosts="$(sed -nE 's/.*<Host Name="([^"]+)" Version="([^"]+)".*/\1 \2/p' "$MANIFEST" | paste -sd ', ' -)"

[ -n "$bundle_id" ] || fail "ExtensionBundleId missing in manifest.xml"
[ -n "$extension_id" ] || fail "Extension Id missing in manifest.xml"
[ -n "$main_path" ] || fail "MainPath missing in manifest.xml"
[ -n "$runtime" ] || fail "RequiredRuntime missing in manifest.xml"
[ -n "$hosts" ] || fail "HostList missing in manifest.xml"

printf '[verify] ExtensionBundleId: %s\n' "$bundle_id"
printf '[verify] Extension Id: %s\n' "$extension_id"
printf '[verify] MainPath: %s\n' "$main_path"
printf '[verify] RequiredRuntime: %s\n' "$runtime"
printf '[verify] HostList: %s\n' "$hosts"
printf '[verify] Result: OK\n'
