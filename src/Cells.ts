import { Bodies, Body, Constraint, World } from "matter-js"
import App, { Settings } from "./App"
import Creature from "./Creature"

function getWeight( cell ) { return cell.constructor.weight }
function getColor( cell ) { return cell.constructor.color }
function getDensity( cell ) { return cell.constructor.density }

export class Cell {
    static weight = 5
    static color = "#DAE3E8"
    static density = 1
    static strength = 1.1
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

    update() { }

}

export class CellRoot extends Cell {
    static weight = 0
    static color = "#CFCD66"
    static density = 1
    static strength = 1.1
    onRemove() {
        console.log( "ROOT CELL LOSS" )
        this.creature.die()
    }
}