import { Composite, Constraint, Vector, World } from "matter-js"
import App, { Settings } from "./App"
import { Cell } from "./Cells"
import Grid from "./common/Grid"
import { clamp, randInt, random } from "./common/math"
import Vector2 from "./common/Vector2"
import Genome from "./Genome"

export default class Creature {
    rootCell?: Cell
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
            this.genome = Genome.create()
        }
        this.genome.build( this )
        this.energy = Settings.startingEnergy
        this.age = 0
    }

    add( position?: Vector2 ) {
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
        }

        this.age += dt
        if ( this.age > maxAge ) {
            console.log( "OLD AGE" )
            this.die()
        }
    }

    breakStretchedConstraints() {
        let { cellStrengthModifier } = Settings
        for ( let constraint of Composite.allConstraints( this.body ) ) {
            let diff = Vector.sub( constraint.bodyA.position, constraint.bodyB.position )
            let distSq = Vector.magnitudeSquared( diff )
            // @ts-ignore
            let { strength, lengthFactorSquared } = constraint.plugin
            if ( distSq > cellStrengthModifier * lengthFactorSquared * strength )
                this.removeConstraint( constraint )
        }
    }

    removeCell( cell: Cell ) {
        for ( let constraint of cell.constraints )
            this.removeConstraint( constraint, false )
        this.removeSeveredCells()
    }

    removeConstraint( constraint: Constraint, removeSevered = true ) {
        // @ts-ignore
        let plugin = constraint.plugin
        plugin.removed = true
        Composite.remove( this.body, constraint )
        if ( removeSevered )
            this.removeSeveredCells()
    }

    removeSeveredCells() {
        if ( !this.rootCell ) return

        let reachable = new Set<Cell>()

        function visit( cell: Cell ) {
            if ( !cell || reachable.has( cell ) )
                return
            reachable.add( cell )
            for ( let constraint of cell.constraints ) {
                let { bodyA, bodyB } = constraint
                // @ts-ignore
                if ( !constraint.plugin.removed ) {
                    for ( let body of [ bodyA, bodyB ] )
                        visit( body.plugin.cell )
                }
            }
        }

        visit( this.rootCell )

        for ( let body of Composite.allBodies( this.body ) ) {
            let cell = body.plugin.cell
            if ( cell && !reachable.has( cell ) ) {
                cell.sever()
            }
        }

    }

    die() {
        let world = App.instance.engine.world
        this.dead = true
        let leaveBasicCells = true

        if ( leaveBasicCells ) {
            for ( let constraint of Composite.allConstraints( this.body ) ) {
                Composite.remove( this.body, constraint )
                if ( Math.random() < 0.5 )
                    Composite.add( world, constraint )
            }

            for ( let body of Composite.allBodies( this.body ) ) {
                Composite.remove( this.body, body )
                Composite.add( world, body )
                let cell = body.plugin.cell
                if ( cell )
                    cell.sever()
            }
        }
        Composite.remove( world, this.body )
    }

    reproductionCost() { return Settings.startingEnergy + this.genome.costToBuild() }
    fertility() { return this.energy / this.reproductionCost() }
    canReproduce() { return this.energy > this.reproductionCost() + Settings.minEnergyAfterReproduction }
    reproduce() {
        this.energy -= this.reproductionCost()
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