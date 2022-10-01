import { Composite, Constraint, Vector, World } from "matter-js"
import App from "./App"
import { Settings } from "./Settings"
import { Cell } from "./Cells"
import Grid from "./common/Grid"
import { clamp, randInt, random } from "./common/math"
import Vector2 from "./common/Vector2"
import Genome from "./Genome"
import Brain from "./BrainGenome"

export default class Creature {
    rootCell?: Cell
    body: Composite
    brain: Brain
    genome: Genome
    dead = false
    energy: number
    age: number
    noise: number

    static standardInputs = {
        // sinSeconds( c: Creature ) { return Math.sin( App.instance.engineTime() / 1000 ) },
        // cosSeconds( c: Creature ) { return Math.cos( App.instance.engineTime() / 1000 ) },
        // positionX( c: Creature ) { return c.rootCell?.body.position.x ?? 0 },
        // positionY( c: Creature ) { return c.rootCell?.body.position.y ?? 0 },
        velocityX( c: Creature ) { return c.rootCell?.body.velocity.x ?? 0 },
        velocityY( c: Creature ) { return c.rootCell?.body.velocity.y ?? 0 },
        directionX( c: Creature ) { return Math.cos( c.rootCell?.body.angle ?? 0 ) },
        directionY( c: Creature ) { return Math.sin( c.rootCell?.body.angle ?? 0 ) },
        // angularSpeed( c: Creature ) { return c.rootCell?.body.angularSpeed },
    } as { [ key: string ]: ( c: Creature ) => number }

    constructor( genome: Genome | null = null ) {
        this.body = Composite.create()
        if ( genome ) {
            this.genome = Genome.createChild( genome )
        } else {
            this.genome = Genome.create()
        }
        this.genome.build( this )
        this.brain = this.genome.brain.buildBrain()
        this.energy = Settings.startingEnergy
        this.age = 0
        this.noise = Math.random()
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
        Composite.rotate( this.body, random( 0, Math.PI * 2 ), { x: 0, y: 0 }, true )
        Composite.translate( this.body, { x, y }, true )
        Composite.add( app.engine.world, this.body )
        // World.add( app.engine.world, this.body )
    }

    update( dt ) {
        let { maxPopulation, maxAge } = Settings
        let app = App.instance
        let { creatures } = app

        for ( let body of Composite.allBodies( this.body ) ) {
            let cell = body.plugin.cell
            if ( cell )
                cell.update( dt )
            // console.log( cell )
        }

        this.breakStretchedConstraints()

        if ( this.energy < 0 ) {
            // console.log( "STARVATION" )
            this.die()
        }

        this.age += dt
        if ( this.age > maxAge ) {
            // console.log( "OLD AGE" )
            this.die()
        }

        if ( Math.random() < Settings.repairChancePerTick )
            this.repair()

        this.updateInputs()
        this.brain.step()
        // this.updateInputs()
    }

    updateInputs() {
        for ( let key in Creature.standardInputs ) {
            let func = Creature.standardInputs[ key ]
            this.brain.setValue( key, func( this ) )
        }
    }

    repair() {
        this.genome.repair( this )
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
                // Composite.remove( this.body, body )
                // Composite.add( world, body )
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
        //@ts-ignore
        let stiffness = cellA.constructor.stiffness * cellB.constructor.stiffness
        let constraint = Constraint.create(
            Object.assign(
                { bodyA: cellA.body, bodyB: cellB.body, stiffness },
                options
            )
        )
        cellA.constraints.push( constraint )
        cellB.constraints.push( constraint )
        Composite.add( this.body, constraint )
        return constraint
    }

    // TODO: Update this incrementally rather than rebuilding.
    getCellGrid() {
        let cellGrid = Grid.Create()
        for ( let body of Composite.allBodies( this.body ) ) {
            let cell = body.plugin.cell as Cell
            if ( cell )
                cellGrid.set( cell.x, cell.y, cell )
        }
        return cellGrid
    }

}