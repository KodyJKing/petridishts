import Matter, { Bodies, Body, Composite, Constraint, Query, Vector, World } from "matter-js"
import App from "./App"
import { Settings } from "./Settings"
import Creature from "./Creature"

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
    edible = true
    eaten = false
    decayTime = -1
    x: number
    y: number

    static iokey( type: "input" | "output", channel: string, x: number, y: number ) {
        return `${ type }_${ channel }_${ x },${ y }`
    }

    iokey( type: "input" | "output", channel: string ) {
        return Cell.iokey( type, channel, this.x, this.y )
    }

    constructor( creature: Creature, x, y ) {
        this.creature = creature
        let { cellSize } = Settings

        this.x = x
        this.y = y

        this.body = Bodies.rectangle( x * cellSize, y * cellSize, cellSize, cellSize, { render: { fillStyle: getColor( this ) } } )
        // this.body = Bodies.circle( x * cellSize, y * cellSize, cellSize / 2, { render: { fillStyle: getColor( this ) } } )

        this.body.plugin.cell = this
        Body.setDensity( this.body, getDensity( this ) * 0.001 * ( 8 / Settings.cellSize ) ** 2 )
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

    sever() {
        if ( this.creature ) {
            let world = App.instance.engine.world
            Composite.remove( this.creature.body, this.body )
            World.add( world, this.body )
            // if ( !Composite.get( world, this.body.id, "body" ) )
        }
        this.creature = undefined
        this.edible = true
        if ( this.loseColorOnSever() )
            this.body.render.fillStyle = Cell.color
        this.decayTime = Cell.decayTime * ( 1 - Math.random() * .2 )

    }

    update( dt ) {
        if ( this.creature ) {
            this.creature.energy += getEnergyRate( this ) * dt * Settings.metabolicRate * ( 1 + this.metabolicBoost() )
            this.onUpdate( dt )
        }
    }

    onUpdate( dt ) { }
    onRemove() { }
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
        let t = App.instance.engine.timing.timestamp
        let freq = 2 / 1000 // 2 cycles per 1000 milis
        let phase = this.creature?.noise * Math.PI * 2
        let force = CellThruster.thrust * Settings.cellSize ** 2 * ( Math.sin( t * freq + phase ) + 1 )
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

    onUpdate( dt ) {
        let speed = Vector.magnitude( this.body.velocity )
        this.body.torque += CellSpinner.torque * dt / Math.max( speed, 0.1 )
    }
}

export class CellSuction extends Cell {
    static weight = 3
    static color = "#007F7F"
    static density = 1
    static strength = 1.1
    static energyRate = -0.00002
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
    static color = "#CC53C9"
    static density = 1
    static strength = 1.1
    // static energyRate = -0.00002
    static energyRate = -0.00008
    static foodValue = 7

    force() { return -0.001 }

}

// export class CellStringy extends Cell {
//     static weight = 3
//     static color = "#FFFFCC"
//     static density = 0.5
//     static strength = 1 / 0.05
//     static energyRate = 0
//     static foodValue = 2

//     static stiffness = 0.05
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