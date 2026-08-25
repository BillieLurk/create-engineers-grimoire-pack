#!/usr/bin/env bash
# Create Engineers' Grimoire - client/server updater (macOS / Linux)
#
# Syncs this machine's mods folder to whatever the pack manifest says it
# should be. Downloads new/changed mods straight from Modrinth (verified by
# sha1), removes mods no longer in the pack, and syncs the kubejs loot
# script. Safe to run every launch - it's a no-op if nothing changed.
#
# SETUP (macOS client): set INSTANCE_DIR below to your instance's
#   ".minecraft" folder, e.g.
#   "$HOME/Library/Application Support/PrismLauncher/instances/Create-Engineers-Grimoire/.minecraft"
# Then either double-click/run this script before playing, or (better) set
# it as a Pre-Launch command in Prism: right-click instance -> Edit Instance
# -> Settings -> Custom Commands -> enable "Pre-launch command":
#   /bin/bash "/path/to/update-modpack.sh"
#
# SETUP (this Linux server): set MODE=server and INSTANCE_DIR to the
# server's root folder (the one containing mods/), then run this before
# each server start.
#
# Requires: curl, python3 (used only for JSON parsing - ships with macOS).

set -euo pipefail

MANIFEST_URL="https://raw.githubusercontent.com/BillieLurk/create-engineers-grimoire-pack/main/modrinth.index.json"
INSTANCE_DIR="${INSTANCE_DIR:-$HOME/Library/Application Support/PrismLauncher/instances/Create-Engineers-Grimoire/.minecraft}"
MODE="${MODE:-client}"

CACHE_FILE="$INSTANCE_DIR/.pack-manifest-installed.json"
TMP_REMOTE=$(mktemp)
trap 'rm -f "$TMP_REMOTE"' EXIT

echo "Create Engineers' Grimoire updater - checking for pack updates..."

if [ ! -d "$INSTANCE_DIR" ]; then
    echo "ERROR: Instance folder not found: $INSTANCE_DIR"
    echo "Set INSTANCE_DIR at the top of this script (or as an env var) to your .minecraft folder."
    exit 1
fi

if ! curl -fsSL "$MANIFEST_URL" -o "$TMP_REMOTE"; then
    echo "Could not reach the manifest URL. Skipping update, launching as-is."
    exit 0
fi

REMOTE_VERSION=$(python3 -c "import json; print(json.load(open('$TMP_REMOTE'))['pack_version'])")

if [ -f "$CACHE_FILE" ]; then
    LOCAL_VERSION=$(python3 -c "import json; print(json.load(open('$CACHE_FILE')).get('pack_version', -1))" 2>/dev/null || echo -1)
else
    LOCAL_VERSION=-1
fi

if [ "$LOCAL_VERSION" == "$REMOTE_VERSION" ]; then
    echo "Already up to date (pack v$REMOTE_VERSION)."
    exit 0
fi

echo "Updating pack to v$REMOTE_VERSION..."

python3 - "$TMP_REMOTE" "$CACHE_FILE" "$MODE" "$INSTANCE_DIR" <<'PYEOF'
import json, sys, os, hashlib, urllib.request

remote_path, cache_path, mode, instance_dir = sys.argv[1:5]

def applicable(files, mode):
    out = {}
    for f in files:
        env = f.get("env")
        if env and env.get(mode) == "unsupported":
            continue
        out[f["path"]] = f
    return out

remote = json.load(open(remote_path))
remote_files = applicable(remote["files"], mode)

local_files = {}
if os.path.exists(cache_path):
    try:
        local = json.load(open(cache_path))
        local_files = applicable(local.get("files", []), mode)
    except Exception:
        pass

# Remove files no longer in the pack
for path in list(local_files):
    if path not in remote_files:
        full = os.path.join(instance_dir, path)
        if os.path.exists(full):
            print(f"Removing (no longer in pack): {path}")
            os.remove(full)

# Download new or changed files
for path, rf in remote_files.items():
    full = os.path.join(instance_dir, path)
    lf = local_files.get(path)
    needs_download = True
    if lf and lf.get("hashes", {}).get("sha1") == rf["hashes"]["sha1"] and os.path.exists(full):
        needs_download = False

    if needs_download:
        print(f"Downloading: {path}")
        os.makedirs(os.path.dirname(full), exist_ok=True)
        urllib.request.urlretrieve(rf["downloads"][0], full)

        sha1 = hashlib.sha1()
        with open(full, "rb") as fh:
            for chunk in iter(lambda: fh.read(65536), b""):
                sha1.update(chunk)
        if sha1.hexdigest().lower() != rf["hashes"]["sha1"].lower():
            print(f"  WARNING: hash mismatch for {path} - deleting, will retry next run.")
            os.remove(full)

json.dump(remote, open(cache_path, "w"))
PYEOF

# Sync override files (e.g. the kubejs loot script) - small, so always refresh
OVERRIDE_FILES=(
    "kubejs/server_scripts/treasure_loot.js"
    "kubejs/server_scripts/fish_fillet_compat.js"
    "kubejs/server_scripts/player_tracker.js"
    "kubejs/server_scripts/chat_logger.js"
    "kubejs/server_scripts/night_ritual.js"
    "kubejs/server_scripts/calling_ritual.js"
)
RAW_BASE="https://raw.githubusercontent.com/BillieLurk/create-engineers-grimoire-pack/main/overrides"
for rel in "${OVERRIDE_FILES[@]}"; do
    full="$INSTANCE_DIR/$rel"
    mkdir -p "$(dirname "$full")"
    curl -fsSL "$RAW_BASE/$rel" -o "$full" || echo "  Could not sync override: $rel (non-fatal)"
done

echo "Update complete - now on pack v$REMOTE_VERSION."
