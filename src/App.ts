import { useState, useEffect, useRef } from "react"
import * as Matter from "matter-js"
import { Engine, Runner, Events, Render, World, Body, Bodies, Composite } from "matter-js"
import { MouseConstraint, Mouse } from "matter-js"
import Genome from "./Genome"
import Grid from "./common/Grid"
import Creature from "./Creature"
import { removeFromArray } from "./common/util"
import { Cell, CellRoot } from "./Cells"
import createSampler from "./common/createSampler"
import { Settings } from "./Settings"

export default class App {
    static instance: App
    context!: CanvasRenderingContext2D
    engine: Engine
    runner: Runner
    render: Render
    width: number
    height: number
    creatures: Creature[] = []

    mouseConstraint: Matter.MouseConstraint

    constructor() {
        App.instance = this

        this.engine = Engine.create()
        this.engine.grid.bucketWidth = 15
        this.engine.grid.bucketHeight = 15
        this.engine.gravity.y = Settings.gravity

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

        let mouseConstraint = this.mouseConstraint = MouseConstraint.create( this.engine, {
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
            let wallOptions = { isStatic: true, render: { fillStyle: "red" }, plugin: { isWall: true } }
            let { width, height } = this
            Composite.add( this.engine.world, [
                Bodies.rectangle( -30, height / 2, 60, this.height, wallOptions ),
                Bodies.rectangle( this.width + 30, height / 2, 60, this.height, wallOptions ),
                Bodies.rectangle( width / 2, -30, width, 60, wallOptions ),
                Bodies.rectangle( width / 2, height + 30, width, 60, wallOptions )
            ] )
        }

        // let bodyA = Bodies.rectangle( 0, 0, Settings.cellSize, Settings.cellSize, { render: { fillStyle: "#DAE3E8" } } )
        // Body.setVelocity( bodyA, { x: 0.5, y: 0.5 } )
        // Composite.add( this.engine.world, bodyA )

        this.spawn()

        // let previousTime = performance.now()
        // let previousDt = 0
        // let maxDt = 500
        Events.on( this.runner, "afterUpdate", () => {
            // let currentTime = performance.now()
            // let dt = Math.min( currentTime - previousTime, maxDt )
            // previousTime = currentTime
            // previousDt = dt
            let dt = this.engineDt()
            this.update( dt )
        } )

        Events.on(
            this.engine, "collisionActive",
            e => {
                let dt = this.engineDt()
                for ( let pair of e.pairs ) {
                    let cellA = pair.bodyA.plugin.cell as Cell | null
                    let cellB = pair.bodyB.plugin.cell as Cell | null
                    if ( cellA && cellB ) {
                        cellA.collide( cellB, dt )
                        cellB.collide( cellA, dt )
                    }
                }
            }
        )

        for ( let eventName of [ "collisionStart", "collisionEnd", "collisionActive" ] ) {
            let listenerName = "on_" + eventName
            Events.on(
                this.engine, eventName,
                e => {
                    for ( let pair of e.pairs ) {
                        let listenerA = pair.bodyA.plugin[ listenerName ] as ( ( body: Body ) => void ) | undefined
                        let listenerB = pair.bodyB.plugin[ listenerName ] as ( ( body: Body ) => void ) | undefined
                        if ( listenerA ) listenerA( pair.bodyB )
                        if ( listenerB ) listenerB( pair.bodyA )
                    }
                }
            )
        }


        Runner.run( this.runner, this.engine )
        Render.run( this.render )
    }

    frameCount = 0
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

        if ( ( ( this.frameCount++ ) % 1000 ) == 0 )
            this.printMemoryDebug()

        if ( !Settings.disableReproduction ) {
            if ( allBodies.length < Settings.maxBodies ) {
                let readyToReproduce = this.creatures.filter( c => c.canReproduce() )
                if ( readyToReproduce.length > 0 ) {
                    let sampler = createSampler( readyToReproduce.map( c => c.fertility() ) )
                    let index = sampler()
                    let selected = readyToReproduce[ index ]
                    selected.reproduce()
                }
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

        if ( this.mouseConstraint.body ) {
            let cell = this.mouseConstraint.body.plugin.cell as Cell
            if ( cell ) {
                if ( Settings.deleteOnClick )
                    cell.remove()

                if ( cell.creature )
                    console.log( cell.creature )
            }
        }

    }

    printMemoryDebug() {
        let numConstraints = Composite.allConstraints( this.engine.world ).length
        let numComposites = Composite.allComposites( this.engine.world ).length
        let numBodies = Composite.allBodies( this.engine.world ).length
        let numCreatures = this.creatures.length

        let averageBrainConnections = 0
        for ( let creature of this.creatures )
            averageBrainConnections += creature.genome.brain.connectionCount()
        averageBrainConnections /= numCreatures

        console.log( { numCreatures, averageBrainConnections, numBodies, numComposites, numConstraints } )
    }

    spawn() {
        for ( let i = 0; i < Settings.initialPopulation; i++ ) {
            let creature = new Creature()
            // console.log( creature.genome.cells.getUnreachableKeys( 0, 0 ) )
            this.creatures.push( creature )
            creature.add()
        }
    }



    engineTime() {
        return this.engine.timing.timestamp
    }

    engineDt() {
        return this.engine.timing.lastDelta
    }
}