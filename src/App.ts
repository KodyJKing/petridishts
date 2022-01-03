import { useState, useEffect, useRef } from "react"
import * as Matter from "matter-js"
import { Engine, Runner, Events, Render, World, Body, Bodies, Composite } from "matter-js"
import { MouseConstraint, Mouse } from "matter-js"
import Genome from "./Genome"
import Grid from "./common/Grid"
import Creature from "./Creature"
import { removeFromArray } from "./common/util"
import { Cell } from "./Cells"
import createSampler from "./common/createSampler"

export const Settings = {
    cellSize: 8,
    cellStrengthModifier: 64,
    initialPopulation: 20,
    maxPopulation: 40,
    maxBodies: 40 * 30,
    // enegryLossRate: 0.0006,
    maxAge: 60 * 1000, // One minute
    initialMutations: 10,
    mutationRate: 0.5,
    minEdits: 1, maxEdits: 3,
    deletionRate: 0.4,
    startingEnergy: 5,
    minEnergyAfterReproduction: 5,
    maxCellsPerGenome: 20,
    metabolicRate: 100
}

export default class App {
    static instance: App
    context!: CanvasRenderingContext2D
    engine: Engine
    runner: Runner
    render: Render
    width: number
    height: number
    creatures: Creature[] = []

    constructor() {
        App.instance = this

        this.engine = Engine.create()
        this.engine.grid.bucketWidth = 15
        this.engine.grid.bucketHeight = 15
        this.engine.gravity.y = 0

        this.runner = Runner.create( {
            delta: 1000 / 60,
            isFixed: true,
            enabled: true,
        } )

        let canvasArea = document.getElementById( "canvasArea" ) as HTMLCanvasElement
        this.width = canvasArea.clientWidth
        this.height = canvasArea.clientHeight
        this.render = Render.create( {
            engine: this.engine,
            element: canvasArea,
            options: {
                width: this.width,
                height: this.height,
                wireframes: false,
                background: "transparent"
            }
        } )

        let mouseConstraint = MouseConstraint.create( this.engine, {
            mouse: Mouse.create( canvasArea ),
            // @ts-ignore
            constraint: {
                // render: { visible: false },
                stiffness: 0.01,
                damping: 0.1
            }
        } )
        Composite.add( this.engine.world, mouseConstraint )

        { // Walls
            let wallOptions = { isStatic: true, render: { fillStyle: "red" } }
            let { width, height } = this
            Composite.add( this.engine.world, [
                Bodies.rectangle( -30, height / 2, 60, this.height, wallOptions ),
                Bodies.rectangle( this.width + 30, height / 2, 60, this.height, wallOptions ),
                Bodies.rectangle( width / 2, -30, width, 60, wallOptions ),
                Bodies.rectangle( width / 2, height + 30, width, 60, wallOptions )
            ] )
        }

        // let bodyA = Bodies.rectangle( 100, 100, Settings.cellSize, Settings.cellSize, { render: { fillStyle: "#DAE3E8" } } )
        // Body.setVelocity( bodyA, { x: 0.5, y: 0.5 } )
        // Composite.add( this.engine.world, bodyA )

        this.spawn()

        let previousTime = performance.now()
        let previousDt = 0
        let maxDt = 500
        Events.on( this.runner, "afterUpdate", () => {
            let currentTime = performance.now()
            let dt = Math.min( currentTime - previousTime, maxDt )
            previousTime = currentTime
            previousDt = dt
            this.update( dt )
        } )

        Events.on(
            this.engine, "collisionActive",
            e => {
                for ( let pair of e.pairs ) {
                    let cellA = pair.bodyA.plugin.cell as Cell | null
                    let cellB = pair.bodyB.plugin.cell as Cell | null
                    if ( cellA && cellB ) {
                        cellA.collide( cellB, previousDt )
                        cellB.collide( cellA, previousDt )
                    }
                }
            }
        )

        Runner.run( this.runner, this.engine )
        Render.run( this.render )
    }

    update( dt ) {
        let dead = [] as Creature[]

        for ( let creature of this.creatures ) {
            if ( creature.dead )
                dead.push( creature )
            else
                creature.update( dt )
        }

        for ( let creature of dead )
            removeFromArray( this.creatures, creature )

        let allBodies = Composite.allBodies( this.engine.world )

        // let creatureCount = this.creatures.length
        // if ( creatureCount < Settings.maxPopulation ) {
        if ( allBodies.length < Settings.maxBodies ) {
            let readyToReproduce = this.creatures.filter( c => c.canReproduce() )
            if ( readyToReproduce.length > 0 ) {
                let sampler = createSampler( readyToReproduce.map( c => c.fertility() ) )
                let index = sampler()
                let selected = readyToReproduce[ index ]
                selected.reproduce()
            }
        }

        if ( this.creatures.length == 0 ) {
            console.log( "EXTINCTION" )
            this.spawn()
        }

        for ( let body of allBodies ) {
            let cell = body.plugin.cell
            if ( cell && cell.decayTime > 0 ) {
                cell.decayTime -= dt
                if ( cell.decayTime <= 0 )
                    cell.remove()
            }
        }
    }

    spawn() {
        for ( let i = 0; i < Settings.initialPopulation; i++ ) {
            let creature = new Creature()
            // console.log( creature.genome.cells.getUnreachableKeys( 0, 0 ) )
            this.creatures.push( creature )
            creature.add()
        }
    }
}