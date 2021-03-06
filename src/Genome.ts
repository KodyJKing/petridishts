import clone from "./common/clone"
import Grid from "./common/Grid"
import * as Cells from "./Cells"
import createSampler from "./common/createSampler"
import { randInt, randomElement } from "./common/math"
import Creature from "./Creature"
import { Composite } from "matter-js"
import { Settings } from "./App"

export default class Genome {
    cells!: Grid

    static create() {
        let result = new Genome()
        result.cells = Grid.Create()

        let startRandom = true
        if ( startRandom ) {
            result.setCell( 0, 0, Cells.CellRoot )
            for ( let i = 0; i < Settings.initialMutations; i++ )
                result.mutate()
        } else {
            for ( let dx = -2; dx <= 2; dx++ ) {
                for ( let dy = 0; dy <= 2; dy++ ) {
                    result.setCell( dx, dy, Cells.CellPhotosynthesis )
                }
            }
            result.setCell( 0, 0, Cells.CellRoot )
        }


        return result
    }

    static createChild( genome: Genome ) {
        let result = clone( genome )
        if ( Math.random() < Settings.mutationRate )
            result.mutate()
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

    build( creature: Creature ) {
        let { cellSize } = Settings
        let cellIns = Grid.Create()

        for ( let pos of this.cells.keys() ) {
            let type = this.getCell( pos.x, pos.y )

            for ( let sign of [ 1, -1 ] ) {
                if ( pos.y == 0 && sign == -1 )
                    continue

                let x = pos.x
                let y = pos.y * sign

                let cell = new type( creature, x, y )
                cellIns.set( x, y, cell )
                Composite.add( creature.body, cell.body )

                for ( let dx = -1; dx < 2; dx++ ) {
                    for ( let dy = -1; dy < 2; dy++ ) {
                        if ( dx == 0 && dy == 0 )
                            continue
                        let x2 = x + dx
                        let y2 = y + dy
                        let neighbor = cellIns.get( x2, y2 )
                        if ( neighbor ) {
                            let constraint = creature.constrain(
                                cell, neighbor,
                                {
                                    render: { visible: false },
                                    pointA: {
                                        x: dx * cellSize * .5,
                                        y: dy * cellSize * .5
                                    },
                                    pointB: {
                                        x: dx * cellSize * -.5,
                                        y: dy * cellSize * -.5
                                    }
                                }
                            )
                            // @ts-ignore
                            let plugin = constraint.plugin
                            plugin.lengthFactorSquared = dx * dx + dy * dy
                            plugin.strength = cell.constructor.strength * neighbor.constructor.strength
                        }
                    }
                }
            }
        }

        creature.rootCell = cellIns.get( 0, 0 )

    }

}

const randomCell = createCellSampler()
function createCellSampler() {
    let cellList = Object.values( Cells )
    let weights = cellList.map( cell => cell.weight )
    let sampler = createSampler( weights )
    return () => cellList[ sampler() ]
}
