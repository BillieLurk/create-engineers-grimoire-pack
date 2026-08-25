// Makes fish items from Critters and Companions and Naturalist filletable
// with Aquaculture 2's knife recipe. Aquaculture's fillet recipe checks a
// Java-side registry (AquacultureAPI.FISH_DATA) for weight range + fillet
// count - it is NOT tag or JSON recipe driven, so there is no datapack way
// to do this. Weight/fillet numbers below are picked to match the scale of
// Aquaculture's own fish (e.g. its Catfish is 10-220lb for 6 fillets, its
// Smallmouth Bass is 1-12lb for 2 fillets - see FishWeightHandler.registerFishData
// in the Aquaculture jar for the full reference table).
// Runs on ServerEvents.loaded (not startup_scripts) so Aquaculture's own
// FMLCommonSetup has already populated FISH_DATA and it isn't null yet.

ServerEvents.loaded(event => {
    var ResourceLocation = Java.loadClass("net.minecraft.resources.ResourceLocation")
    var BuiltInRegistries = Java.loadClass("net.minecraft.core.registries.BuiltInRegistries")
    var AquacultureAPI = Java.loadClass("com.teammetallurgy.aquaculture.api.AquacultureAPI")

    function registerFish(id, minWeight, maxWeight, filletAmount) {
        let rl = ResourceLocation.parse(id)
        if (!BuiltInRegistries.ITEM.containsKey(rl)) {
            console.warn("fish_fillet_compat: item not found, skipping - " + id)
            return
        }
        let item = BuiltInRegistries.ITEM.get(rl)
        AquacultureAPI.FISH_DATA.add(item, minWeight, maxWeight, filletAmount)
        console.info("fish_fillet_compat: registered " + id + " as filletable")
    }

    // Critters and Companions
    registerFish("crittersandcompanions:koi_fish", 2.0, 40.0, 2)

    // Naturalist
    registerFish("naturalist:bass", 1.0, 12.0, 2)
    registerFish("naturalist:catfish", 10.0, 220.0, 6)
    registerFish("naturalist:anglerfish", 1.0, 15.0, 3)
    registerFish("naturalist:blobfish", 0.5, 5.0, 1)
})
