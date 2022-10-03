
export const Settings = {
    // cellSize: 8,
    cellSize: 6,
    cellStrengthModifier: 64,

    initialPopulation: 20,
    maxBodies: 40 * 30,
    // maxAge: 60 * 1000,
    maxAge: 20 * 1000,
    // decayTime: 20 * 1000,
    decayTime: 2 * 1000,

    startRandom: false,
    initialRadius: 1,
    initialMutations: 1,
    // initialMutations: 8,
    // mutationRate: 0.5,
    mutationRate: 0.1,
    minEdits: 1,
    maxEdits: 3,
    deletionRate: 0.4,
    // maxCellsPerGenome: 20,
    maxCellsPerGenome: 10,

    startingEnergy: 5,
    minEnergyAfterReproduction: 5,

    // metabolicRate: 100,
    metabolicRate: 20,
    carnivoreEfficiency: 1,
    photosynthesisElevationBoost: 0,
    gravity: 0.0,

    energyRates: {
        photosynthesis: 0.00006,
        // mouth: -0.00003,
        mouth: -0.00001,
        // thruster: -0.00002,
        thruster: -0.00001,
        eye: -0.00001
    },

    edibleMouths: true,

    minEnergyAfterRepair: 3,
    // baseRepairCost: 3,
    baseRepairCost: 0,
    repairChancePerTick: 0.01,

    disableReproduction: false,
    showConstraints: false,
    showSuctionRadius: true,
    deleteOnClick: false,
    memoryDebug: true,

    brain: {
        prune: false,
        // maxHidden: 20,
        maxHidden: 5,
        initialInputsToHidden: 1,
        initialOutputsToHidden: 0,
        mutationStandardDev: 3, // (the standard deviation of guassian before taking the absolute value and floor)
        mutationRates: {
            addHidden: 0.1,
            // addHidden: 0,
            deleteHidden: 0.05,
            disconnect: 0.05,
            connect: 0.5,
            modifyWeight: 3,
            modifyBias: 1
        }
    }
};
