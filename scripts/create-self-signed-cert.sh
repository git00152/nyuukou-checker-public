#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CERT_DIR="$ROOT_DIR/certs"
CERT_PATH="$CERT_DIR/self-signed.p12"

fail() {
  printf '[cert] ERROR: %s\n' "$1" >&2
  exit 1
}

[ -n "${ZXPSIGNCMD_PATH:-}" ] || fail "ZXPSIGNCMD_PATH is required"
[ -x "$ZXPSIGNCMD_PATH" ] || fail "ZXPSignCmd is not executable: $ZXPSIGNCMD_PATH"
[ -n "${ZXP_CERT_PASSWORD:-}" ] || fail "ZXP_CERT_PASSWORD is required"

if [ -e "$CERT_PATH" ]; then
  fail "certificate already exists: certs/self-signed.p12"
fi

mkdir -p "$CERT_DIR"

printf '[cert] creating self-signed certificate...\n'
"$ZXPSIGNCMD_PATH" -selfSignedCert JP Tokyo git00152 nyuukou-checker "$ZXP_CERT_PASSWORD" "$CERT_PATH"
printf '[cert] output: certs/self-signed.p12\n'
printf '[cert] result: OK\n'
