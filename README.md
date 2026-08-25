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
- `overrides/kubejs/server_scripts/fish_fillet_compat.js` - registers fish
  items from Critters and Companions (`koi_fish`) and Naturalist (`bass`,
  `catfish`, `anglerfish`, `blobfish`) with Aquaculture 2's knife-fillet
  recipe. **This is not data/tag driven** - Aquaculture's
  `crafting_special_fish_fillet` recipe is a hardcoded Java `CustomRecipe`
  that only checks item membership in a static Java registry,
  `AquacultureAPI.FISH_DATA` (confirmed via `javap -c` on
  `FishFilletRecipe.class` and `FishWeightHandler.class` in the Aquaculture
  jar - there is no tag or JSON recipe path for this at all). The script
  calls `AquacultureAPI.FISH_DATA.add(item, minWeight, maxWeight,
  filletAmount)` directly via `Java.loadClass`, with weight/fillet numbers
  chosen to match the scale of Aquaculture's own fish (reference table is
  in `FishWeightHandler.registerFishData()` inside the jar). It must run
  from `ServerEvents.loaded` in a `server_scripts` file, **not**
  `startup_scripts`, because `AquacultureAPI.FISH_DATA` isn't populated
  until Aquaculture's own `FMLCommonSetupEvent` handler runs - calling it
  from `startup_scripts` risks a null field. Because it hooks a one-time
  load event, changes to this file need a full server restart to take
  effect, not just `/reload`.

## Myths of the Sea tuning

`overrides/config/myths_of_the_sea-common.toml` - another file that had
drifted (live-edited on the server, never committed). Lowered
`leviathanNormalSpawnProbability` from the mod's default of 7 to 1: this is
specifically the "clear day, no rain, no thunder" spawn-roll probability
(out of a 0-100 roll) in `LeviathanEntity.surfaceWaterSpawnRulesAndNotNearLeviathan()`
(confirmed via `javap -c` on the mod jar) - the night/rain/thunder-boosted
probabilities (15/35/50) were left untouched since the ask was specifically
about daytime encounters. Now tracked in `OVERRIDE_FILES` in both update
scripts like the kubejs scripts, so it won't drift again.

## Food mod (Farmer's Delight + compat)

- **Farmer's Delight** - new crops, cooking mechanics (cutting board, stove,
  cooking pot), and dishes. Client+server required like any normal content
  mod.
- **Aquaculture Delight** - compat addon: lets Aquaculture 2 fish (and the
  fillets from `fish_fillet_compat.js`, including the Critters and
  Companions/Naturalist fish it adds) be used in Farmer's Delight cooking
  pot/cutting board recipes, plus mutual knife compatibility between the two
  mods.
- **Create: Delightful Cooking** - a **datapack** (not a mod jar - listed as
  `loaders: ["datapack"]` on Modrinth), so it can't just be dropped in
  `mods/`. Shipped at `world/datapacks/create_delightful_cooking_1.0.0.zip`
  in the manifest, which only actually works because the dedicated server's
  world is named `world` (confirmed from its own log lines, e.g.
  `ServerLevel[world]`) - this path assumption would break if the world were
  ever renamed. It's `server: required, client: optional` since datapacks are
  server-side content; friends' clients downloading a copy under their own
  `.minecraft/world/` is harmless and inert (that's not a real save path).
  Verified via `/datapack list enabled` after a restart - it auto-enabled on
  its own (`file/create_delightful_cooking_1.0.0.zip (world)`), no manual
  `/datapack enable` needed. If a future world datapack doesn't show up
  there, check `/datapack list available` first (it'll be listed disabled)
  before assuming something's broken.

## Animation overhaul (mobs + player)

Fresh Animations, its `+All_Extensions` pack, and its `+Player` extension
were already in the pack (`overrides/resourcepacks/`), but they are pure
resource packs - by themselves they only reskin/retexture the existing
vanilla model shape. Their custom animated geometry (extra bones for tails,
wings, jaws, etc. beyond what a vanilla model has) requires **Entity Model
Features (EMF)** to interpret at all, and EMF itself requires **Entity
Texture Features (ETF)** - confirmed directly from Fresh Animations' and
FA+Player's own project pages ("OptiFine or EMF Required" /
"requires both Entity Model and Entity Texture Features (EMF & ETF)").
Neither was in the pack, meaning the resource packs were silently doing far
less than intended (vanilla-shaped models only, no extra animation rigging).
Added both as client-only mods to fix this.

On top of that, added **Not Enough Animations** for the player character
specifically - unlike a resource pack, it's an actual animation mod that
adds new player poses (crawling, ladder/vine climbing, sneaking sway,
swimming) rather than just reshaping the existing ones.

## Deployment locations (this machine)

- **Client instance** (Prism Launcher):
  `~/.local/share/PrismLauncher/instances/Create-Engineers-Grimoire/`
- **Server**: `~/minecraft-server/create-engineers-grimoire/`
  (run via `tmux new-session -d -s mcserver "./run.sh nogui; exec bash"`,
  attach with `tmux attach -t mcserver`)
- **Friend install package**: `~/Downloads/Create-Engineers-Grimoire-Friend-Package.zip`
  (the `.mrpack` + `INSTALL.txt` for Windows friends using Prism Launcher)

## Client-only / server-only mods

Every file entry in `modrinth.index.json` has an `env` field (standard
`.mrpack` spec) marking `client`/`server` as `required` or `unsupported`.
Currently server-unsupported: Iris, Iris & Oculus Flywheel Compat, Mouse
Tweaks, Sodium, all three shaderpacks, Entity Model Features (EMF), Entity
Texture Features (ETF), and Not Enough Animations. This is what both the
manual deploy process and the auto-update scripts use to decide what goes
where.

## Auto-update system (GitHub-hosted, not a mod)

We tried a third-party mod (SyncModPack) for this and pulled it - closed
source, brand new, zero track record, and it auto-executes based on server
instructions with no human review step. Instead, this repo itself IS the
distribution mechanism:

- **Manifest host**: this repo, public, at
  https://github.com/BillieLurk/create-engineers-grimoire-pack . Friends'
  and the server's update scripts fetch
  `https://raw.githubusercontent.com/BillieLurk/create-engineers-grimoire-pack/main/modrinth.index.json`
  directly - plain HTTPS GET, no auth, fully readable/auditable by anyone.
- **Client script**: `scripts/update-modpack.ps1` (Windows, PowerShell -
  built in, no install needed) and `scripts/update-modpack.sh` (macOS -
  needs curl + python3, both ship with macOS). Friends wire one of these in
  as their Prism instance's **Pre-launch command** (Edit Instance ->
  Settings -> Custom Commands), so it runs automatically every launch.
- **Server script**: the same `update-modpack.sh`, run with
  `MODE=server INSTANCE_DIR=~/minecraft-server/create-engineers-grimoire`.
- **How it decides what to do**: compares `pack_version` in the manifest
  against a local cache file (`.pack-manifest-installed.json` in the
  instance dir). If unchanged, no-ops immediately. If changed, diffs the
  file list (filtered by `env` for that mode), downloads new/changed files
  straight from Modrinth (sha1-verified after download, deleted and retried
  next run on mismatch), and deletes files no longer in the manifest.
- **Known quirk**: `raw.githubusercontent.com` caches content for a few
  minutes after a push. Don't be surprised if a fresh push doesn't show up
  immediately - wait ~2-5 minutes before assuming something's wrong.

### Publishing a pack update

1. Edit `modrinth.index.json` in this repo (add/remove/change file entries,
   set `env` correctly for any new file).
2. **Increment `pack_version`** - this is the only thing that triggers
   clients/server to actually do anything. Forgetting this means the update
   silently never ships.
3. Commit and `git push`.
4. Wait a few minutes for the GitHub raw CDN to catch up (see quirk above),
   then verify: `curl -sL <raw manifest URL> | jq .pack_version`.
5. Run the sync script against this machine's server:
   `INSTANCE_DIR=~/minecraft-server/create-engineers-grimoire MODE=server bash scripts/update-modpack.sh`,
   then restart the server (`stop` in the tmux console, relaunch `run.sh`).
6. Optionally also sync the local Prism client instance the same way with
   `MODE=client`.
7. Friends get the update automatically next time they launch (if they set
   up the pre-launch command) - nothing further to send them, **unless**
   the update adds a mod that didn't exist in their local instance's Java
   args / needs a NeoForge version bump, in which case a fresh `.mrpack`
   reimport may still be needed. For routine mod add/remove, the auto-update
   script is sufficient on its own.

### First-time friend install

Friends still need the full `.mrpack` once, to get Prism/NeoForge/Java set
up in the first place. That package - the `.mrpack`, `INSTALL.txt`, and
both updater scripts - lives at
`~/Downloads/Create-Engineers-Grimoire-Friend-Package.zip`. Rebuild it
whenever the `.mrpack` changes:

```sh
cd ~/Work/create-engineers-grimoire
zip -r -X ~/Downloads/Create-Engineers-Grimoire.mrpack modrinth.index.json overrides
cp ~/Downloads/Create-Engineers-Grimoire.mrpack ~/Downloads/Create-Engineers-Grimoire-Install/
cp scripts/update-modpack.ps1 scripts/update-modpack.sh ~/Downloads/Create-Engineers-Grimoire-Install/
cd ~/Downloads
rm -f Create-Engineers-Grimoire-Friend-Package.zip
zip -r -j Create-Engineers-Grimoire-Friend-Package.zip Create-Engineers-Grimoire-Install/
```

## God AI (in-progress endgame feature)

An in-world oracle/DM feature: players write a question in a Book & Quill,
place it in a shrine Lectern, and receive an answer written into a
returned book, from "the god of the world" (an AI backed by the Anthropic
API, using the modpack's own content as context — see
`knowledge/modpack-lore.md`).

**Status: groundwork only, not live yet.** Blocked on the user providing
an Anthropic API key (kept out of this repo and out of any conversation
transcript - written directly to
`~/minecraft-server/create-engineers-grimoire/secrets/anthropic_api_key.txt`,
chmod 600, never committed, never shipped to clients).

**Security invariant: the API key must never reach players.** It lives
only on the host, used only by a server-side watcher process that isn't
part of the mod pack. No KubeJS script, no file in this repo, and nothing
in the friend package may ever reference or transmit it.

### Built so far

- `knowledge/modpack-lore.md` - the full context document fed to the AI:
  pack identity/tone instructions, a Dungeon-Master directive for
  quest-giving, real quest hooks tied to actual pack content tiered by
  progression, and a `## Player Knowledge` section populated per-request.
- `scripts/player_tracker.js` - a KubeJS server script, ticks every 600
  ticks (30s), dumps live state for every online player (position,
  dimension, health/food/XP, held items, armor, game mode) to
  `player_metrics_live.json` at the **server's root directory** (despite
  the name, `KubeJSPaths.DATA` does not resolve to `kubejs/data/` in this
  KubeJS build - verified empirically, not assumed).
- `scripts/chat_logger.js` - a KubeJS server script (`PlayerEvents.chat`)
  that appends every chat message to a rolling `chat_log.json` (also at
  server root, capped at 500 entries) - a passive, zero-API-cost log.

Both scripts hard-learned real KubeJS 2101 (MC 1.21.1) API quirks the hard
way - useful if extending them:
- Raw `java.*` and bare class names (e.g. `KubeJSPaths`) are **not** in
  script scope. Use `Java.loadClass("fully.qualified.Name")` (not
  `Java.type`, which doesn't exist in this build).
- `server_scripts` files share one top-level scope - `const`/`let` at top
  level in two different files collides. Use `var`, or scope things inside
  functions.
- Event names don't always match intuition:
  `PlayerEvents.chat`, not `ServerEvents.chatMessage`. When unsure, don't
  guess - `javap -p` the relevant class from the installed KubeJS jar
  (`unzip` it to inspect) to get real method/event names, then test live
  against the running server and read the actual log output.

### Still to build (once the API key is provided)

1. **Structure/quest-hook proximity**: use the server's own `/locate`
   structure command (issued via the same console-access mechanism used
   throughout this project) to tell the AI how far and which direction
   the nearest strongholds/monuments/etc. are from the requesting player,
   so quest-giving and "where am I" answers can reference real nearby
   points of interest.
2. **Chat batching for player profiles**: an external (non-KubeJS, runs
   on the host) process that periodically (on a timer, NOT per-message)
   reads `chat_log.json`, makes ONE summarization API call per batch to
   extract/update per-player personality/interest notes, and merges them
   into a persistent profile file - deliberately batched to keep API
   usage and cost low, per explicit user instruction.
3. **Prayer detection**: a KubeJS script watching the shrine Lectern(s)
   for a newly-placed signed Written Book, extracting its text, applying
   a per-player cooldown, and writing a pending-request file.
4. **The watcher/bridge** (external, host-side, NOT KubeJS - KubeJS
   scripts run on the server tick thread and must not make blocking
   network calls): polls for pending requests, merges
   `modpack-lore.md` + live player profile + nearby-structure data +
   chat-derived personality notes into a prompt, calls the Anthropic API,
   and uses the server console to hand the player back a written book
   with the response.
5. Player kill-count and advancement data should be pulled from vanilla's
   own `world/stats/<uuid>.json` and `world/advancements/<uuid>.json`
   (both plain JSON, maintained automatically - no KubeJS needed) and
   merged into the same profile the watcher builds.
