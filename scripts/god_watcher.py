#!/usr/bin/env python3
"""
God AI watcher/bridge for Create Engineers' Grimoire.

Runs OUTSIDE the game (on the host, not as a KubeJS script) because it
makes blocking network calls to the OpenAI API - KubeJS scripts run on the
server's tick thread and must never block on network I/O.

Loop:
  1. Poll SERVER_DIR/prayer_requests/*.json for new prayer requests
     (written by kubejs/server_scripts/shrine_prayer.js).
  2. For each request, build context: modpack-lore.md + the requesting
     player's live profile (position/equipment/vitals from
     player_metrics_live.json) + their vanilla stats/advancements.
  3. Call the OpenAI API with that context + the player's question.
  4. Deliver the answer by running a /give ... written_book[...] command
     via the server's tmux console, split into book pages.
  5. Delete the processed request file.

The API key is read from a file, never hardcoded, never logged.
"""

import json
import os
import re
import subprocess
import sys
import time
import urllib.request
import urllib.error

REPO_DIR = os.path.expanduser("~/Work/create-engineers-grimoire")
SERVER_DIR = os.path.expanduser("~/minecraft-server/create-engineers-grimoire")
KNOWLEDGE_PATH = os.path.join(REPO_DIR, "knowledge", "modpack-lore.md")
API_KEY_PATH = os.path.join(SERVER_DIR, "secrets", "openai_api_key.txt")
REQUESTS_DIR = os.path.join(SERVER_DIR, "prayer_requests")
LIVE_METRICS_PATH = os.path.join(SERVER_DIR, "player_metrics_live.json")
TMUX_SESSION = "mcserver"
LOG_PATH = os.path.join(SERVER_DIR, "logs", "latest.log")
POLL_INTERVAL_SECONDS = 10
OPENAI_MODEL = "gpt-4o-mini"
MAX_PAGE_CHARS = 220
MAX_PAGES = 12

# Real structure IDs verified live against this server - some vanilla IDs are
# remapped by the "Better X" structure-overhaul mods, confirmed via the
# "Use /locate structure X instead!" redirect message in-game.
STRUCTURES_TO_CHECK = [
    ("#minecraft:village", "a village"),
    ("betterstrongholds:stronghold", "a stronghold"),
    ("betteroceanmonuments:ocean_monument", "an ocean monument"),
    ("minecraft:mansion", "a woodland mansion"),
    ("minecraft:ancient_city", "an ancient city"),
    ("minecraft:bastion_remnant", "a bastion"),
    ("minecraft:pillager_outpost", "a pillager outpost"),
    ("#minecraft:shipwreck", "a shipwreck"),
    ("#minecraft:mineshaft", "a mineshaft"),
]

LOCATE_RESULT_RE = re.compile(
    r"The nearest [^\s]+(?: \(([\w:]+)\))? is at \[(-?\d+), ~, (-?\d+)\] \((\d+) blocks away\)"
)


def load_api_key():
    with open(API_KEY_PATH, "r") as f:
        return f.read().strip()


def load_knowledge():
    with open(KNOWLEDGE_PATH, "r") as f:
        return f.read()


def load_live_player(uuid):
    try:
        with open(LIVE_METRICS_PATH, "r") as f:
            data = json.load(f)
        for p in data.get("players", []):
            if p.get("uuid") == uuid:
                return p
    except (FileNotFoundError, json.JSONDecodeError):
        pass
    return None


def compass_direction(dx, dz):
    # Minecraft: -Z is north, +Z is south, +X is east, -X is west.
    angle = (180 + (180 / 3.14159265) * (0 if dx == 0 and dz == 0 else
             __import__("math").atan2(dx, -dz))) % 360
    dirs = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
            "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"]
    return dirs[round(angle / 22.5) % 16]


def locate_structures(player_name, px, pz):
    results = []
    for structure_id, friendly_name in STRUCTURES_TO_CHECK:
        try:
            with open(LOG_PATH, "r", errors="ignore") as f:
                f.seek(0, os.SEEK_END)
                offset = f.tell()
        except FileNotFoundError:
            continue

        cmd = f"execute at {player_name} run locate structure {structure_id}"
        subprocess.run(["tmux", "send-keys", "-t", TMUX_SESSION, cmd, "Enter"], check=True)

        found_line = None
        deadline = time.time() + 8
        while time.time() < deadline:
            time.sleep(0.5)
            try:
                with open(LOG_PATH, "r", errors="ignore") as f:
                    f.seek(offset)
                    new_content = f.read()
            except FileNotFoundError:
                continue
            if "is at [" in new_content or "Could not find" in new_content or "no structure with type" in new_content:
                found_line = new_content
                break

        if not found_line:
            continue

        match = LOCATE_RESULT_RE.search(found_line)
        if match:
            sx, sz, dist = int(match.group(2)), int(match.group(3)), int(match.group(4))
            direction = compass_direction(sx - px, sz - pz)
            results.append(f"{friendly_name}: {dist} blocks away, to the {direction} "
                           f"(coordinates {sx}, {sz})")
        # else: not found nearby, or invalid - just skip it silently

    return results


def load_vanilla_stats(uuid):
    stats_path = os.path.join(SERVER_DIR, "world", "stats", f"{uuid}.json")
    try:
        with open(stats_path, "r") as f:
            raw = json.load(f).get("stats", {})
        kills = raw.get("minecraft:killed", {})
        deaths = raw.get("minecraft:custom", {}).get("minecraft:deaths", 0)
        play_time_ticks = raw.get("minecraft:custom", {}).get("minecraft:play_time", 0)
        top_kills = sorted(kills.items(), key=lambda kv: -kv[1])[:8]
        return {
            "deaths": deaths,
            "play_time_hours": round(play_time_ticks / 20 / 3600, 1),
            "top_kills": top_kills
        }
    except (FileNotFoundError, json.JSONDecodeError):
        return None


def load_advancements(uuid):
    adv_path = os.path.join(SERVER_DIR, "world", "advancements", f"{uuid}.json")
    try:
        with open(adv_path, "r") as f:
            raw = json.load(f)
        done = [k for k, v in raw.items() if isinstance(v, dict) and v.get("done")]
        return done
    except (FileNotFoundError, json.JSONDecodeError):
        return []


def build_player_context(request):
    uuid = request["uuid"]
    name = request["name"]
    live = load_live_player(uuid)
    stats = load_vanilla_stats(uuid)
    advancements = load_advancements(uuid)

    lines = [f"## Player Knowledge (live, for this prayer only)", ""]
    lines.append(f"Praying player: {name} (uuid {uuid})")
    lines.append(f"Prayer location: {request['dimension']} at "
                 f"({request['x']}, {request['y']}, {request['z']})")

    if live:
        lines.append(f"Live status: {live['health']:.0f}/{live['maxHealth']:.0f} health, "
                     f"food level {live['foodLevel']}, XP level {live['xpLevel']}, "
                     f"game mode {live['gameMode']}")
        armor = live.get("armor", {})
        worn = [f"{slot}: {item['name']}" for slot, item in armor.items() if item]
        lines.append("Currently worn: " + (", ".join(worn) if worn else "no armor"))
        mh = live.get("mainHand")
        oh = live.get("offHand")
        lines.append(f"Held items: main hand = {mh['name'] if mh else 'empty'}, "
                     f"off hand = {oh['name'] if oh else 'empty'}")

        mobs = live.get("nearbyMobs") or {}
        if mobs:
            mob_str = ", ".join(f"{k.split(':')[-1]} x{v}" for k, v in
                                sorted(mobs.items(), key=lambda kv: -kv[1]))
            lines.append(f"Creatures within 32 blocks right now: {mob_str}")
        else:
            lines.append("No creatures within 32 blocks right now.")
    else:
        lines.append("(No live status available - player may be offline right now.)")

    if stats:
        lines.append(f"Deaths: {stats['deaths']}, playtime: {stats['play_time_hours']} hours")
        if stats["top_kills"]:
            kill_str = ", ".join(f"{k.split(':')[-1]} x{v}" for k, v in stats["top_kills"])
            lines.append(f"Most-killed mobs: {kill_str}")

    if advancements:
        lines.append(f"Advancements earned: {len(advancements)} total")

    # Only bother locating structures if the prayer sounds like it wants
    # directions/guidance - running ~9 locate commands takes several
    # seconds and isn't needed for every question.
    guidance_keywords = ["where", "find", "locate", "nearest", "guide", "direction",
                         "structure", "village", "stronghold", "monument", "temple",
                         "loot", "treasure", "adventure", "quest", "explore", "go"]
    question_lower = request["question"].lower()
    is_calling = request.get("type") == "calling"
    if (is_calling or any(kw in question_lower for kw in guidance_keywords)) and live:
        lines.append("")
        lines.append("Known nearby points of interest (real, verified locations):")
        structures = locate_structures(name, request["x"], request["z"])
        if structures:
            for s in structures:
                lines.append(f"- {s}")
        else:
            lines.append("- Nothing notable found within normal search range.")
        lines.append("")
        lines.append("Note: exact ore/diamond locations cannot be looked up "
                     "(no such capability exists) - for those, give strategic "
                     "advice instead (e.g. diamonds are most common between Y "
                     "-64 and Y 16, peaking around Y -59, in caves or via "
                     "branch mining).")

    return "\n".join(lines)


def call_openai(api_key, system_prompt, question):
    payload = json.dumps({
        "model": OPENAI_MODEL,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": question}
        ],
        "max_tokens": 800
    }).encode("utf-8")

    req = urllib.request.Request(
        "https://api.openai.com/v1/chat/completions",
        data=payload,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        },
        method="POST"
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        body = json.loads(resp.read().decode("utf-8"))
    return body["choices"][0]["message"]["content"].strip()


def paginate(text):
    words = text.split()
    pages = []
    current = ""
    for word in words:
        candidate = (current + " " + word).strip()
        if len(candidate) > MAX_PAGE_CHARS:
            pages.append(current)
            current = word
        else:
            current = candidate
    if current:
        pages.append(current)
    if len(pages) > MAX_PAGES:
        pages = pages[:MAX_PAGES]
        pages[-1] += " ...(the vision fades here)"
    return pages


def escape_for_command(text):
    # Build a Minecraft text-component JSON string, then escape it for
    # embedding inside the outer SNBT string literal of the /give command.
    component = json.dumps({"text": text})
    return component.replace("\\", "\\\\").replace('"', '\\"')


def deliver_book(player_name, pages):
    escaped_pages = ",".join(f'"{escape_for_command(p)}"' for p in pages)
    command = (
        f'give {player_name} written_book[written_book_content='
        f'{{title:"A Word From Above",author:"The God",pages:[{escaped_pages}]}}]'
    )
    subprocess.run(["tmux", "send-keys", "-t", TMUX_SESSION, command, "Enter"], check=True)


CHUNK_CHARS = 38          # short enough to stay fully on-screen at normal GUI scale
CHUNK_STAY_SECONDS = 3.2  # how long each chunk stays fully visible before the next


def chunk_for_display(text):
    words = text.strip().split()
    chunks = []
    current = ""
    for word in words:
        if len(word) > CHUNK_CHARS:
            word = word[:CHUNK_CHARS]  # guard against one absurdly long word/typo
        candidate = (current + " " + word).strip()
        if len(candidate) > CHUNK_CHARS:
            if current:
                chunks.append(current)
            current = word
        else:
            current = candidate
    if current:
        chunks.append(current)
    return chunks


def deliver_calling(request, answer):
    chunks = chunk_for_display(answer)
    radius = request.get("radius", 64)
    base = (f'execute in {request["dimension"]} positioned {request["x"]} '
            f'{request["y"]} {request["z"]} run ')
    target = f"@a[distance=..{radius}]"

    # Slower fade so short chunks don't feel jarring; stay time matched to
    # CHUNK_STAY_SECONDS below (in ticks: 20 per second).
    times_cmd = base + f"title {target} times 5 {int(CHUNK_STAY_SECONDS * 20) - 10} 5"
    subprocess.run(["tmux", "send-keys", "-t", TMUX_SESSION, times_cmd, "Enter"], check=True)

    # Title renders roughly 2x larger than subtitle, so the actual message
    # goes in the (smaller) subtitle slot, which fits far more text on
    # screen. Title is kept short and fixed, only there to force a fresh
    # subtitle to actually redisplay each cycle - it must be non-empty,
    # since an empty title string was silently ignored by the client.
    header_json = json.dumps({"text": "✦", "color": "dark_purple", "bold": True})  # a small star glyph

    for chunk in chunks:
        chunk_json = json.dumps({"text": chunk, "color": "white", "italic": True})
        subprocess.run(["tmux", "send-keys", "-t", TMUX_SESSION,
                        base + f"title {target} subtitle {chunk_json}", "Enter"], check=True)
        subprocess.run(["tmux", "send-keys", "-t", TMUX_SESSION,
                        base + f"title {target} title {header_json}", "Enter"], check=True)
        time.sleep(CHUNK_STAY_SECONDS)


def process_request(api_key, knowledge, path):
    with open(path, "r") as f:
        request = json.load(f)

    print(f"[god_watcher] Processing prayer from {request['name']}: {request['question'][:80]!r}")

    is_calling = request.get("type") == "calling"
    player_context = build_player_context(request)
    system_prompt = knowledge + "\n\n" + player_context
    if is_calling:
        system_prompt += ("\n\nThis is a public 'Calling' ritual - your answer will be shown as "
                          "on-screen text to everyone nearby, revealed a few words at a time in "
                          "sequence (not written into a book). Answer in 2-4 short sentences, "
                          "still in full oracle voice - no lists, no headers, no lengthy asides. "
                          "Every sentence should stand on its own since it will be read as a "
                          "short burst of text before the next one appears.")

    try:
        answer = call_openai(api_key, system_prompt, request["question"])
    except urllib.error.HTTPError as e:
        print(f"[god_watcher] OpenAI API error: {e.code} {e.read().decode('utf-8', 'ignore')}")
        os.remove(path)
        return
    except Exception as e:
        print(f"[god_watcher] Unexpected error calling OpenAI: {e}")
        os.remove(path)
        return

    if is_calling:
        deliver_calling(request, answer)
        print(f"[god_watcher] Delivered calling response near {request['name']}'s cast location")
    else:
        pages = paginate(answer)
        deliver_book(request["name"], pages)
        print(f"[god_watcher] Delivered {len(pages)}-page response to {request['name']}")

    os.remove(path)


def main():
    if not os.path.exists(API_KEY_PATH):
        print(f"[god_watcher] No API key at {API_KEY_PATH}, exiting.")
        sys.exit(1)

    api_key = load_api_key()
    print("[god_watcher] Started. Watching for prayers...")

    while True:
        try:
            knowledge = load_knowledge()
            if os.path.isdir(REQUESTS_DIR):
                for fname in sorted(os.listdir(REQUESTS_DIR)):
                    if fname.endswith(".json"):
                        process_request(api_key, knowledge, os.path.join(REQUESTS_DIR, fname))
        except Exception as e:
            print(f"[god_watcher] Loop error (continuing): {e}")

        time.sleep(POLL_INTERVAL_SECONDS)


if __name__ == "__main__":
    main()
