// Periodically dumps live player state (position, equipment, vitals) to a
// JSON file so an external process can build a full player profile for the
// "god AI" feature. Runs every INTERVAL_TICKS ticks to avoid per-tick cost.
// Combined externally with world/stats/<uuid>.json and
// world/advancements/<uuid>.json (both vanilla-maintained plain JSON) for
// kill counts and achievements.

const INTERVAL_TICKS = 600 // 30 seconds at 20 tps
let tickCounter = 0
var KubeJSPaths = Java.loadClass("dev.latvian.mods.kubejs.KubeJSPaths")

function itemInfo(stack) {
    if (!stack || stack.isEmpty()) return null
    return {
        id: stack.getItem().toString(),
        name: stack.getHoverName().getString(),
        count: stack.getCount()
    }
}

ServerEvents.tick(event => {
    tickCounter++
    if (tickCounter < INTERVAL_TICKS) return
    tickCounter = 0

    let players = []

    event.server.getPlayerList().getPlayers().forEach(player => {
        let armorSlots = player.getInventory().armor
        let armor = {
            head: itemInfo(armorSlots.get(3)),
            chest: itemInfo(armorSlots.get(2)),
            legs: itemInfo(armorSlots.get(1)),
            feet: itemInfo(armorSlots.get(0))
        }

        players.push({
            name: player.getGameProfile().getName(),
            uuid: player.getStringUuid(),
            dimension: player.level().dimension().location().toString(),
            x: Math.round(player.getX()),
            y: Math.round(player.getY()),
            z: Math.round(player.getZ()),
            health: player.getHealth(),
            maxHealth: player.getMaxHealth(),
            foodLevel: player.getFoodData().getFoodLevel(),
            gameMode: player.gameMode.getGameModeForPlayer().name(),
            mainHand: itemInfo(player.getMainHandItem()),
            offHand: itemInfo(player.getOffhandItem()),
            armor: armor,
            xpLevel: player.experienceLevel
        })
    })

    let out = {
        updatedAt: Date.now(),
        players: players
    }

    try {
        let path = KubeJSPaths.DATA.resolve("player_metrics_live.json")
        JsonIO.write(path, JsonIO.parseRaw(JSON.stringify(out)))
    } catch (e) {
        console.log("player_tracker: failed to write live.json - " + e)
    }
})
