import clone from "./common/clone"
import Grid from "./common/Grid"
import * as Cells from "./Cells"
import createSampler from "./common/createSampler"
import { randInt, randomElement } from "./common/math"
import Creature from "./Creature"
import { Composite } from "matter-js"
import { Settings } from "./App"

type Options = {
    initialMutations: number
}

export default class Genome {
    cells!: Grid

    static create( options: Options ) {
        let result = new Genome()
        result.cells = Grid.Create()
        result.setCell( 0, 0, Cells.CellRoot )
        for ( let i = 0; i < options.initialMutations; i++ )
            result.mutate()
        return result
    }

    static createChild( genome: Genome ) {
        let result = clone( genome )
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
                            constraint.plugin.lengthFactorSquared = dx * dx + dy * dy
                            constraint.plugin.strength = cell.constructor.strength * neighbor.constructor.strength
                        }
                    }
                }
            }
        }
    }

}

const randomCell = createCellSampler()
function createCellSampler() {
    let cellList = Object.values( Cells )
    let weights = cellList.map( cell => cell.weight )
    let sampler = createSampler( weights )
    return () => cellList[ sampler() ]
}
