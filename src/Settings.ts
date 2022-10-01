
export const Settings = {
    cellSize: 6,
    cellStrengthModifier: 64,

    initialPopulation: 20,
    maxPopulation: 40,
    maxBodies: 40 * 30,
    maxAge: 60 * 1000,

    initialMutations: 1,
    // initialMutations: 8,
    mutationRate: 0.5,
    minEdits: 1,
    maxEdits: 3,
    deletionRate: 0.4,
    maxCellsPerGenome: 20,

    startingEnergy: 5,
    minEnergyAfterReproduction: 5,

    metabolicRate: 100,
    carnivoreEfficiency: 1,
    photosynthesisElevationBoost: 0,
    gravity: 0.0,

    edibleMouths: true,

    minEnergyAfterRepair: 3,
    baseRepairCost: 3,
    repairChancePerTick: 0.01,

    disableReproduction: false,
    showConstraints: false,
    deleteOnClick: false,

    brain: {
        maxHidden: 20,
        initialInputsToHidden: 5,
        initialOutputsToHidden: 5,
        mutationStandardDev: 10, // (the standard deviation of guassian before taking the absolute value and floor)
        mutationRates: {
            addHidden: 0.1,
            deleteHidden: 0.05,
            disconnect: 0.05,
            connect: 0.5,
            modifyWeight: 3,
            modifyBias: 1
        }
    }
};
