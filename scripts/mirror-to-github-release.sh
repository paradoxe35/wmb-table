#!/usr/bin/env bash
set -euo pipefail

REPO="paradoxe35/wmb-table"
TAG="v1.0.0"
TMP_DIR="tmp/release-assets"
API="https://api.github.com"
UPLOAD_API="https://uploads.github.com"

# --- Prerequisites -----------------------------------------------------------

if [ -z "${GITHUB_TOKEN:-}" ]; then
    echo "GitHub personal access token required (repo scope)."
    echo "Create one at https://github.com/settings/tokens"
    read -rsp "Enter token: " GITHUB_TOKEN
    echo ""
    if [ -z "$GITHUB_TOKEN" ]; then
        echo "ERROR: No token provided." >&2
        exit 1
    fi
fi

for cmd in curl jq; do
    if ! command -v "$cmd" &>/dev/null; then
        echo "ERROR: $cmd is required but not found" >&2
        exit 1
    fi
done

AUTH_HEADER="Authorization: token $GITHUB_TOKEN"

# --- Ensure release exists ---------------------------------------------------

echo "Checking release $TAG..."
RELEASE_JSON=$(curl --silent --fail-with-body \
    -H "$AUTH_HEADER" \
    "$API/repos/$REPO/releases/tags/$TAG" 2>/dev/null || echo "")

if [ -z "$RELEASE_JSON" ] || echo "$RELEASE_JSON" | jq -e '.message' &>/dev/null; then
    echo "Creating release $TAG..."
    RELEASE_JSON=$(curl --silent --fail-with-body \
        -H "$AUTH_HEADER" \
        -H "Content-Type: application/json" \
        -X POST "$API/repos/$REPO/releases" \
        -d "{\"tag_name\":\"$TAG\",\"name\":\"$TAG\",\"body\":\"Language pack assets\"}")
fi

RELEASE_ID=$(echo "$RELEASE_JSON" | jq -r '.id')
if [ "$RELEASE_ID" = "null" ] || [ -z "$RELEASE_ID" ]; then
    echo "ERROR: Could not get release ID" >&2
    echo "$RELEASE_JSON" >&2
    exit 1
fi

echo "Release ID: $RELEASE_ID"

# --- Get existing assets for idempotency -------------------------------------

echo "Fetching existing release assets..."
EXISTING_ASSETS=$(curl --silent \
    -H "$AUTH_HEADER" \
    "$API/repos/$REPO/releases/$RELEASE_ID/assets" | jq -r '.[].name')

uploaded=0
skipped=0
failed=0

mkdir -p "$TMP_DIR"

upload_file() {
    local file_path="$1"
    local file_name
    file_name=$(basename "$file_path")
    local content_type="${2:-application/octet-stream}"

    if echo "$EXISTING_ASSETS" | grep -qx "$file_name"; then
        echo "  SKIP $file_name (already uploaded)"
        ((skipped++))
        return 0
    fi

    local response
    response=$(curl --silent --fail-with-body \
        -H "$AUTH_HEADER" \
        -H "Content-Type: $content_type" \
        -X POST \
        --data-binary @"$file_path" \
        "$UPLOAD_API/repos/$REPO/releases/$RELEASE_ID/assets?name=$file_name" 2>&1)

    if echo "$response" | jq -e '.id' &>/dev/null; then
        echo "  UPLOADED $file_name"
        ((uploaded++))
        return 0
    else
        echo "  FAIL upload $file_name: $response" >&2
        ((failed++))
        return 1
    fi
}

# --- Download and upload language index files --------------------------------

echo ""
echo "=== Language index files ==="

LANG_JSON=$(npx tsx scripts/extract-language-files.ts)
LANG_COUNT=$(echo "$LANG_JSON" | jq length)

echo "Found $LANG_COUNT languages in data.sqlite"
echo ""

for i in $(seq 0 $((LANG_COUNT - 1))); do
    FILE_NAME=$(echo "$LANG_JSON" | jq -r ".[$i].fileName")
    URL=$(echo "$LANG_JSON" | jq -r ".[$i].url")
    CODE=$(echo "$LANG_JSON" | jq -r ".[$i].code")

    echo "[$((i + 1))/$LANG_COUNT] $CODE ($FILE_NAME)"

    if echo "$EXISTING_ASSETS" | grep -qx "$FILE_NAME"; then
        echo "  SKIP (already uploaded)"
        ((skipped++))
        continue
    fi

    LOCAL_PATH="$TMP_DIR/$FILE_NAME"

    if curl --fail --silent --show-error --retry 3 --location -o "$LOCAL_PATH" "$URL"; then
        upload_file "$LOCAL_PATH"
        rm -f "$LOCAL_PATH"
    else
        echo "  FAIL download from $URL" >&2
        ((failed++))
    fi
done

# --- Summary -----------------------------------------------------------------

echo ""
echo "=== Summary ==="
echo "  Uploaded: $uploaded"
echo "  Skipped:  $skipped"
echo "  Failed:   $failed"

if [ "$failed" -gt 0 ]; then
    echo ""
    echo "Some files failed. Re-run the script to retry (idempotent)."
    exit 1
fi
