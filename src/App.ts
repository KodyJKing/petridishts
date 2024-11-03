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
    renderer!: Render
    canvas!: HTMLCanvasElement
    width: number
    height: number
    creatures: Creature[] = []

    reproductionQueue: Genome[] = []

    mouseConstraint: Matter.MouseConstraint

    constructor() {
        App.instance = this

        this.engine = Engine.create()
        this.engine.grid.bucketWidth = 15
        this.engine.grid.bucketHeight = 15
        this.engine.gravity.y = Settings.gravity

        // this.engine.timing.timeScale = 1

        this.runner = Runner.create( {
            delta: 1000 / 60,
            isFixed: true,
            enabled: true,
        } )

        let canvasArea = document.getElementById( "canvasArea" ) as HTMLCanvasElement
        this.width = canvasArea.clientWidth
        this.height = canvasArea.clientHeight

        if ( Settings.useMatterJSRenderer ) {
            this.renderer = Render.create( {
                engine: this.engine,
                element: canvasArea,
                options: {
                    width: this.width,
                    height: this.height,
                    wireframes: false,
                    background: "transparent"
                }
            } )
            Render.run( this.renderer )
        } else {
            this.canvas = document.createElement( "canvas" )
            canvasArea.appendChild( this.canvas )
            this.canvas.width = this.width
            this.canvas.height = this.height
            const renderLoop = () => {
                this.render()
                requestAnimationFrame( renderLoop )
            }
            renderLoop()
        }

        let mouseConstraint = this.mouseConstraint = MouseConstraint.create( this.engine, {
            mouse: Mouse.create( canvasArea ),
            collisionFilter: { group: -1 },
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
            let walls = [
                Bodies.rectangle( -30, height / 2, 60, this.height, wallOptions ),
                Bodies.rectangle( this.width + 30, height / 2, 60, this.height, wallOptions ),
                Bodies.rectangle( width / 2, -30, width, 60, wallOptions ),
                Bodies.rectangle( width / 2, height + 30, width, 60, wallOptions )
            ]
            // Composite.add( this.engine.world, walls)
            for ( let wall of walls )
                World.add( this.engine.world, wall )
        }

        // let bodyA = Bodies.rectangle( 0, 0, Settings.cellSize, Settings.cellSize, { render: { fillStyle: "#DAE3E8" } } )
        // Body.setVelocity( bodyA, { x: 0.5, y: 0.5 } )
        // Composite.add( this.engine.world, bodyA )

        this.spawn()

        Events.on( this.runner, "afterUpdate", () => {
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
    }

    render() {
        let canvas = this.canvas
        let ctx = canvas.getContext( "2d" )
        if ( !ctx )
            return

        ctx.clearRect( 0, 0, this.width, this.height )

        let bodies = Composite.allBodies( this.engine.world )
        for ( let body of bodies ) {
            let verts = body.vertices
            if ( verts.length == 0 ) continue
            let fillStyle = body.render.fillStyle
            if ( fillStyle )
                ctx.fillStyle = fillStyle
            ctx?.beginPath()
            ctx.moveTo( verts[ 0 ].x, verts[ 0 ].y )
            for ( let i = 0; i < verts.length; i++ ) {
                let v = verts[ i ]
                ctx.lineTo( v.x, v.y )
            }
            ctx.fill()
        }
    }

    applyWaterForces( dt: number ) {
        let bodies = Composite.allBodies( this.engine.world )
        for ( let body of bodies ) {
            let cell = body.plugin.cell as Cell
            if ( cell ) {
                let { x, y } = body.position
                let t = this.engine.timing.timestamp / 1000
                let x2 = x / 125
                let y2 = y / 125

                let f = { x: 0, y: 0 }

                // Wave
                f.x += Math.sin( x2 + t ) * 0.000002
                f.y += Math.sin( y2 + t ) * 0.000002

                if ( Settings.thermalVentEnabled ) {
                    let centerX = this.width / 2
                    let ventPos = { x: centerX, y: this.height }
                    let diff = { x: x - ventPos.x, y: y - ventPos.y }
                    let distance = Math.sqrt( diff.x * diff.x + diff.y * diff.y )
                    let n = Matter.Vector.normalise( diff )
                    let force = 1 / ( distance * distance ) * -n.y * ( Math.sin( t ) + 1 )
                    f.x += n.x * force
                    f.y += n.y * force
                }

                Body.applyForce( body, body.position, f )
            }
        }
    }

    selectCreature(): Creature | undefined {
        let readyToReproduce = this.creatures.filter( c => c.canReproduce() )
        if ( readyToReproduce.length > 0 ) {
            let sampler = createSampler( readyToReproduce.map( c => c.fertility() ) )
            let index = sampler()
            return readyToReproduce[ index ]
        }
        return undefined
    }

    dequeueGenomeForReproduction(): Genome | undefined {
        if ( this.reproductionQueue.length > 0 ) {
            if ( Settings.dequeueRandomly ) {
                let index = Math.floor( Math.random() * this.reproductionQueue.length )
                return this.reproductionQueue.splice( index, 1 )[ 0 ]
            } else {
                return this.reproductionQueue.shift()
            }
        }
        return undefined
    }

    reproductionUpdate( allBodies: Body[] ) {
        if ( !Settings.disableReproduction ) {
            if ( allBodies.length < Settings.maxBodies ) {

                let r = Math.random()
                if ( r < Settings.plantSpawnChance ) {
                    let creature = new Creature( Genome.createPlant() )
                    this.creatures.push( creature )
                    creature.add()
                }
                // else if ( r < Settings.plantSpawnChance + Settings.predatorSpawnChance ) {
                //     let creature = new Creature( Genome.createPredator() )
                //     this.creatures.push( creature )
                //     creature.add()
                // }
                else {
                    let selected = this.dequeueGenomeForReproduction()
                    if ( selected ) {
                        this.spawnChild( selected )
                    } else {
                        // Reproduce directly from living population
                        let selected = this.selectCreature()
                        if ( selected ) {
                            console.log( "Reproducing from living creature." )
                            this.spawnChild( selected.genome )
                            selected.onReproduce()
                        }
                    }

                }

            } else if ( this.reproductionQueue.length < Settings.reproductionQueueLength ) {
                let selected = this.selectCreature()
                if ( selected ) {
                    this.reproductionQueue.push( selected.genome )
                    selected.onReproduce()
                }

                console.log( "Reproduction queue length:", this.reproductionQueue.length )
            }
        }
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

        if ( Settings.memoryDebug && ( ( this.frameCount++ ) % 1000 ) == 0 )
            this.printMemoryDebug()

        let allBodies = Composite.allBodies( this.engine.world )

        this.reproductionUpdate( allBodies )

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

        this.applyWaterForces( dt )

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

    spawnChild( parent: Genome ) {
        let child = new Creature( Genome.createChild( parent ) )
        this.creatures.push( child )
        child.add()
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