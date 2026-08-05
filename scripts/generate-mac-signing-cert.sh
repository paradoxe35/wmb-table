#!/usr/bin/env bash
#
# Generates the self-signed code-signing certificate used to sign macOS builds.
#
# macOS auto-update does not need an Apple Developer ID: Squirrel.Mac checks the
# update against the running app's designated requirement and never validates the
# trust chain. It does need every release signed by the SAME certificate, which is
# exactly what ad-hoc signing cannot provide.
#
# Run once, keep the output safe, and store the printed files as the CSC_LINK and
# CSC_KEY_PASSWORD repository secrets. See .github/variables.md
#
set -euo pipefail

OUT_DIR="${1:-$HOME/wmb-table-signing}"
COMMON_NAME="${CERT_COMMON_NAME:-WMB Table}"
DAYS="${CERT_DAYS:-7300}" # ~20 years; an expired cert breaks signing entirely

if [ -e "$OUT_DIR" ]; then
    echo "Refusing to overwrite existing directory: $OUT_DIR" >&2
    echo "Replacing the certificate stops already-installed apps from updating." >&2
    exit 1
fi

mkdir -p "$OUT_DIR"
chmod 700 "$OUT_DIR"

KEY="$OUT_DIR/signing.key"
CERT="$OUT_DIR/signing.cer"
P12="$OUT_DIR/signing.p12"
PASSWORD_FILE="$OUT_DIR/csc-key-password.txt"
BASE64_FILE="$OUT_DIR/csc-link.base64.txt"

openssl rand -base64 24 | tr -d '\n' >"$PASSWORD_FILE"
PASSWORD="$(cat "$PASSWORD_FILE")"

# codeSigning EKU is mandatory: without it macOS reports the identity as
# "(Missing required extension)" and electron-builder discards it.
openssl req -x509 -newkey rsa:4096 -sha256 -days "$DAYS" -nodes \
    -keyout "$KEY" -out "$CERT" \
    -subj "/CN=$COMMON_NAME/O=$COMMON_NAME/C=US" \
    -addext "basicConstraints=critical,CA:true" \
    -addext "keyUsage=critical,digitalSignature,keyCertSign" \
    -addext "extendedKeyUsage=critical,codeSigning" \
    2>/dev/null

# -legacy uses PBE-SHA1-3DES, which the macOS `security import` tool accepts;
# OpenSSL 3's default AES-256-CBC PKCS#12 fails to import.
openssl pkcs12 -export -legacy \
    -inkey "$KEY" -in "$CERT" -out "$P12" \
    -name "$COMMON_NAME" -passout "pass:$PASSWORD"

base64 -w0 "$P12" >"$BASE64_FILE" 2>/dev/null || base64 -i "$P12" | tr -d '\n' >"$BASE64_FILE"

chmod 600 "$KEY" "$P12" "$PASSWORD_FILE" "$BASE64_FILE"

echo
echo "Certificate created in $OUT_DIR"
echo
openssl x509 -in "$CERT" -noout -subject -enddate -fingerprint -sha256
echo
echo "Set these two GitHub repository secrets:"
echo "  CSC_LINK          <- contents of $BASE64_FILE"
echo "  CSC_KEY_PASSWORD  <- contents of $PASSWORD_FILE"
echo
echo "Back up $OUT_DIR somewhere safe and keep it out of git."
echo "Losing or replacing this certificate means installed apps can no longer"
echo "auto-update and every user has to reinstall by hand."
