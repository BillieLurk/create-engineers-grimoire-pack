# Create Engineers' Grimoire - one-click V2 auto-update setup (Windows)
#
# Run this ONCE, after importing the modpack in Prism Launcher. It will:
#   1. Find your "Create-Engineers-Grimoire" Prism instance automatically.
#   2. Copy update-modpack.ps1 (must be sitting next to this script) into
#      that instance's own folder.
#   3. Edit the instance's settings so it runs automatically before every
#      launch from now on - no manual Prism menus, no typing any paths.
#
# After this, just launch the instance from Prism normally, forever. Never
# delete + re-import to get updates again - that's what wipes your RAM/JVM
# settings. This keeps everything in place.
#
# Safe to re-run if anything changes (e.g. you move the instance) - it just
# re-applies the same setup.

$ErrorActionPreference = "Stop"

function Find-Instance {
    $root = "$env:APPDATA\PrismLauncher\instances"
    if (-not (Test-Path $root)) {
        return $null
    }

    # Prefer the default name first.
    $byName = Join-Path $root "Create-Engineers-Grimoire"
    if (Test-Path (Join-Path $byName "instance.cfg")) {
        return $byName
    }

    # Fall back to scanning every instance's instance.cfg for the pack's
    # managed-pack name, in case it was renamed on import.
    Get-ChildItem -Path $root -Directory | ForEach-Object {
        $cfg = Join-Path $_.FullName "instance.cfg"
        if (Test-Path $cfg) {
            $content = Get-Content $cfg -Raw
            if ($content -match "ManagedPackName=Create-Engineers-Grimoire") {
                return $_.FullName
            }
        }
    }
    return $null
}

Write-Host "Looking for your Create Engineers' Grimoire instance..."
$InstanceDir = Find-Instance

if (-not $InstanceDir) {
    Write-Host ""
    Write-Host "Could not find it automatically under:"
    Write-Host "  $env:APPDATA\PrismLauncher\instances"
    Write-Host ""
    Write-Host "Make sure you've already imported the .mrpack in Prism Launcher first,"
    Write-Host "then run this script again. If you renamed the instance to something"
    Write-Host "unusual, ask Billie for help pointing this script at it."
    exit 1
}

Write-Host "Found instance at: $InstanceDir"

$UpdaterSource = Join-Path $PSScriptRoot "update-modpack.ps1"
if (-not (Test-Path $UpdaterSource)) {
    Write-Host "ERROR: update-modpack.ps1 must be in the same folder as this script."
    exit 1
}

$UpdaterDest = Join-Path $InstanceDir "update-modpack.ps1"
Copy-Item -Path $UpdaterSource -Destination $UpdaterDest -Force
Write-Host "Copied updater to: $UpdaterDest"

$CfgPath = Join-Path $InstanceDir "instance.cfg"
$PreLaunchCmd = "powershell -ExecutionPolicy Bypass -File `"$UpdaterDest`""

$lines = Get-Content $CfgPath
$sawOverride = $false
$sawPreLaunch = $false

$lines = $lines | ForEach-Object {
    if ($_ -match '^OverrideCommands=') {
        $sawOverride = $true
        "OverrideCommands=true"
    } elseif ($_ -match '^PreLaunchCommand=') {
        $sawPreLaunch = $true
        "PreLaunchCommand=$PreLaunchCmd"
    } else {
        $_
    }
}

if (-not $sawOverride) { $lines += "OverrideCommands=true" }
if (-not $sawPreLaunch) { $lines += "PreLaunchCommand=$PreLaunchCmd" }

Set-Content -Path $CfgPath -Value $lines

Write-Host ""
Write-Host "Done! Auto-update is now wired up for this instance."
Write-Host "From now on, just launch it from Prism like normal - it'll check for"
Write-Host "and apply any pack updates automatically before the game starts."
Write-Host ""
Write-Host "(If Prism is currently open, close and reopen it so it picks up the change.)"
