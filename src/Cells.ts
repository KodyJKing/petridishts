import Matter, { Bodies, Body, Composite, Constraint, Query, Vector, World } from "matter-js"
import App, { Settings } from "./App"
import Creature from "./Creature"

function getWeight( cell ) { return cell.constructor.weight }
function getColor( cell ) { return cell.constructor.color }
function getDensity( cell ) { return cell.constructor.density }
function getEnergyRate( cell ) { return cell.constructor.energyRate }
function getFoodValue( cell ) { return cell.constructor.foodValue }

export class Cell {
    static weight = 5
    static color = "#DAE3E8"
    static density = 1
    static strength = 1.1
    static energyRate = -0.00001
    static foodValue = 5

    static decayTime = 20 * 1000

    creature?: Creature
    constraints: Constraint[]
    body: Body
    edible = true
    decayTime = -1

    constructor( creature: Creature, x, y ) {
        this.creature = creature
        let { cellSize } = Settings
        this.body = Bodies.rectangle(
            x * cellSize, y * cellSize,
            cellSize, cellSize,
            { render: { fillStyle: getColor( this ) } }
        )
        this.body.plugin.cell = this
        Body.setDensity( this.body, getDensity( this ) * 0.001 )
        this.constraints = []
    }

    remove() {
        let engine = App.instance.engine
        World.remove( engine.world, this.body, true )
        for ( let constraint of this.constraints )
            World.remove( engine.world, constraint, true )
        this.creature?.removeCell( this )
        this.onRemove()
    }
    onRemove() { }

    severe() {
        this.creature = undefined
        this.edible = true
        this.body.render.fillStyle = Cell.color
        this.decayTime = Cell.decayTime * ( 1 - Math.random() * .2 )
        this.constraints.length = 0
        // if ( this.constructor != Cell ) {
        //     this.remove()
        // }
    }

    update( dt ) {
        if ( this.creature ) {
            this.creature.energy += getEnergyRate( this ) * dt
            this.onUpdate( dt )
        }
    }
    onUpdate( dt ) { }

    collide( other: Cell ) { }

}

export class CellRoot extends Cell {
    static weight = 0
    static color = "#CFCD66"
    static density = 1
    static strength = 1.1
    static energyRate = -0.00001
    static foodValue = 10

    onRemove() {
        console.log( "ROOT CELL LOSS" )
        this.creature?.die()
    }
}

export class CellPhotosynthesis extends Cell {
    static weight = 5
    static color = "#509A53"
    static density = 5
    static strength = 1.1
    // static energyRate = 0.00012
    static energyRate = 0.00003
    static foodValue = 5
}

export class CellArmor extends Cell {
    static weight = 1
    static color = "#73B3C0"
    static density = 5
    static strength = 5
    static energyRate = -0.00001
    static foodValue = 0

    edible = false
}

export class CellMouth extends Cell {
    static weight = 2
    static color = "#E35444"
    static density = 2
    static strength = 1.1
    static energyRate = -0.00010
    static foodValue = 0

    static cooldown = 500
    edible = false
    cooldown = 0

    onUpdate( dt ) {
        this.cooldown -= dt
    }

    collide( other: Cell ) {
        if ( !this.creature ) return
        let differentCreature = other.creature != this.creature
        if ( differentCreature && other.edible && this.cooldown <= 0 ) {
            other.remove()
            this.creature.energy += getFoodValue( other )
            this.cooldown += CellMouth.cooldown
        }
    }
}

export class CellThruster extends Cell {
    static weight = 1
    static color = "#C88E4B"
    static density = 1
    static strength = 1.1
    static energyRate = -0.00004
    static foodValue = 7

    static thrust = 0.000002

    onUpdate( dt ) {
        let force = CellThruster.thrust * Settings.cellSize ** 2
        Matter.Body.applyForce(
            this.body, this.body.position,
            {
                x: Math.cos( this.body.angle ) * force,
                y: Math.sin( this.body.angle ) * force
            }
        )
    }
}

export class CellSpinner extends Cell {
    static weight = 1
    static color = "#A05893"
    static density = 1
    static strength = 1.1
    static energyRate = -0.00004
    static foodValue = 7

    static torque = 0.00001

    onUpdate( dt ) {
        let speed = Vector.magnitude( this.body.velocity )
        this.body.torque += CellSpinner.torque * dt / Math.max( speed, 0.1 )
    }
}

export class CellSuction extends Cell {
    static weight = 1
    static color = "#007F7F"
    static density = 1
    static strength = 1.1
    static energyRate = -0.00004
    static foodValue = 7

    force() { return 0.001 }

    onUpdate( dt ) {
        let app = App.instance
        let { engine } = app
        let allBodies = Composite.allBodies( engine.world )

        let radius = Settings.cellSize * 5
        let pos = this.body.position
        let circle = Bodies.circle( pos.x, pos.y, radius )
        let touching = Query.collides( circle, allBodies )

        for ( let collision of touching ) {
            let body = collision.bodyA
            let cell = body.plugin.cell
            if ( cell && ( cell.creature != this.creature ) ) {
                let diff = Vector.sub( this.body.position, body.position )
                let lengthSq = Vector.magnitudeSquared( diff )
                let force = Vector.mult( diff, this.force() / lengthSq )
                Body.applyForce( body, body.position, force )
                Body.applyForce( this.body, this.body.position, Vector.neg( force ) )
            }
        }

    }
}

export class CellRepulsion extends CellSuction {
    static weight = 1
    static color = "#7F51FF"
    static density = 1
    static strength = 1.1
    static energyRate = -0.00004
    static foodValue = 7

    force() { return -0.001 }
}