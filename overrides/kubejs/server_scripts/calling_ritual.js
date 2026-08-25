// "The Calling" - a bigger, communal ritual for quick guidance while
// traveling. Distinct from night_ritual.js (the private, book-delivered
// oracle): this one is public, has no night requirement, delivers its
// answer as on-screen text to everyone nearby (not a book), and is meant
// for short, punchy questions rather than long ones.
//
// How it works for players:
//   1. Write your (short) question in a Book and Quill, same as the night
//      ritual - right-click in air, type, Done, don't sign.
//   2. Hold that book in your OFF-HAND, and Blaze Powder in your MAIN
//      HAND.
//   3. Right-click (no sneaking needed) to cast it. Thunder/impact sounds
//      and a bright flash play at your location, audible/visible to
//      everyone nearby - one Blaze Powder is consumed, the book is
//      cleared.
//   4. Within moments, a title card appears on the screen of everyone
//      within CALLING_RADIUS blocks (including you) with the god's
//      answer - no item is given, this is a shared, momentary event.
//
// Once per Minecraft night per player (separate cooldown from the night
// ritual - the two are independent tools for different situations).
//
// Makes no network calls itself - see god_watcher.py for the actual AI
// call and delivery.

var KubeJSPaths5 = Java.loadClass("dev.latvian.mods.kubejs.KubeJSPaths")
var DataComponents4 = Java.loadClass("net.minecraft.core.component.DataComponents")

const MAX_WORDS_CALLING = 30
const CALLING_RADIUS = 64

function callingCooldownPath() {
    return KubeJSPaths5.DATA.resolve("calling_cooldowns.json")
}

function loadCallingCooldowns() {
    let path = callingCooldownPath()
    if (!path.toFile().exists()) return {}
    try {
        let parsed = JSON.parse(String(JsonIO.readString(path)))
        return (parsed && typeof parsed === "object") ? parsed : {}
    } catch (e) {
        return {}
    }
}

function saveCallingCooldowns(map) {
    JsonIO.write(callingCooldownPath(), JsonIO.parseRaw(JSON.stringify(map)))
}

function extractDraftText(stack) {
    let content = stack.get(DataComponents4.WRITABLE_BOOK_CONTENT)
    if (!content) return null
    let pageList = content.pages()
    let count = pageList.size()
    let pages = []
    for (let i = 0; i < count; i++) {
        pages.push(pageList.get(i).raw())
    }
    return pages.join(" ").replace(/\s+/g, " ").trim()
}

function playCallingFlair(server, playerName) {
    let cmd = "execute as " + playerName + " at @s run "
    server.runCommandSilent(cmd + "particle minecraft:flash ~ ~1 ~ 0 0 0 0 1")
    server.runCommandSilent(cmd + "particle minecraft:electric_spark ~ ~1 ~ 1 1 1 0.1 100")
    server.runCommandSilent(cmd + "playsound minecraft:entity.lightning_bolt.thunder ambient @a[distance=.." + CALLING_RADIUS + "] ~ ~ ~ 3 1")
    server.runCommandSilent(cmd + "playsound minecraft:entity.lightning_bolt.impact ambient @a[distance=.." + CALLING_RADIUS + "] ~ ~ ~ 2 1")
}

ItemEvents.rightClicked("minecraft:blaze_powder", event => {
    try {
        let player = event.getEntity()
        let offhand = player.getOffhandItem()
        if (!offhand || offhand.isEmpty() || offhand.getItem().toString() !== "minecraft:writable_book") {
            return // not holding a draft book in off-hand - not a calling attempt
        }

        let uuid = player.getStringUuid()
        let level = player.level
        let dayCount = Math.floor(level.getDayTime() / 24000)
        let cooldowns = loadCallingCooldowns()
        if (cooldowns[uuid] !== undefined && cooldowns[uuid] >= dayCount) {
            player.sendSystemMessage(Text.of("The heavens are spent from your last calling. The stars must turn again."))
            return
        }

        let text = extractDraftText(offhand)
        if (!text || text.length === 0) {
            player.sendSystemMessage(Text.of("Your offhand book is blank. Write your question first."))
            return
        }

        let words = text.split(/\s+/).filter(w => w.length > 0)
        if (words.length > MAX_WORDS_CALLING) {
            player.sendSystemMessage(Text.of("A calling must be brief - " + MAX_WORDS_CALLING + " words or fewer. Speak plainly."))
            return
        }

        cooldowns[uuid] = dayCount
        saveCallingCooldowns(cooldowns)

        let name = player.getGameProfile().getName()
        let request = {
            time: Date.now(),
            uuid: uuid,
            name: name,
            type: "calling",
            radius: CALLING_RADIUS,
            dimension: String(player.level.dimension),
            x: Math.round(player.getX()),
            y: Math.round(player.getY()),
            z: Math.round(player.getZ()),
            question: text
        }

        let requestPath = KubeJSPaths5.DATA.resolve("prayer_requests/" + uuid + "-" + request.time + ".json")
        let requestDir = requestPath.getParent()
        if (!requestDir.toFile().exists()) requestDir.toFile().mkdirs()
        JsonIO.write(requestPath, JsonIO.parseRaw(JSON.stringify(request)))

        // Consume one Blaze Powder, clear the offhand book
        event.getItem().shrink(1)
        offhand.set(DataComponents4.WRITABLE_BOOK_CONTENT, Java.loadClass("net.minecraft.world.item.component.WritableBookContent").EMPTY)

        playCallingFlair(player.getServer(), name)
    } catch (e) {
        console.log("calling_ritual: error handling calling - " + e)
    }
})
