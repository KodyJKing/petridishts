import Matter, { Bodies, Body, Composite, Constraint, Query, Vector, World } from "matter-js"
import App from "./App"
import { Settings } from "./Settings"
import Creature from "./Creature"
import { BrainGenome } from "./BrainGenome"
import { remap } from "./common/math"

function getWeight( cell ) { return cell.constructor.weight }
function getColor( cell ) { return cell.constructor.color }
function getDensity( cell ) { return cell.constructor.density }
function getEnergyRate( cell ) { return cell.constructor.energyRate }
function getFoodValue( cell ) { return cell.constructor.foodValue }

export class Cell {
    static weight = 3
    static color = "#DAE3E8"
    static density = 1
    static strength = 1.1
    static energyRate = -0.00000
    static foodValue = 5
    static stiffness = 1

    static decayTime = 20 * 1000

    static inputs: string[] = []
    static outputs: string[] = []

    creature?: Creature
    constraints: Constraint[]
    body: Body
    composite: Composite
    edible = true
    eaten = false
    decayTime = -1
    x: number
    y: number

    constructor( creature: Creature, x, y ) {
        this.creature = creature
        let { cellSize } = Settings

        this.x = x
        this.y = y

        this.body = Bodies.rectangle( x * cellSize, y * cellSize, cellSize, cellSize, { render: { fillStyle: getColor( this ) } } )
        this.composite = Composite.create( { bodies: [ this.body ] } )
        // this.body = Bodies.circle( x * cellSize, y * cellSize, cellSize / 2, { render: { fillStyle: getColor( this ) } } )

        // @ts-ignore
        this.composite.plugin.descripion = "cell"

        this.body.plugin.cell = this
        Body.setDensity( this.body, getDensity( this ) * 0.001 * ( 8 / Settings.cellSize ) ** 2 )
        this.constraints = []
    }

    static iokey( type: "input" | "output", channel: string, x: number, y: number ) {
        return `${ type }_${ channel }_${ x },${ y }`
    }
    iokey( type: "input" | "output", channel: string ) {
        return Cell.iokey( type, channel, this.x, this.y )
    }
    getBrainOutput( channel: string ) {
        return this.creature?.brain.getValue( this.iokey( "output", channel ) ) ?? 0
    }
    setBrainInput( channel: string, value: number ) {
        this.creature?.brain.setValue( this.iokey( "input", channel ), value )
    }

    remove() {
        let engine = App.instance.engine
        World.remove( engine.world, this.composite, true )
        for ( let constraint of this.constraints )
            World.remove( engine.world, constraint, true )
        this.creature?.removeCell( this )
        this.onRemove()
    }

    sever() {
        if ( this.creature ) {
            let world = App.instance.engine.world
            Composite.remove( this.creature.body, this.composite )
            World.add( world, this.composite )
            // if ( !Composite.get( world, this.body.id, "body" ) )
        }
        this.creature = undefined
        this.edible = true
        if ( this.loseColorOnSever() )
            this.body.render.fillStyle = Cell.color
        this.decayTime = Cell.decayTime * ( 1 - Math.random() * .2 )
        this.onSever()
    }

    update( dt ) {
        if ( this.creature ) {
            this.creature.energy += getEnergyRate( this ) * dt * Settings.metabolicRate * ( 1 + this.metabolicBoost() )
            this.onUpdate( dt )
        }
    }

    onUpdate( dt ) { }
    onRemove() { }
    onSever() { }
    metabolicBoost() { return 1 }
    collide( other: Cell, dt: number ) { }
    loseColorOnSever() { return true }
}

export class CellRoot extends Cell {
    static weight = 0
    static color = "#CFCD66"
    static density = 1
    static strength = 1.1
    static energyRate = -0.00001
    static foodValue = 10

    onRemove() {
        // console.log( "ROOT CELL LOSS" )
        this.creature?.die()
    }
}

export class CellPhotosynthesis extends Cell {
    static weight = 3
    static color = "#509A53"
    static density = 2
    static strength = 1.1
    // static energyRate = 0.00012
    static energyRate = 0.00006
    // static energyRate = 0.00003
    static foodValue = 5

    metabolicBoost() {
        if ( Settings.photosynthesisElevationBoost == 0 )
            return 0
        let h = App.instance.height
        let y = this.body.position.y
        return Settings.photosynthesisElevationBoost * ( h - y ) / h
    }
}

export class CellArmor extends Cell {
    static weight = 1
    static color = "#73B3C0"
    static density = 3
    static strength = 5
    static energyRate = -0.00000
    static foodValue = 5

    edible = false
}

export class CellMouth extends Cell {
    static weight = 3
    static color = "#E35444"
    static density = 2
    static strength = 1.1
    // static energyRate = -0.00010
    static energyRate = -0.00003
    static foodValue = 7

    static cooldown = 500
    edible = Settings.edibleMouths
    cooldown = 0

    onUpdate( dt ) {
        this.cooldown -= dt
    }

    collide( other: Cell ) {
        if ( !this.creature || other.eaten ) return
        let differentCreature = other.creature != this.creature

        // Can eat other mouth if we have more energy.
        // TODO: Add an optional probabilistic rule.
        if ( other instanceof CellMouth ) {
            let otherEnergy = other.creature?.energy ?? 0
            let thisEnergy = this.creature.energy ?? 0
            if ( otherEnergy > thisEnergy )
                return
        }

        if ( differentCreature && other.edible && this.cooldown <= 0 ) {
            other.eaten = true
            other.remove()
            this.creature.energy += getFoodValue( other ) * Settings.carnivoreEfficiency
            this.cooldown += CellMouth.cooldown

            if ( other instanceof CellRoot && other.creature ) {
                this.creature.energy += other.creature.energy
                other.creature.energy = 0
            }
        }
    }
}

export class CellThruster extends Cell {
    static weight = 3
    static color = "#C88E4B"
    static density = 1
    static strength = 1.1
    static energyRate = -0.00002
    static foodValue = 7

    static thrust = 0.000002

    static outputs: string[] = [ "thrust" ]

    onUpdate( dt ) {
        if ( !this.creature )
            return

        let force = CellThruster.thrust * Settings.cellSize ** 2 * this.getBrainOutput( "thrust" )

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
    static energyRate = -0.00002
    static foodValue = 7

    static torque = 0.00001

    static outputs: string[] = [ "torque" ]

    onUpdate( dt ) {
        if ( !this.creature )
            return
        this.body.torque += CellSpinner.torque * dt * this.getBrainOutput( "torque" )
    }
}

export class CellSuction extends Cell {
    static weight = 3
    static color = "#007F7F"
    static density = 1
    static strength = 1.1
    static energyRate = -0.00002
    static foodValue = 7

    static outputs: string[] = [ "suction" ]

    static force = 0.001

    sensor?: Body
    nearbyCells: Set<Cell>

    constructor( creature: Creature, x: number, y: number ) {
        super( creature, x, y )

        this.nearbyCells = new Set()

        let radius = Settings.cellSize * 5
        let pos = this.body.position
        this.sensor = Bodies.circle(
            pos.x, pos.y, radius,
            {
                isSensor: true, isStatic: true,
                render: { fillStyle: "rgba(100, 100, 100, 0.25)" },
                plugin: {
                    on_collisionActive: ( other: Body ) => {
                        let cell = other.plugin.cell as Cell | undefined
                        if ( cell && cell.creature != this.creature )
                            this.nearbyCells.add( cell )
                    }
                }
            }
        )
        Composite.add( this.composite, this.sensor )
    }

    onSever() {
        if ( this.sensor ) {
            this.nearbyCells.clear()
            Composite.remove( this.composite, this.sensor )
            this.sensor = undefined
        }
    }

    onUpdate( dt ) {
        if ( !this.creature )
            return

        if ( this.sensor )
            Body.setPosition( this.sensor, this.body.position )

        // let app = App.instance
        // let { engine } = app
        // let allBodies = Composite.allBodies( engine.world )
        // let radius = Settings.cellSize * 5
        // let pos = this.body.position
        // let circle = Bodies.circle( pos.x, pos.y, radius )
        // let touching = Query.collides( circle, allBodies )
        // for ( let collision of touching ) {
        for ( let cell of this.nearbyCells ) {
            // let body = collision.bodyA
            // let cell = body.plugin.cell
            // if ( cell && ( cell.creature != this.creature ) ) {
            // }
            let body = cell.body
            let diff = Vector.sub( this.body.position, body.position )
            let lengthSq = Vector.magnitudeSquared( diff )
            let signal = this.getBrainOutput( "suction" )
            let force = Vector.mult( diff, CellSuction.force * signal / lengthSq )
            Body.applyForce( body, body.position, force )
            Body.applyForce( this.body, this.body.position, Vector.neg( force ) )
        }

        this.nearbyCells.clear()
    }
}

export class CellEye extends Cell {

    static weight = 2
    static color = "#CC53C9"
    static density = 1
    static strength = 1.1
    static energyRate = -0.00001

    static inputs: string[] = [ "seeCreature" ]

    static inactiveColor = "rgba(100, 100, 100, 0.25)"
    static activeColor = "rgba(0, 100, 0, 0.25)"

    sensor?: Body
    collisions: number = 0
    active: boolean = false


    constructor( creature: Creature, x: number, y: number ) {
        super( creature, x, y )
        let { cellSize } = Settings
        let width = 20 * cellSize
        let halfWidth = width / 2

        this.sensor = Bodies.rectangle(
            this.x * cellSize - halfWidth, this.y * cellSize,
            width, cellSize,
            {
                isSensor: true, isStatic: true,
                render: { fillStyle: CellEye.inactiveColor },
                plugin: {
                    on_collisionStart: ( other: Body ) => {
                        let cell = other.plugin.cell as Cell | undefined
                        if ( cell && cell.creature != this.creature )
                            this.collisions++
                    },
                    on_collisionEnd: ( other: Body ) => {
                        let cell = other.plugin.cell as Cell | undefined
                        if ( cell && cell.creature != this.creature )
                            this.collisions--
                    }
                }
            }
        )

        Body.setCentre( this.sensor, { x: this.x * cellSize + cellSize / 2, y: this.y * cellSize } )
        Composite.add( this.composite, this.sensor )
    }

    onSever() {
        if ( this.sensor ) {
            Composite.remove( this.composite, this.sensor )
            this.sensor = undefined
        }
    }

    onUpdate( dt ) {
        if ( this.sensor ) {
            Body.setPosition( this.sensor, this.body.position )
            Body.setAngle( this.sensor, this.body.angle )

            this.active = this.collisions > 0
            this.sensor.render.fillStyle = this.active ? CellEye.activeColor : CellEye.inactiveColor

            this.setBrainInput( "seeCreature", this.active ? 1 : 0 )
        }
    }

    // onUpdate( dt ) {

    //     let app = App.instance
    //     let { engine } = app
    //     let allBodies = Composite.allBodies( engine.world )

    //     let angle = this.body.angle
    //     let forward = Vector.create( Math.cos( angle ), Math.sin( angle ) )
    //     let start = this.body.position
    //     let end = Vector.add( start, Vector.mult( forward, Settings.cellSize * 20 ) )

    //     let collisions = Query.ray( allBodies, start, end )

    //     // console.log( collisions )

    // }

}

// export class CellRepulsion extends CellSuction {
//     static weight = 1
//     static color = "#CC53C9"
//     static density = 1
//     static strength = 1.1
//     // static energyRate = -0.00002
//     static energyRate = -0.00008
//     static foodValue = 7

//     force() { return -0.001 }

// }

// export class CellStringy extends Cell {
//     static weight = 3
//     static color = "#FFFFCC"
//     static density = 0.5
//     static strength = 1 / 0.05
//     static energyRate = 0
//     static foodValue = 2

//     static stiffness = 0.05
// }

// export class CellVampire extends Cell {
//     static weight = 1
//     static color = "#890D00"
//     static density = 2
//     static strength = 1.1
//     static energyRate = -0.00005
//     static foodValue = 7

//     static energyPerMilis = 0.0012

//     collide( other: Cell, dt: number ) {
//         let { creature } = this
//         let otherCreature = other.creature
//         if ( !creature || !otherCreature ) return
//         if ( otherCreature != creature ) {
//             let energy = Math.min( dt * CellVampire.energyPerMilis, otherCreature.energy )
//             creature.energy += energy
//             otherCreature.energy -= energy
//         }
//     }

// }

// export class CellPoison extends Cell {
//     static weight = 1
//     static color = "#121212"
//     static density = 1
//     static strength = 1.1
//     static energyRate = -0.00012
//     static foodValue = -100
//     loseColorOnSever() { return false }
// }

// export class CellImpact extends Cell {
//     static weight = 10
//     static color = "#121212"
//     static density = 1
//     static strength = 1.1
//     static energyRate = -0.00006
//     static foodValue = 7
//     // loseColorOnSever() { return false }

//     static cooldown = 500
//     static force = 0.05
//     edible = false
//     cooldown = 0

//     impactEvent: any = null

//     onUpdate( dt ) {
//         this.cooldown -= dt
//         if ( this.impactEvent ) {
//             let { force, body } = this.impactEvent
//             this.impactEvent = null
//             Body.applyForce( body, body.position, force )
//         }
//     }

//     collide( other: Cell ) {
//         if ( !this.creature || ( other.creature == this.creature ) || this.cooldown > 0 ) return
//         // this.cooldown = CellImpact.cooldown

//         let diff = Vector.sub( other.body.position, this.body.position )
//         let dir = Vector.normalise( diff )
//         let force = Vector.mult( dir, CellImpact.force )

//         this.impactEvent = { body: other.body, force }

//         // console.log( force )
//         // Body.applyForce( other.body, other.body.position, force )
//     }
// }