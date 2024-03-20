import Matter, { Bodies, Body, Composite, Constraint, IChamferableBodyDefinition, Query, Vector, World } from "matter-js"
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
function getIsThreat( cell ) { return cell.constructor.isThreat }

export class Cell {
    static weight = 3
    static color = "#DAE3E8"
    static density = 1
    static strength = 1.1
    static energyRate = -0.00000
    static foodValue = 5
    static stiffness = 1
    static isThreat = false

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
        this.decayTime = Settings.decayTime * ( 1 - Math.random() * .2 )
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
    // static energyRate = 0.00006
    // static energyRate = 0.00003
    static energyRate = Settings.energyRates.photosynthesis
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
    static energyRate = Settings.energyRates.mouth
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

            function score( cell: CellMouth, other: CellMouth ) {
                let speed = Vector.magnitude( cell.body.velocity )
                let toOther = Vector.normalise( Vector.sub( other.body.position, cell.body.position ) )
                let mouthForward = Vector.rotate( Vector.create( 1, 0 ), cell.body.angle )
                let dot = Vector.dot( mouthForward, toOther )
                return speed * ( dot + 1 )
            }

            // Mouth with highest score wins.
            let thisScore = score( this, other )
            let otherScore = score( other, this )
            if ( thisScore < otherScore )
                return

            // Faster mouth wins
            // let speed = Vector.magnitude( this.body.velocity )
            // let otherSpeed = Vector.magnitude( other.body.velocity )
            // if ( speed < otherSpeed )
            //     return

            // Mouth facing forward wins.
            // let toOther = Vector.normalise( Vector.sub( other.body.position, this.body.position ) )
            // let mouthForward = Vector.rotate( Vector.create( 1, 0 ), this.body.angle )
            // let otherForward = Vector.rotate( Vector.create( 1, 0 ), other.body.angle )
            // let dot = Vector.dot( mouthForward, otherForward )
            // let otherDot = -Vector.dot( mouthForward, toOther )
            // if ( dot < otherDot )
            //     return

            // Mouth with more energy wins.
            // let otherEnergy = other.creature?.energy ?? 0
            // let thisEnergy = this.creature.energy ?? 0
            // if ( otherEnergy > thisEnergy )
            //     return
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
    // static weight = 0
    static color = "#C88E4B"
    static density = 1
    static strength = 1.1
    static energyRate = Settings.energyRates.thruster
    static foodValue = 7

    // static thrust = 0.000002
    static thrust = 0.000008

    static outputs: string[] = [ "thrustParallel", "thrustPerp", "thrustEnable" ]

    onUpdate( dt ) {
        if ( !this.creature )
            return

        if ( this.getBrainOutput( "thrustEnable" ) < 0 )
            return

        let thrustCoef = CellThruster.thrust * Settings.cellSize ** 2
        let forceParallel = thrustCoef * this.getBrainOutput( "thrustParallel" )
        let forcePerp = thrustCoef * this.getBrainOutput( "thrustPerp" )

        let t = this.body.angle
        Matter.Body.applyForce(
            this.body, this.body.position,
            {
                x: Math.cos( t ) * forceParallel + Math.cos( t + Math.PI / 2 ) * forcePerp,
                y: Math.sin( t ) * forceParallel + Math.sin( t + Math.PI / 2 ) * forcePerp
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

    // static torque = 0.00001
    static torque = 0.00010

    static outputs: string[] = [ "torque", "torqueEnable" ]

    onUpdate( dt ) {
        if ( !this.creature || this.getBrainOutput( "torqueEnable" ) < 0 )
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
    static isThreat = true

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
                collisionFilter: { group: -1 },
                render: {
                    fillStyle: CellEye.inactiveColor,
                    visible: Settings.showSuctionRadius,
                },
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

        for ( let cell of this.nearbyCells ) {
            let body = cell.body
            let diff = Vector.sub( this.body.position, body.position )
            let lengthSq = Vector.magnitudeSquared( diff )
            let signal = this.getBrainOutput( "suction" ) + .5 // Bias toward suction.
            let force = Vector.mult( diff, CellSuction.force * signal / lengthSq )
            Body.applyForce( body, body.position, force )
            Body.applyForce( this.body, this.body.position, Vector.neg( force ) )
        }

        this.nearbyCells.clear()
    }
}

export class CellEye extends Cell {

    static weight = 2
    static color = "#222222"
    static density = 1
    static strength = 1.1
    static energyRate = Settings.energyRates.eye

    static inputs: string[] = [ "foodX", "foodY", "foodCount", "threatX", "threatY", "threatCount" ]

    static outputs: string[] = [ "thrust" ]

    // static thrust = 0.000016
    static thrust = 0.000008

    static inactiveColor = "rgba(100, 100, 100, 0.04)"
    static activeColor = "rgba(0, 100, 0, 0.04)"

    sensor?: Body
    collisions: number = 0
    visibleBodies: Set<Body>
    active: boolean = false

    constructor( creature: Creature, x: number, y: number ) {
        super( creature, x, y )
        let { cellSize } = Settings

        this.visibleBodies = new Set()

        let sensorOptions: IChamferableBodyDefinition = {
            isSensor: true, isStatic: true,
            collisionFilter: { group: -1 },
            render: { fillStyle: CellEye.inactiveColor },
            plugin: {
                on_collisionStart: ( other: Body ) => { this.visibleBodies.add( other ) },
                on_collisionEnd: ( other: Body ) => { this.visibleBodies.delete( other ) },
                // on_collisionActive: ( other: Body ) => { this.visibleBodies.add( other ) }
            }
        }

        {
            let cs = cellSize
            let vec = ( x, y ) => Vector.create( x, y )
            let x = this.x * cellSize, y = this.y * cellSize
            let length = 40 * cellSize, slope = 0.5, width = length * slope
            this.sensor = Bodies.fromVertices(
                x, y,
                [ [
                    vec( 0, cs / 2 ), vec( length, width / 2 ),
                    vec( length, - width / 2 ), vec( 0, -cs / 2 ),
                ] ],
                sensorOptions
            )
            let bounds = this.sensor.bounds
            let offset = x + cellSize / 2 - bounds.min.x
            Body.setCentre( this.sensor, { x: x - offset, y } )
        }

        Composite.add( this.composite, this.sensor )
    }

    onSever() {
        if ( this.sensor ) {
            Composite.remove( this.composite, this.sensor )
            this.sensor = undefined
            this.visibleBodies.clear()
        }
    }

    onUpdate( dt ) {
        if ( this.sensor ) {
            Body.setPosition( this.sensor, this.body.position )
            Body.setAngle( this.sensor, this.body.angle )

            let t = this.body.angle, c = Math.cos( t ), s = Math.sin( t )
            let forward = Vector.create( c, s ), side = Vector.create( -s, c )

            let foodX = 0, foodY = 0, foodCount = 0, threatX = 0, threatY = 0, threatCount = 0
            for ( let body of this.visibleBodies ) {
                let cell = body.plugin.cell as Cell | undefined
                if ( cell && ( cell.creature != this.creature ) ) {
                    let isThreat = getIsThreat( cell )
                    if ( isThreat ) {
                        threatX += body.position.x
                        threatY += body.position.y
                        threatCount++
                    } else if ( cell.edible ) {
                        let foodValue = getFoodValue( cell )
                        foodX += body.position.x * foodValue
                        foodY += body.position.y * foodValue
                        foodCount += foodValue
                        // foodCount++
                    }
                }
            }

            if ( foodCount != 0 ) {
                foodX /= foodCount
                foodY /= foodCount
            }

            const toEyeSpace = ( pos: Vector ) => {
                let diff = Vector.sub( pos, this.body.position )
                return Vector.create(
                    Vector.dot( diff, forward ),
                    Vector.dot( diff, side )
                )
            }
            let foodPos = toEyeSpace( Vector.create( foodX / foodCount, foodY / foodCount ) )
            let threatPos = toEyeSpace( Vector.create( threatX / threatCount, threatY / threatCount ) )

            this.setBrainInput( "foodX", foodPos.x )
            this.setBrainInput( "foodY", foodPos.y )
            this.setBrainInput( "foodCount", foodCount )
            this.setBrainInput( "threatX", threatPos.x )
            this.setBrainInput( "threatY", threatPos.y )
            this.setBrainInput( "threatCount", threatCount )

            this.active = threatCount > 0 || foodCount > 0
            this.sensor.render.fillStyle = this.active ? CellEye.activeColor : CellEye.inactiveColor

            if ( this.active ) {
                let thrustSignal = this.getBrainOutput( "thrust" ) + 0.5 // Bias to positive values
                let thrustCoef = CellEye.thrust * Settings.cellSize ** 2
                let thrust = thrustCoef * thrustSignal
                let t = this.body.angle
                let force = Vector.create( c * thrust, s * thrust )
                Body.applyForce( this.body, this.body.position, force )
            }
        }

    }

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

export class CellVampire extends Cell {
    static weight = 3
    static color = "#890D00"
    static density = 2
    static strength = 1.1
    static energyRate = -0.00001
    static foodValue = 7

    static energyPerMilis = 0.012
    static agePerMilis = 1

    static isThreat = true

    collide( other: Cell, dt: number ) {
        let { creature } = this
        let otherCreature = other.creature
        if ( !creature || !otherCreature ) return
        if ( otherCreature != creature ) {
            let energy = Math.min( dt * CellVampire.energyPerMilis, otherCreature.energy )
            creature.energy += energy
            otherCreature.energy -= energy

            creature.age -= dt * CellVampire.agePerMilis
            // otherCreature.age += dt * CellVampire.agePerMilis
        }
    }

}

export class CellPoison extends Cell {
    static weight = 0
    static color = "#CC53C9"
    static density = 1
    static strength = 1.1
    static energyRate = -0.00001
    static foodValue = -100
    static isThreat = true
    loseColorOnSever() { return false }
}

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