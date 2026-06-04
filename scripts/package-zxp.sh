#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PACKAGE_VERSION="$(node -p "require('$ROOT_DIR/package.json').version")"
EXTENSION_DIR="$ROOT_DIR/dist/cep"
DIST_DIR="$ROOT_DIR/dist"
OUTPUT_PATH="$DIST_DIR/nyuukou-checker-v$PACKAGE_VERSION.zxp"
CERT_PATH="${ZXP_CERT_PATH:-"$ROOT_DIR/certs/self-signed.p12"}"
STAGING_DIR="$DIST_DIR/.zxp-staging"

fail() {
  printf '[package] ERROR: %s\n' "$1" >&2
  exit 1
}

[ -n "${ZXPSIGNCMD_PATH:-}" ] || fail "ZXPSIGNCMD_PATH is required"
[ -x "$ZXPSIGNCMD_PATH" ] || fail "ZXPSignCmd is not executable: $ZXPSIGNCMD_PATH"
[ -n "${ZXP_CERT_PASSWORD:-}" ] || fail "ZXP_CERT_PASSWORD is required"
[ -f "$CERT_PATH" ] || fail "certificate not found: $CERT_PATH"

mkdir -p "$DIST_DIR"
rm -f "$OUTPUT_PATH"
rm -rf "$STAGING_DIR"
trap 'rm -rf "$STAGING_DIR"' EXIT
mkdir -p "$STAGING_DIR"

printf '[package] preparing sanitized extension...\n'
rsync -a --exclude '.debug' --exclude '*.map' --exclude 'node_modules' "$EXTENSION_DIR/" "$STAGING_DIR/"

printf '[package] verifying extension...\n'
bash "$ROOT_DIR/scripts/verify-extension.sh" "$STAGING_DIR" --distribution

printf '[package] signing extension...\n'
"$ZXPSIGNCMD_PATH" -sign "$STAGING_DIR" "$OUTPUT_PATH" "$CERT_PATH" "$ZXP_CERT_PASSWORD"

size="$(wc -c < "$OUTPUT_PATH" | tr -d ' ')"
printf '[package] output: %s\n' "dist/$(basename "$OUTPUT_PATH")"
printf '[package] size: %s bytes\n' "$size"
printf '[package] result: OK\n'
