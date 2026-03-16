#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Download and extract resources from the WMB Table Microsoft Store app.
#
# Automatically fetches the package from the Microsoft Store, extracts it,
# and copies out the db.isar file needed for the Isar-to-SQLite migration.
#
# Usage:
#   ./scripts/extract-msix-resources.sh [output-dir]
#   ./scripts/extract-msix-resources.sh --file <local-file> [output-dir]
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

STORE_URL="https://apps.microsoft.com/detail/9p40j6g2bjld"
API_URL="https://store.rg-adguard.net/api/GetFiles"

LOCAL_FILE=""
OUTPUT_DIR=""

# Parse args
while [[ $# -gt 0 ]]; do
    case "$1" in
        --file)
            LOCAL_FILE="$2"
            shift 2
            ;;
        *)
            OUTPUT_DIR="$1"
            shift
            ;;
    esac
done

OUTPUT_DIR="${OUTPUT_DIR:-./tmp/msix-out}"
TMP_DIR="$(mktemp -d)"

cleanup() {
    rm -rf "$TMP_DIR"
}
trap cleanup EXIT

echo "── Extract WMB Table Store App Resources ──"
echo ""

# ── Step 1: Get the package file ─────────────────────────────────────────────
if [[ -n "$LOCAL_FILE" ]]; then
    if [[ ! -f "$LOCAL_FILE" ]]; then
        echo "Error: File not found: $LOCAL_FILE"
        exit 1
    fi
    MSIX_FILE="$LOCAL_FILE"
    echo "Using local file: $MSIX_FILE"
else
    echo "Fetching download link from Microsoft Store..."
    RESPONSE_FILE="$TMP_DIR/api-response.html"
    curl -s -X POST "$API_URL" \
        -H "User-Agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36" \
        -H "Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8" \
        -H "Accept-Language: en-US,en;q=0.9" \
        -H "Referer: https://store.rg-adguard.net/" \
        -H "Origin: https://store.rg-adguard.net" \
        -H "Content-Type: application/x-www-form-urlencoded" \
        -d "type=url&url=${STORE_URL}&ring=RP&lang=en-US" \
        -o "$RESPONSE_FILE"

    if ! grep -q "The links were successfully received" "$RESPONSE_FILE"; then
        echo "Error: Failed to get links from Microsoft Store."
        echo "The API may be blocked by Cloudflare. Try with --file instead:"
        echo "  1. Go to https://store.rg-adguard.net/"
        echo "  2. Paste: $STORE_URL"
        echo "  3. Download the .msix file"
        echo "  4. Run: $0 --file <downloaded-file> [output-dir]"
        exit 1
    fi

    echo "Got package links from Microsoft Store."

    # Parse download URLs from the HTML — skip .BlockMap files, pick the second
    # link which is the actual .msix with auth tokens (first is the BlockMap)
    ALL_URLS=$(grep -oP 'href="[^"]+"' "$RESPONSE_FILE" | sed 's/href="//;s/"$//')
    DOWNLOAD_URL=$(echo "$ALL_URLS" | grep -v "BlockMap" | tail -1)

    if [[ -z "$DOWNLOAD_URL" ]]; then
        echo "Error: No download link found in response."
        exit 1
    fi

    echo "Downloading package..."
    MSIX_FILE="$TMP_DIR/package.msix"
    curl -L --fail -o "$MSIX_FILE" "$DOWNLOAD_URL"

    if [[ ! -s "$MSIX_FILE" ]]; then
        echo "Error: Download failed."
        exit 1
    fi
fi

echo "Package size: $(du -h "$MSIX_FILE" | cut -f1)"
echo ""

# ── Step 2: Extract the package ──────────────────────────────────────────────
EXTRACT_DIR="$TMP_DIR/extracted"
mkdir -p "$EXTRACT_DIR"

EXT="${MSIX_FILE##*.}"
EXT_LOWER=$(echo "$EXT" | tr '[:upper:]' '[:lower:]')

if [[ "$EXT_LOWER" == "msixbundle" || "$EXT_LOWER" == "appxbundle" ]]; then
    echo "Bundle detected — extracting inner packages..."
    BUNDLE_DIR="$TMP_DIR/bundle"
    mkdir -p "$BUNDLE_DIR"
    unzip -q -o "$MSIX_FILE" -d "$BUNDLE_DIR"

    # Pick the largest inner package (main app)
    INNER=$(find "$BUNDLE_DIR" \( -name "*.msix" -o -name "*.appx" \) -printf '%s %p\n' \
        | sort -rn | head -1 | cut -d' ' -f2-)

    if [[ -z "$INNER" ]]; then
        echo "Error: No inner package found in bundle."
        exit 1
    fi

    echo "Extracting: $(basename "$INNER")"
    unzip -q -o "$INNER" -d "$EXTRACT_DIR"
else
    echo "Extracting package..."
    unzip -q -o "$MSIX_FILE" -d "$EXTRACT_DIR"
fi

# ── Step 3: Find and copy resources ──────────────────────────────────────────
echo ""
echo "Package contents (top-level):"
ls -1 "$EXTRACT_DIR" | head -20

mkdir -p "$OUTPUT_DIR"

echo ""
echo "Database files found:"
find "$EXTRACT_DIR" \( -name "*.isar" -o -name "*.sqlite" -o -name "*.db" \) | while read -r f; do
    REL="${f#$EXTRACT_DIR/}"
    echo "  $REL ($(du -h "$f" | cut -f1))"
done

# Copy the db.isar specifically to the output dir
ISAR_FILE=$(find "$EXTRACT_DIR" -name "db.isar" | head -1)
if [[ -n "$ISAR_FILE" ]]; then
    cp "$ISAR_FILE" "$OUTPUT_DIR/db.isar"
    echo ""
    echo "Copied db.isar to: $OUTPUT_DIR/db.isar"
fi

# Also copy full flutter_assets if present
FLUTTER_ASSETS=$(find "$EXTRACT_DIR" -maxdepth 3 -type d -name "flutter_assets" | head -1)
if [[ -n "$FLUTTER_ASSETS" ]]; then
    cp -r "$FLUTTER_ASSETS" "$OUTPUT_DIR/flutter_assets"
    echo "Copied flutter_assets to: $OUTPUT_DIR/flutter_assets/"
fi

echo ""
echo "── Done ──"
echo "Output: $OUTPUT_DIR"
if [[ -n "$ISAR_FILE" ]]; then
    echo ""
    echo "To run the Isar-to-SQLite migration:"
    echo "  cp $OUTPUT_DIR/db.isar resources/database/db.isar"
    echo "  cd tmp/isar-to-sqlite && make migrate"
fi
