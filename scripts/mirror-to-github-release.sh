#!/usr/bin/env bash
set -euo pipefail

REPO="paradoxe35/wmb-table"
TAG="v1.0.0"
TMP_DIR="tmp/release-assets"
API="https://api.github.com"
UPLOAD_API="https://uploads.github.com"
FORCE_PUSH_BIBLE=0

for arg in "$@"; do
    case "$arg" in
        --force-push-bible)
            FORCE_PUSH_BIBLE=1
            ;;
        *)
            echo "ERROR: Unknown option: $arg" >&2
            echo "Usage: $0 [--force-push-bible]" >&2
            exit 1
            ;;
    esac
done

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
EXISTING_ASSETS=""
page=1
while true; do
    page_assets=$(curl --silent \
        -H "$AUTH_HEADER" \
        "$API/repos/$REPO/releases/$RELEASE_ID/assets?per_page=200&page=$page")
    count=$(echo "$page_assets" | jq 'length')
    if [ "$count" -eq 0 ]; then break; fi
    EXISTING_ASSETS="$EXISTING_ASSETS
$(echo "$page_assets" | jq -r '.[].name')"
    ((page++))
done
EXISTING_ASSETS=$(echo "$EXISTING_ASSETS" | sed '/^$/d')
echo "Found $(echo "$EXISTING_ASSETS" | wc -l) existing assets"

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
        ((skipped++)) || true
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
        ((uploaded++)) || true
        return 0
    else
        echo "  FAIL upload $file_name: $response" >&2
        ((failed++)) || true
        return 1
    fi
}

remove_existing_asset_name() {
    local file_name="$1"
    EXISTING_ASSETS=$(printf '%s\n' "$EXISTING_ASSETS" | grep -vx "$file_name" || true)
}

delete_release_asset_by_name() {
    local file_name="$1"
    local asset_id
    asset_id=$(curl --silent \
        -H "$AUTH_HEADER" \
        "$API/repos/$REPO/releases/$RELEASE_ID/assets?per_page=200" \
        | jq -r ".[] | select(.name == \"$file_name\") | .id // empty")

    if [ -z "$asset_id" ]; then
        return 0
    fi

    echo "  Replacing existing $file_name (asset $asset_id)..."
    curl --silent -X DELETE -H "$AUTH_HEADER" \
        "$API/repos/$REPO/releases/assets/$asset_id" >/dev/null
    remove_existing_asset_name "$file_name"
}

# --- Download and upload language index files --------------------------------

echo ""
echo "=== Language index files ==="

LANG_JSON=$(node scripts/extract-language-files.mjs 2>/dev/null)
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
        ((skipped++)) || true
        continue
    fi

    LOCAL_PATH="$TMP_DIR/$FILE_NAME"

    if curl --fail --progress-bar --show-error --retry 3 --location -o "$LOCAL_PATH" "$URL"; then
        upload_file "$LOCAL_PATH" || true
        rm -f "$LOCAL_PATH"
    else
        echo "  FAIL download from $URL" >&2
        ((failed++)) || true
    fi
done

# --- Upload Bible database files ---------------------------------------------

BIBLE_DIR="build/bibles"

echo ""
echo "=== Bible database files ==="

if [ -d "$BIBLE_DIR" ]; then
    # Always re-upload bible-index.json (it changes when versions are added/removed)
    INDEX_FILE="$BIBLE_DIR/bible-index.json"
    if [ -f "$INDEX_FILE" ]; then
        delete_release_asset_by_name "bible-index.json"
        upload_file "$INDEX_FILE" "application/json"
    fi

    if [ "$FORCE_PUSH_BIBLE" -eq 1 ]; then
        echo "  Force push enabled for Bible SQLite assets."
    fi

    for bible_file in "$BIBLE_DIR"/*.sqlite; do
        [ -f "$bible_file" ] || continue
        if [ "$FORCE_PUSH_BIBLE" -eq 1 ]; then
            delete_release_asset_by_name "$(basename "$bible_file")"
        fi
        upload_file "$bible_file"
    done
else
    echo "  No Bible files found in $BIBLE_DIR"
    echo "  Run: node scripts/build-bible-db.mjs"
fi

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
