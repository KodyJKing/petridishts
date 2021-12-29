import { Composite, Constraint, Vector, World } from "matter-js";
import App, { Settings } from "./App"
import { Cell } from "./Cells";
import { clamp, randInt, random } from "./common/math";
import Genome from "./Genome";

export default class Creature {
    body: Composite
    genome: any
    dead = false
    energy: number
    age: number

    constructor( genome = null ) {
        this.body = Composite.create()
        if ( genome ) {
            this.genome = Genome.createChild( genome )
        } else {
            this.genome = Genome.create( { initialMutations: 50 } )
        }
        this.genome.build( this )
        this.energy = 10
        this.age = 0
    }

    add( position?: { x: number, y: number } ) {
        let app = App.instance
        let { width, height } = app
        let padding = 100
        let x, y
        if ( position ) {
            x = clamp(
                position.x + random( -200, 200 ),
                padding, width - padding
            )
            y = clamp(
                position.y + random( -200, 200 ),
                padding, height - padding
            )
        } else {
            x = random( padding, width - padding )
            y = random( padding, height - padding )
        }
        Composite.rotate( this.body, random( 0, Math.PI * 2 ), { x: 0, y: 0 } )
        Composite.translate( this.body, { x, y } )
        Composite.add( app.engine.world, this.body )
        // World.add( app.engine.world, this.body )
    }

    update( dt ) {
        let { maxPopulation, maxAge } = Settings
        let app = App.instance
        let { creatures } = app

        for ( let body of Composite.allBodies( this.body ) ) {
            let cell = body.plugin.cell
            // console.log( cell )
            cell.update( dt )
        }

        this.breakStretchedConstraints()

        if ( this.energy < 0 ) {
            console.log( "STARVATION" )
            this.die()
        } else if ( this.energy > 20 && creatures.length < maxPopulation ) {
            this.reproduce()
        }

        this.age += dt
        if ( this.age > maxAge ) {
            console.log( "OLD AGE" )
            this.die()
        }
    }

    breakStretchedConstraints() {
        let { cellSize } = Settings
        for ( let constraint of Composite.allConstraints( this.body ) ) {
            let diff = Vector.sub( constraint.bodyA.position, constraint.bodyB.position )
            let distSq = Vector.magnitudeSquared( diff )
            let { strength, lengthFactorSquared } = constraint.plugin
            if ( distSq > cellSize * cellSize * lengthFactorSquared * strength )
                Composite.remove( this.body, constraint )
        }
    }

    die() {
        this.dead = true
        for ( let constraint of Composite.allConstraints( this.body ) )
            Composite.remove( this.body, constraint )
        for ( let body of Composite.allBodies( this.body ) ) {
            let cell = body.plugin.cell
            if ( !( cell.constructor == Cell ) )
                Composite.remove( this.body, body )
        }
    }

    reproduce() {
        this.energy -= 10
        let childGenome = Genome.createChild( this.genome )
        let child = new Creature( childGenome )
        App.instance.creatures.push( child )
        child.add()
    }

    constrain( cellA: Cell, cellB: Cell, options ) {
        let constraint = Constraint.create(
            Object.assign(
                { bodyA: cellA.body, bodyB: cellB.body },
                options
            )
        )
        cellA.constraints.push( constraint )
        cellB.constraints.push( constraint )
        Composite.add( this.body, constraint )
        return constraint
    }

}