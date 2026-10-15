#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
tls_dir="$project_root/.local/tls"
mkdir -p "$tls_dir"
if [[ -e "$tls_dir/key.pem" && -e "$tls_dir/cert.pem" ]]; then
  echo "Local TLS files already exist in .local/tls; no files overwritten."
  exit 0
fi
if [[ -e "$tls_dir/key.pem" || -e "$tls_dir/cert.pem" ]]; then
  echo "Incomplete TLS pair in .local/tls; provide both files or move the remaining file before retrying." >&2
  exit 1
fi
umask 077
openssl req -x509 -newkey rsa:2048 -nodes \
  -keyout "$tls_dir/key.pem" -out "$tls_dir/cert.pem" -days 30 \
  -subj /CN=localhost \
  -addext 'subjectAltName=DNS:localhost,IP:127.0.0.1'
echo "Created development-only self-signed certificate in .local/tls."
echo "Use a locally trusted certificate for normal browser use. Never use this certificate in production."
