import { useState, useEffect, useRef } from "react"
import * as Matter from "matter-js"
import { Engine, Runner, Events, Render, World, Body, Bodies, Composite } from "matter-js"
import { MouseConstraint, Mouse } from "matter-js"
import Genome from "./Genome"
import Grid from "./common/Grid"
import Creature from "./Creature"
import { removeFromArray } from "./common/util"

export const Settings = {
    cellSize: 16,
    initialPopulation: 1,
    maxPopulation: 40,
    enegryLossRate: 0.0006,
    maxAge: 60 * 1000, // One minute
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
        this.engine.grid.bucketWidth = 20
        this.engine.grid.bucketHeight = 20
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

        let mouse = Mouse.create( canvasArea )
        let mouseConstraint = MouseConstraint.create( this.engine, {
            mouse,
            constraint: {
                // render: { visible: false },
                stiffness: 0.01,
                damping: 0.1
            }
        } )
        Composite.add( this.engine.world, mouseConstraint )

        // let bodyA = Bodies.rectangle( 100, 100, Settings.cellSize, Settings.cellSize, { render: { fillStyle: "#DAE3E8" } } )
        // Body.setVelocity( bodyA, { x: 0.5, y: 0.5 } )
        // Composite.add( this.engine.world, bodyA )

        this.spawn()

        let previousTime = performance.now()
        let maxDt = 500
        Events.on( this.runner, "afterUpdate", () => {
            let currentTime = performance.now()
            let dt = Math.min( currentTime - previousTime, maxDt )
            previousTime = currentTime
            this.update( dt )
        } )

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

        // if ( this.creatures.length == 0 ) {
        //     console.log( "EXTINCTION" )
        //     this.spawn()
        // }
    }

    spawn() {
        for ( let i = 0; i < Settings.initialPopulation; i++ ) {
            let creature = new Creature()
            this.creatures.push( creature )
            creature.add()
        }
    }
}