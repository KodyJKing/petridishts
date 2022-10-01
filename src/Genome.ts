import clone from "./common/clone"
import Grid from "./common/Grid"
import * as Cells from "./Cells"
import createSampler from "./common/createSampler"
import { randInt, randomElement, randomGuassian } from "./common/math"
import Creature from "./Creature"
import Matter, { Body, Composite, Vector } from "matter-js"
import { Settings } from "./Settings"
import { BrainGenome } from "./BrainGenome"

const VecRight = Vector.create( 1, 0 )
const VecUp = Vector.create( 0, 1 )
export default class Genome {
    cells!: Grid
    brain!: BrainGenome

    static create() {
        let result = new Genome()
        result.cells = Grid.Create()

        let startRandom = true
        if ( startRandom ) {
            result.setCell( 0, 0, Cells.CellRoot )
            for ( let i = 0; i < Settings.initialMutations; i++ )
                result.mutate()
        } else {
            for ( let dx = -2; dx <= 2; dx++ )
                for ( let dy = 0; dy <= 2; dy++ )
                    result.setCell( dx, dy, Cells.CellPhotosynthesis )
            result.setCell( 0, 0, Cells.CellRoot )
        }

        let [ inKeys, outKeys ] = result.ioKeys()
        result.brain = BrainGenome.create()
        result.brain.setIOKeys( inKeys, outKeys )

        return result
    }

    static createChild( genome: Genome ) {
        let result = clone( genome ) as Genome
        if ( Math.random() < Settings.mutationRate )
            result.mutate()
        let [ inKeys, outKeys ] = result.ioKeys()
        result.brain.setIOKeys( inKeys, outKeys )
        let numMutations = Math.floor( Math.abs( randomGuassian() * Settings.brain.mutationStandardDev ) )
        for ( let i = 0; i < numMutations; i++ )
            result.brain.mutate()
        result.brain.prune()
        return result
    }

    setCell( x, y, type: Function ) { this.cells.set( x, y, type.name ) }
    getCell( x, y ) {
        let name = this.cells.get( x, y )
        if ( !name ) return null
        if ( !Cells.hasOwnProperty( name ) ) return null
        return Cells[ name ]
    }

    mutate() {
        let { deletionRate } = Settings
        let r = Math.random()
        if ( r < deletionRate ) {
            this.mutateDelete()
        } else {
            this.mutateAdd()
        }
        this._costToBuild = undefined
    }

    mutateAdd() {
        if ( this.cells.size >= Settings.maxCellsPerGenome )
            return
        let positions = this.cells.keys()
        let { x, y } = randomElement( positions )
        while ( true ) {
            let x2 = x + randInt( -1, 2 )
            let y2 = y + randInt( -1, 2 )
            if ( y2 < 0 || ( x2 == 0 && y2 == 0 ) )
                continue
            this.setCell( x2, y2, randomCell() )
            return
        }
    }

    mutateDelete() {
        let positions = this.cells.keys()
        let { x, y } = randomElement( positions )
        if ( x == 0 || y == 0 )
            return
        this.cells.delete( x, y )
        for ( let { x, y } of this.cells.getUnreachableKeys( 0, 0 ) )
            this.cells.delete( x, y )
    }

    _costToBuild?: number
    costToBuild() {
        if ( this._costToBuild != undefined ) return this._costToBuild
        let result = 0
        for ( let pos of this.cells.keys() ) {
            let type = this.getCell( pos.x, pos.y )
            let isMirrored = pos.y > 0
            let s = isMirrored ? 2 : 1
            result += type.foodValue * s
        }
        this._costToBuild = result
        return result
    }

    ioKeys() {
        let inputKeys: string[] = Object.keys( Creature.standardInputs )
        let outputKeys: string[] = []

        for ( let pos of this.cells.keys() ) {
            let type = this.getCell( pos.x, pos.y )
            for ( let sign of [ 1, -1 ] ) {
                if ( pos.y == 0 && sign == -1 )
                    continue
                let x = pos.x
                let y = pos.y * sign

                for ( let channel of type.inputs as string[] )
                    inputKeys.push( Cells.Cell.iokey( "input", channel, x, y ) )
                for ( let channel of type.outputs as string[] )
                    outputKeys.push( Cells.Cell.iokey( "output", channel, x, y ) )
            }
        }

        return [ inputKeys, outputKeys ]
    }

    build( creature: Creature ) {
        let { cellSize } = Settings
        let cellGrid = Grid.Create()

        for ( let pos of this.cells.keys() ) {
            let type = this.getCell( pos.x, pos.y )
            for ( let sign of [ 1, -1 ] ) {
                if ( pos.y == 0 && sign == -1 )
                    continue
                let x = pos.x
                let y = pos.y * sign
                let cell = this.buildCell( creature, x, y, type, cellGrid )
                this.connectCell( creature, cell, x, y, cellGrid )
            }
        }

        creature.rootCell = cellGrid.get( 0, 0 )
    }

    buildCell( creature: Creature, x: number, y: number, type, cellGrid: Grid ) {
        let cell = new type( creature, x, y )
        cellGrid.set( x, y, cell )
        Composite.add( creature.body, cell.composite )
        return cell
    }

    connectCell(
        creature: Creature, cell: Cells.Cell,
        x: number, y: number,
        cellGrid: Grid,
        VR: Matter.Vector = VecRight,
        VU: Matter.Vector = VecUp,
    ) {
        let { cellSize } = Settings

        function getPoint( x, y ) {
            return {
                x: x * VR.x + y * VU.x,
                y: x * VR.y + y * VU.y
            }
        }

        for ( let dx = -1; dx < 2; dx++ ) {
            for ( let dy = -1; dy < 2; dy++ ) {
                if ( dx == 0 && dy == 0 )
                    continue
                let x2 = x + dx
                let y2 = y + dy
                let neighbor = cellGrid.get( x2, y2 )
                if ( neighbor ) {
                    let constraint = creature.constrain(
                        cell, neighbor,
                        {
                            render: { visible: Settings.showConstraints },
                            pointA: getPoint(
                                dx * cellSize * .5,
                                dy * cellSize * .5
                            ),
                            pointB: getPoint(
                                dx * cellSize * -.5,
                                dy * cellSize * -.5
                            )
                        }
                    )
                    // @ts-ignore
                    let plugin = constraint.plugin
                    plugin.lengthFactorSquared = dx * dx + dy * dy
                    // @ts-ignore
                    plugin.strength = cell.constructor.strength * neighbor.constructor.strength
                }
            }
        }
    }

    repair( creature: Creature ) {
        let cellGrid = creature.getCellGrid()

        // console.log( cellGrid.size )

        let repairablePositions = [] as { x: number, y: number, mount: Cells.Cell }[]
        for ( let pos of this.cells.keys() ) {
            for ( let sign of [ 1, -1 ] ) {
                if ( pos.y == 0 && sign == -1 )
                    continue

                let x = pos.x
                let y = pos.y * sign

                if ( cellGrid.get( x, y ) )
                    continue // No need to repair.

                for ( let dx = -1; dx <= 1; dx++ ) {
                    for ( let dy = -1; dy <= 1; dy++ ) {
                        if ( dx == 0 && dy == 0 )
                            continue

                        let x2 = x + dx
                        let y2 = y + dy
                        let cell = cellGrid.get( x2, y2 )
                        if ( cell )
                            repairablePositions.push( { x, y, mount: cell } )

                    }
                }

            }
        }

        if ( repairablePositions.length == 0 )
            return

        let repairIndex = Math.floor( Math.random() * repairablePositions.length )
        let repairPos = repairablePositions[ repairIndex ]
        let x = repairPos.x
        let y = repairPos.y
        let type = this.getCell( x, Math.abs( y ) )

        let mount = repairPos.mount
        let mountBody = mount.body
        let dx = x - mount.x
        let dy = y - mount.y

        let cost = type.foodValue + Settings.baseRepairCost
        if ( cost + Settings.minEnergyAfterRepair > creature.energy )
            return
        creature.energy -= cost

        let cell = this.buildCell( creature, x, y, type, cellGrid )
        let cellBody = cell.body

        let { cellSize } = Settings
        let t = mountBody.angle
        let c = Math.cos( -t )
        let s = Math.sin( -t )
        Body.setAngle( cellBody, t )
        Body.setPosition( cellBody, {
            x: mountBody.position.x + c * dx * cellSize + s * dy * cellSize,
            y: mountBody.position.y - s * dx * cellSize + c * dy * cellSize
        } )

        let VR = Matter.Vector.create( c, -s )
        let VU = Matter.Vector.create( s, c )
        this.connectCell( creature, cell, x, y, cellGrid, VR, VU )

        // console.log( "CELL REGROWN!" )
    }

}

const randomCell = createCellSampler()
function createCellSampler() {
    let cellList = Object.values( Cells )
    let weights = cellList.map( cell => cell.weight )
    let sampler = createSampler( weights )
    return () => cellList[ sampler() ]
}
