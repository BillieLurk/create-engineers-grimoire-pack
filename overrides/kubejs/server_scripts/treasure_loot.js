// Adds items from installed content mods into structure loot tables,
// so exploring dungeons/strongholds/nether fortresses/end cities/ocean structures
// is actually worth the risk instead of yielding mostly vanilla loot.
//
// IMPORTANT: several installed structure-overhaul mods (YUNG's Better Dungeons/
// Strongholds/Nether Fortresses/Ocean Monuments, Hopo's Better Underwater Ruins,
// Repurposed Structures) generate their OWN loot tables under their own mod
// namespace instead of the vanilla minecraft:chests/* ones. Each tier below
// targets both the vanilla table AND every overhaul mod's equivalent, so the
// upgraded structures you're actually exploring get the modded loot too.

LootJS.modifiers(event => {

    // --- Common: dungeons & mineshafts (low risk, low-mid reward) ---
    event.addTableModifier(/minecraft:chests\/(simple_dungeon|abandoned_mineshaft)|betterdungeons:.*chests.*|repurposed_structures:chests\/(dungeons|mineshafts|igloos|ruins).*|repurposed_structures:shulker_boxes\/dungeons.*/)
        .addLoot(LootEntry.of('create:andesite_alloy', [1, 3]).withWeight(6).when(c => c.randomChance(0.3)))
        .addLoot(LootEntry.of('ars_nouveau:fire_essence', [1, 2]).withWeight(4).when(c => c.randomChance(0.15)))
        .addLoot(LootEntry.of('ars_nouveau:air_essence', [1, 2]).withWeight(4).when(c => c.randomChance(0.15)))
        .addLoot(LootEntry.of('ars_nouveau:earth_essence', [1, 2]).withWeight(4).when(c => c.randomChance(0.15)))
        .addLoot(LootEntry.of('createbigcannons:cast_iron_nugget', [2, 5]).withWeight(6).when(c => c.randomChance(0.25)))
        .addLoot(LootEntry.of('aquaculture:neptunium_nugget', [1, 3]).withWeight(4).when(c => c.randomChance(0.15)))
        .addLoot(LootEntry.of('addon_gancho:plunger_launcher_test', 1).withWeight(2).when(c => c.randomChance(0.1)))
        .addLoot(LootEntry.of('addon_gancho:grapple_swing', 1).withWeight(2).when(c => c.randomChance(0.1)))
        .addLoot(LootEntry.of('addon_gancho:conector', 1).withWeight(2).when(c => c.randomChance(0.1)))
        .addLoot(LootEntry.of('create:extendo_grip', 1).withWeight(3).when(c => c.randomChance(0.12)))

    // --- Mid: strongholds, nether fortresses, outposts, ruined portals, jungle/desert temples ---
    event.addTableModifier(/minecraft:chests\/(stronghold_corridor|stronghold_library|stronghold_crossing|nether_bridge|pillager_outpost|ruined_portal.*|desert_pyramid|jungle_temple)|betterstrongholds:chests\/.*|betterfortresses:chests\/.*|repurposed_structures:chests\/(strongholds|fortresses|outposts|ruined_portals|temples).*|repurposed_structures:(dispensers|trapped_chests)\/(pyramids|temples).*|repurposed_structures:shulker_boxes\/(outposts|strongholds).*/)
        .addLoot(LootEntry.of('create:brass_ingot', [2, 4]).withWeight(6).when(c => c.randomChance(0.3)))
        .addLoot(LootEntry.of('createbigcannons:bronze_ingot', [1, 3]).withWeight(5).when(c => c.randomChance(0.2)))
        .addLoot(LootEntry.of('createbigcannons:steel_ingot', [1, 2]).withWeight(4).when(c => c.randomChance(0.15)))
        .addLoot(LootEntry.of('ars_nouveau:source_gem', [1, 2]).withWeight(5).when(c => c.randomChance(0.2)))
        .addLoot(LootEntry.of('ars_nouveau:experience_gem', 1).withWeight(4).when(c => c.randomChance(0.15)))
        .addLoot(LootEntry.of('ars_nouveau:wand', 1).withWeight(2).when(c => c.randomChance(0.08)))
        .addLoot(LootEntry.of('deeperdarker:soul_dust', [1, 3]).withWeight(4).when(c => c.randomChance(0.15)))
        .addLoot(LootEntry.of('create:goggles', 1).withWeight(3).when(c => c.randomChance(0.12)))
        .addLoot(LootEntry.of('create:wrench', 1).withWeight(3).when(c => c.randomChance(0.12)))
        .addLoot(LootEntry.of('createaddition:electrum_ingot', [1, 3]).withWeight(4).when(c => c.randomChance(0.15)))
        .addLoot(LootEntry.of('createdeco:industrial_iron_ingot', [1, 3]).withWeight(4).when(c => c.randomChance(0.15)))
        .addLoot(LootEntry.of('ars_controle:remote', 1).withWeight(1).when(c => c.randomChance(0.05)))

    // --- Ocean: shipwrecks, buried treasure, underwater ruins ---
    event.addTableModifier(/minecraft:chests\/(shipwreck_treasure|shipwreck_supply|buried_treasure|underwater_ruin_big|underwater_ruin_small)|hopo:chests\/.*|repurposed_structures:chests\/shipwrecks\/.*/)
        .addLoot(LootEntry.of('aquaculture:neptunium_ingot', [1, 2]).withWeight(6).when(c => c.randomChance(0.25)))
        .addLoot(LootEntry.of('aquamirae:abyssal_amethyst', [1, 2]).withWeight(5).when(c => c.randomChance(0.2)))
        .addLoot(LootEntry.of('aquamirae:angler_fang', 1).withWeight(3).when(c => c.randomChance(0.12)))
        .addLoot(LootEntry.of('myths_of_the_sea:bunyip_fang', 1).withWeight(2).when(c => c.randomChance(0.08)))
        .addLoot(LootEntry.of('create:copper_diving_helmet', 1).withWeight(2).when(c => c.randomChance(0.06)))
        .addLoot(LootEntry.of('create:copper_diving_boots', 1).withWeight(2).when(c => c.randomChance(0.06)))

    // --- High risk: bastions, end cities, ancient cities, woodland mansion, ocean monuments ---
    event.addTableModifier(/minecraft:chests\/(bastion_treasure|bastion_other|end_city_treasure|ancient_city|ancient_city_ice_box|woodland_mansion)|betteroceanmonuments:chests\/.*|repurposed_structures:chests\/(bastions\/underground|cities|mansions|ancient_cities|monuments).*/)
        .addLoot(LootEntry.of('cataclysm:witherite_ingot', [1, 2]).withWeight(5).when(c => c.randomChance(0.2)))
        .addLoot(LootEntry.of('cataclysm:enderite_ingot', 1).withWeight(2).when(c => c.randomChance(0.06)))
        .addLoot(LootEntry.of('cataclysm:berserker_soul_amulet', 1).withWeight(1).when(c => c.randomChance(0.03)))
        .addLoot(LootEntry.of('deeperdarker:heart_of_the_deep', 1).withWeight(2).when(c => c.randomChance(0.05)))
        .addLoot(LootEntry.of('deeperdarker:reinforced_echo_shard', [1, 2]).withWeight(3).when(c => c.randomChance(0.1)))
        .addLoot(LootEntry.of('deeperdarker:soul_crystal', 1).withWeight(3).when(c => c.randomChance(0.12)))
        .addLoot(LootEntry.of('ars_nouveau:greater_experience_gem', 1).withWeight(3).when(c => c.randomChance(0.1)))
        .addLoot(LootEntry.of('ars_nouveau:amulet_of_mana_boost', 1).withWeight(2).when(c => c.randomChance(0.06)))
        .addLoot(LootEntry.of('ars_additions:advanced_dominion_wand', 1).withWeight(1).when(c => c.randomChance(0.04)))
        .addLoot(LootEntry.of('aquamirae:terrible_fang', 1).withWeight(2).when(c => c.randomChance(0.06)))
        .addLoot(LootEntry.of('aquamirae:shatterblade', 1).withWeight(1).when(c => c.randomChance(0.04)))
        .addLoot(LootEntry.of('myths_of_the_sea:leviathan_heart', 1).withWeight(1).when(c => c.randomChance(0.04)))
        .addLoot(LootEntry.of('createbigcannons:nethersteel_ingot', [1, 2]).withWeight(3).when(c => c.randomChance(0.1)))
        .addLoot(LootEntry.of('create:netherite_diving_helmet', 1).withWeight(1).when(c => c.randomChance(0.04)))
        .addLoot(LootEntry.of('create:netherite_diving_boots', 1).withWeight(1).when(c => c.randomChance(0.04)))
        .addLoot(LootEntry.of('create_sa:slime_helmet', 1).withWeight(2).when(c => c.randomChance(0.06)))
        .addLoot(LootEntry.of('createaddition:electrum_amulet', 1).withWeight(2).when(c => c.randomChance(0.05)))
        .addLoot(LootEntry.of('create_enchantment_industry:experience_cake', 1).withWeight(2).when(c => c.randomChance(0.06)))

})
