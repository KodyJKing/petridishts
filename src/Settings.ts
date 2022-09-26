
export const Settings = {
    cellSize: 8,
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

    minEnergyAfterRepair: 3,
    baseRepairCost: 3,
    repairChancePerTick: 0.01,

    disableReproduction: false,
    showConstraints: false,
    deleteOnClick: false,

    brain: {
        maxHidden: 20,
        initialInputsToHidden: 2,
        initialOutputsToHidden: 2,
        mutationRates: {
            add: 0.3,
            delete: 0.2,
            disconnect: 0.2,
            connect: 0.5,
            modifyWeight: 0.5,
            modifyBias: 0.3
        }
    }
};
