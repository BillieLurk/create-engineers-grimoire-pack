# Create Engineers' Grimoire

A custom Minecraft modpack built around Create (and its addon ecosystem),
Ars Nouveau, deep-sea exploration, and hard-mode dungeons/bosses.

- **Minecraft**: 1.21.1
- **Loader**: NeoForge (pinned version in `modrinth.index.json`)
- **Format**: standard `.mrpack` (Modrinth modpack format) - source-controlled here
  as an unpacked directory (`modrinth.index.json` + `overrides/`)

## Building the .mrpack

From this directory:

```sh
zip -r -X ../Create-Engineers-Grimoire.mrpack modrinth.index.json overrides
```

## Layout

- `modrinth.index.json` - the pack manifest: every mod, its Modrinth download
  URL, and sha1/sha512 hashes. Mods are added by appending file entries here
  (see conversation history / commit log for the process used: resolve via
  the Modrinth API, verify game version + loader + dependencies before
  adding).
- `overrides/kubejs/server_scripts/treasure_loot.js` - custom loot-table
  injection script (requires KubeJS + LootJS, both in the pack). Adds items
  from installed content mods into vanilla AND modded-overhaul structure loot
  tables (dungeons, strongholds, nether fortresses, ocean monuments,
  underwater ruins, bastions, end cities, ancient cities, mansions), tiered
  by structure risk. See the file itself for the full breakdown and why each
  tier's regex targets both vanilla and overhaul-mod loot table namespaces.

## Deployment locations (this machine)

- **Client instance** (Prism Launcher):
  `~/.local/share/PrismLauncher/instances/Create-Engineers-Grimoire/`
- **Server**: `~/minecraft-server/create-engineers-grimoire/`
  (run via `tmux new-session -d -s mcserver "./run.sh nogui; exec bash"`,
  attach with `tmux attach -t mcserver`)
- **Friend install package**: `~/Downloads/Create-Engineers-Grimoire-Friend-Package.zip`
  (the `.mrpack` + `INSTALL.txt` for Windows friends using Prism Launcher)

## Client-only mods excluded from the server

These are in the pack for client rendering/input only and are NOT copied to
the server's `mods/` folder (confirmed via Modrinth's server_side metadata):
Iris, Iris & Oculus Flywheel Compat, Mouse Tweaks, Sodium.

## Workflow for adding/removing a mod

1. Resolve the mod on Modrinth: confirm a build exists for `1.21.1` +
   `neoforge`, check its `dependencies` array for required libs, and add
   those too.
2. Add file entries to `modrinth.index.json` (path `mods/<filename>`, hashes,
   download URL, file size).
3. Rebuild the `.mrpack` (see command above) and copy it to
   `~/Downloads/Create-Engineers-Grimoire.mrpack` and into
   `~/Downloads/Create-Engineers-Grimoire-Install/` (then re-zip the friend
   package).
4. Drop the new jar(s) directly into the live Prism instance's `mods/`
   folder (no need to fully reimport).
5. If the mod is server-side required, copy it into the server's `mods/`
   folder too, then restart the server (`stop` in the tmux console, then
   relaunch `run.sh`).
6. Commit the change here with a description of what was added and why.
