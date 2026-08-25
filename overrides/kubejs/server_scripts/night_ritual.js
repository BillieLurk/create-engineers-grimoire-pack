// The "night ritual" - replaces the old lectern/signed-book shrine entirely.
//
// How it works for players:
//   1. Craft a Book and Quill (paper + feather + ink sac - cheap, no lectern
//      needed).
//   2. Right-click in the air to open the writing screen, type your
//      question, click Done. Do NOT sign it.
//   3. At night, sneak (hold shift) and right-click again with that same
//      book in hand. This performs the ritual: sound + particles + a title
//      card, then the question is submitted to the god.
//   4. Once per Minecraft night per player (tracked by day count, not a
//      real-time timer), and capped at MAX_WORDS words.
//   5. The book's pages are cleared after a successful ritual, so the next
//      one requires writing a fresh question.
//
// This script only detects the ritual and writes a pending-request file -
// it makes NO network calls (KubeJS runs on the server tick thread and
// must never block on I/O). The external god_watcher.py process picks up
// the request, calls the AI, and delivers the answer as a written book.

var KubeJSPaths4 = Java.loadClass("dev.latvian.mods.kubejs.KubeJSPaths")
var DataComponents3 = Java.loadClass("net.minecraft.core.component.DataComponents")

const MAX_WORDS = 60

function ritualCooldownPath() {
    return KubeJSPaths4.DATA.resolve("ritual_cooldowns.json")
}

function loadRitualCooldowns() {
    let path = ritualCooldownPath()
    if (!path.toFile().exists()) return {}
    try {
        let parsed = JSON.parse(String(JsonIO.readString(path)))
        return (parsed && typeof parsed === "object") ? parsed : {}
    } catch (e) {
        return {}
    }
}

function saveRitualCooldowns(map) {
    JsonIO.write(ritualCooldownPath(), JsonIO.parseRaw(JSON.stringify(map)))
}

function extractDraftText(stack) {
    let content = stack.get(DataComponents3.WRITABLE_BOOK_CONTENT)
    if (!content) return null
    let pageList = content.pages()
    let count = pageList.size()
    let pages = []
    for (let i = 0; i < count; i++) {
        pages.push(pageList.get(i).raw())
    }
    return pages.join(" ").replace(/\s+/g, " ").trim()
}

function playRitualFlair(server, playerName) {
    let cmd = "execute as " + playerName + " at @s run "
    server.runCommandSilent(cmd + "particle minecraft:soul_fire_flame ~ ~1 ~ 0.4 0.6 0.4 0.01 40")
    server.runCommandSilent(cmd + "particle minecraft:portal ~ ~1 ~ 0.5 0.5 0.5 0.05 60")
    server.runCommandSilent(cmd + "playsound minecraft:entity.warden.heartbeat ambient @s ~ ~ ~ 1 0.6")
    server.runCommandSilent(cmd + "playsound minecraft:entity.evoker.cast_spell ambient @s ~ ~ ~ 0.7 0.8")
    server.runCommandSilent("title " + playerName + ' title {"text":"THE VEIL THINS...","color":"dark_purple","italic":true}')
    server.runCommandSilent("title " + playerName + ' subtitle {"text":"Your words rise into the dark","color":"gray"}')
}

ItemEvents.rightClicked("minecraft:writable_book", event => {
    try {
        let player = event.getEntity()
        if (!player.isShiftKeyDown()) return // must be sneaking - this is the ritual gesture

        let level = player.level
        if (!level.isNight()) {
            player.sendSystemMessage(Text.of("The veil is thin only at night. Return after dark."))
            return
        }

        let uuid = player.getStringUuid()
        let dayCount = Math.floor(level.getDayTime() / 24000)
        let cooldowns = loadRitualCooldowns()
        if (cooldowns[uuid] !== undefined && cooldowns[uuid] >= dayCount) {
            player.sendSystemMessage(Text.of("You have already called upon the god this night. The stars must turn again."))
            return
        }

        let item = event.getItem()
        let text = extractDraftText(item)
        if (!text || text.length === 0) {
            player.sendSystemMessage(Text.of("Your pages are blank. Write your question first, then sneak and use the book again."))
            return
        }

        let words = text.split(/\s+/).filter(w => w.length > 0)
        if (words.length > MAX_WORDS) {
            player.sendSystemMessage(Text.of("Your plea is too long for the god to hear clearly. Speak in " + MAX_WORDS + " words or fewer."))
            return
        }

        cooldowns[uuid] = dayCount
        saveRitualCooldowns(cooldowns)

        let name = player.getGameProfile().getName()
        let request = {
            time: Date.now(),
            uuid: uuid,
            name: name,
            dimension: String(player.level.dimension),
            x: Math.round(player.getX()),
            y: Math.round(player.getY()),
            z: Math.round(player.getZ()),
            question: text
        }

        let requestPath = KubeJSPaths4.DATA.resolve("prayer_requests/" + uuid + "-" + request.time + ".json")
        let requestDir = requestPath.getParent()
        if (!requestDir.toFile().exists()) requestDir.toFile().mkdirs()
        JsonIO.write(requestPath, JsonIO.parseRaw(JSON.stringify(request)))

        // Clear the book so next ritual needs a freshly-written question
        item.set(DataComponents3.WRITABLE_BOOK_CONTENT, Java.loadClass("net.minecraft.world.item.component.WritableBookContent").EMPTY)

        playRitualFlair(player.getServer(), name)
        player.sendSystemMessage(Text.of("Your words rise into the dark... await a sign."))
    } catch (e) {
        console.log("night_ritual: error handling ritual - " + e)
    }
})
