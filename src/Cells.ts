import Matter, { Bodies, Body, Constraint, World } from "matter-js"
import App, { Settings } from "./App"
import Creature from "./Creature"

function getWeight( cell ) { return cell.constructor.weight }
function getColor( cell ) { return cell.constructor.color }
function getDensity( cell ) { return cell.constructor.density }
function getEnergyRate( cell ) { return cell.constructor.energyRate }

export class Cell {
    static weight = 5
    static color = "#DAE3E8"
    static density = 1
    static strength = 1.1
    static energyRate = -0.00001

    creature: Creature
    constraints: Constraint[]
    body: Body
    edible = true

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
        this.onRemove()
    }
    onRemove() { }

    update( dt ) {
        this.creature.energy += getEnergyRate( this ) * dt
        this.onUpdate( dt )
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

    onRemove() {
        console.log( "ROOT CELL LOSS" )
        this.creature.die()
    }
}

export class CellPhotosynthesis extends Cell {
    static weight = 5
    static color = "#509A53"
    static density = 5
    static strength = 1.1
    static energyRate = 0.00012
}

export class CellArmor extends Cell {
    static weight = 1
    static color = "#73B3C0"
    static density = 5
    static strength = 5
    static energyRate = -0.00002

    edible = false
}

export class CellMouth extends Cell {
    static weight = 2
    static color = "#E35444"
    static density = 2
    static strength = 1.1
    static energyRate = -0.00004

    static cooldown = 200
    edible = false
    cooldown = 0

    onUpdate( dt ) {
        this.cooldown -= dt
    }

    collide( other: Cell ) {
        let differentCreature = other.creature != this.creature
        if ( differentCreature && other.edible && this.cooldown <= 0 ) {
            other.remove()
            this.creature.energy += 1
            this.cooldown += CellMouth.cooldown
        }
    }
}

export class CellThruster extends Cell {
    static weight = 1
    static color = "#C88E4B"
    static density = 1
    static strength = 1.1
    static energyRate = -0.00008

    static thrust = 0.000002

    onUpdate( dt ) {
        let force = CellThruster.thrust * Settings.cellSize ** 2
        Matter.Body.applyForce(
            this.body, this.body.position,
            {
                x: Math.cos( this.body.angle ) * force
                y: Math.sin( this.body.angle ) * force
            }
        )
    }
}