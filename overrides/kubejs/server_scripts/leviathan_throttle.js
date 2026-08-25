// Extra throttle on top of myths_of_the_sea-common.toml's spawn probabilities.
// Myths of the Sea actually has TWO independent leviathan spawn paths:
//   1. LeviathanEntity.surfaceWaterSpawnRulesAndNotNearLeviathan() - the normal
//      vanilla-style natural spawn placement. Reads MTSConfig (the toml) live,
//      so lowering the toml values directly reduces this path.
//   2. LeviathanSpawner (a CustomSpawner) - ticks independently every ~2-4
//      game ticks, rolling a spawn near a random online player. Its odds are
//      HARDCODED in the compiled jar (confirmed via javap -c: no MTSConfig
//      calls in this class at all) - night 1-in-50, rain 1-in-10, thunder
//      50/50 coinflip, nothing on clear days. The toml has zero effect on it.
// Since path 2 can't be tuned via config, this discards a large fraction of
// EVERY leviathan spawn regardless of which path produced it or what the
// weather/time was, as a blanket additional cut on top of the toml changes.
const LEVIATHAN_SURVIVAL_CHANCE = 0.2 // keep ~1 in 5 of what would have spawned

EntityEvents.spawned('myths_of_the_sea:leviathan', event => {
    if (Math.random() >= LEVIATHAN_SURVIVAL_CHANCE) {
        event.entity.discard()
    }
})
