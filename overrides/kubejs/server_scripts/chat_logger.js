// Records player chat messages to a rolling JSON log for the "god AI"
// player-profiling feature. This script does NOT call any AI API and costs
// nothing extra - it just cheaply records messages to disk. A separate
// external process (outside the game, on its own timer) reads this log in
// batches and makes ONE summarization API call per batch to update player
// profile notes, rather than one call per message, to keep API usage low.
//
// Keeps only the most recent MAX_ENTRIES messages - the external batcher is
// expected to poll more often than this window fills, but this bounds the
// file size even if it falls behind or is offline for a while.

const MAX_ENTRIES = 500
var KubeJSPaths = Java.loadClass("dev.latvian.mods.kubejs.KubeJSPaths")
const LOG_PATH = KubeJSPaths.DATA.resolve("chat_log.json")

function loadLog() {
    if (!LOG_PATH.toFile().exists()) return []
    try {
        let parsed = JSON.parse(String(JsonIO.readString(LOG_PATH)))
        return Array.isArray(parsed) ? parsed : []
    } catch (e) {
        console.log("chat_logger: failed to read existing log, starting fresh - " + e)
        return []
    }
}

PlayerEvents.chat(event => {
    try {
        let log = loadLog()

        log.push({
            time: Date.now(),
            name: event.getUsername(),
            uuid: event.getEntity().getStringUuid(),
            message: event.getMessage()
        })

        if (log.length > MAX_ENTRIES) {
            log = log.slice(log.length - MAX_ENTRIES)
        }

        JsonIO.write(LOG_PATH, JsonIO.parseRaw(JSON.stringify(log)))
    } catch (e) {
        console.log("chat_logger: failed to log message - " + e)
    }
})
