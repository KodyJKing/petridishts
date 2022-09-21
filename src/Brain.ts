import { Settings } from "./App"
import createSampler from "./common/createSampler"
import { randInt, randomElement } from "./common/math"

class Node {
    inputs: [ number, number ][] = []
    value: number = 0
}

export default class Brain {
    nodes: Node[] = []

    setValue( index, value ) { this.nodes[ index ] = value }
    getValue( index ) { return this.nodes[ index ] }

    step() {
        let previousValues = this.nodes.map( node => node.value )
        for ( let node of this.nodes ) {
            let sum = 0
            for ( let [ index, weight ] of node.inputs )
                sum += previousValues[ index ] * weight
            node.value = Math.tanh( sum )
        }
    }

}

export class BrainGenome {

    inputs!: string[]
    hidden!: string[]
    outputs!: number[]
    connections!: [ string, string, number ][]
    hiddenNodeCounter: number = 0

    static create( inputs: string[], outputs: number[] ) {
        let result = new BrainGenome()
        result.inputs = inputs
        result.outputs = outputs
        result.connections
    }

    mutate() {
        if ( Math.random() < Settings.brain.deleteRate )
            this.mutateDeleteConnection()
        if ( Math.random() < Settings.brain.connectRate )
            this.mutateAddConnection()
        // if (Math.random < Settings.brain.)
    }

    mutateAddConnection() {
        let nodeA = this.randomNode()
        let nodeB = this.randomNode()
        this.connections.push( [ nodeA, nodeB, Math.random() * 2 - 1 ] )
    }

    mutateAddHidden() {

    }

    mutateWeight() {
        if ( this.connections.length == 0 ) return
        let index = randInt( 0, this.connections.length )
        this.connections[ index ][ 2 ] += Math.random() * 2 - 1
    }

    mutateDeleteConnection() {
        if ( this.connections.length == 0 ) return
        let index = randInt( 0, this.connections.length )
        this.connections.splice( index, 1 )
    }

    randomNode() {
        let { inputs, hidden, outputs } = this
        let netNodes = inputs.length + outputs.length + Settings.brain.maxHidden
        let cumInput = inputs.length / netNodes
        let cumOutput = cumInput + outputs.length / netNodes
        let r = Math.random()
        if ( r < cumInput )
            return randomElement( inputs )
        else if ( r < cumOutput )
            return randomElement( outputs )
        else
            return "hidden" + randInt( 0, Settings.brain.maxHidden )
    }

}