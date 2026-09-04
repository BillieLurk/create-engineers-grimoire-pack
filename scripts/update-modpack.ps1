# Create Engineers' Grimoire - client updater (Windows)
#
# Syncs this machine's Prism Launcher instance to whatever the pack manifest
# says it should be. Downloads new/changed mods straight from Modrinth
# (verified by sha1), removes mods no longer in the pack, and syncs the
# kubejs loot script. Safe to run every launch - it's a no-op if nothing
# changed.
#
# SETUP: set $InstanceDir below to your instance's "minecraft" folder, e.g.
#   C:\Users\<you>\AppData\Roaming\PrismLauncher\instances\Create-Engineers-Grimoire\.minecraft
# Then either double-click this script before playing, or (better) set it as
# a Pre-Launch command in Prism: right-click instance -> Edit Instance ->
# Settings -> Custom Commands -> enable "Pre-launch command" and set it to:
#   powershell -ExecutionPolicy Bypass -File "C:\path\to\update-modpack.ps1"

$ManifestUrl = "https://raw.githubusercontent.com/BillieLurk/create-engineers-grimoire-pack/main/modrinth.index.json"
$InstanceDir = "$env:APPDATA\PrismLauncher\instances\Create-Engineers-Grimoire\.minecraft"
$Mode = "client"

$ErrorActionPreference = "Stop"
$CacheFile = Join-Path $InstanceDir ".pack-manifest-installed.json"

Write-Host "Create Engineers' Grimoire updater - checking for pack updates..."

if (-not (Test-Path $InstanceDir)) {
    Write-Host "ERROR: Instance folder not found: $InstanceDir"
    Write-Host "Edit `$InstanceDir at the top of this script to point at your instance's .minecraft folder."
    exit 1
}

try {
    $remote = Invoke-RestMethod -Uri $ManifestUrl -UseBasicParsing
} catch {
    Write-Host "Could not reach the manifest URL. Skipping update, launching as-is."
    Write-Host $_.Exception.Message
    exit 0
}

$local = $null
if (Test-Path $CacheFile) {
    $local = Get-Content $CacheFile -Raw | ConvertFrom-Json
}

if ($local -and $local.pack_version -eq $remote.pack_version) {
    Write-Host "Already up to date (pack v$($remote.pack_version))."
    exit 0
}

Write-Host "Updating pack to v$($remote.pack_version)..."

function Applies($file, $mode) {
    if (-not $file.env) { return $true }
    $val = $file.env.$mode
    return ($val -ne "unsupported")
}

$remoteApplicable = @{}
foreach ($f in $remote.files) {
    if (Applies $f $Mode) { $remoteApplicable[$f.path] = $f }
}

$localApplicable = @{}
if ($local) {
    foreach ($f in $local.files) {
        if (Applies $f $Mode) { $localApplicable[$f.path] = $f }
    }
}

# Remove files that are no longer in the pack
foreach ($path in $localApplicable.Keys) {
    if (-not $remoteApplicable.ContainsKey($path)) {
        $full = Join-Path $InstanceDir $path
        if (Test-Path $full) {
            Write-Host "Removing (no longer in pack): $path"
            Remove-Item $full -Force
        }
    }
}

# Download new or changed files
foreach ($path in $remoteApplicable.Keys) {
    $rf = $remoteApplicable[$path]
    $lf = $localApplicable[$path]
    $needsDownload = $true
    $full = Join-Path $InstanceDir $path

    if ($lf -and $lf.hashes.sha1 -eq $rf.hashes.sha1 -and (Test-Path $full)) {
        $needsDownload = $false
    }

    if ($needsDownload) {
        Write-Host "Downloading: $path"
        $dir = Split-Path $full -Parent
        if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
        Invoke-WebRequest -Uri $rf.downloads[0] -OutFile $full -UseBasicParsing

        $actualHash = (Get-FileHash -Path $full -Algorithm SHA1).Hash.ToLower()
        if ($actualHash -ne $rf.hashes.sha1.ToLower()) {
            Write-Host "  WARNING: hash mismatch for $path - deleting, will retry next run."
            Remove-Item $full -Force
        }
    }
}

# Sync override files (e.g. the kubejs loot script) - small, so always refresh
$overrideFiles = @(
    "kubejs/server_scripts/treasure_loot.js",
    "kubejs/server_scripts/fish_fillet_compat.js",
    "kubejs/server_scripts/player_tracker.js",
    "kubejs/server_scripts/chat_logger.js",
    "kubejs/server_scripts/night_ritual.js",
    "kubejs/server_scripts/calling_ritual.js",
    "config/aquaculture-common.toml"
)
$rawBase = "https://raw.githubusercontent.com/BillieLurk/create-engineers-grimoire-pack/main/overrides"
foreach ($rel in $overrideFiles) {
    $full = Join-Path $InstanceDir $rel
    $dir = Split-Path $full -Parent
    if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
    try {
        Invoke-WebRequest -Uri "$rawBase/$rel" -OutFile $full -UseBasicParsing
    } catch {
        Write-Host "  Could not sync override: $rel (non-fatal)"
    }
}

$remote | ConvertTo-Json -Depth 10 | Set-Content $CacheFile
Write-Host "Update complete - now on pack v$($remote.pack_version)."
