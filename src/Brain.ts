/*
    TODO: Implement BrainGenome.buildBrain.
    TODO: Add i/o to some cells.
    TODO: Add way to visualize brain layout and activation. 
        PREREQS: react refactor, rendering refactor, creature details component
*/

import { Settings } from "./Settings"
import createSampler from "./common/createSampler"
import { keySampler, randInt, randomElement } from "./common/math"

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

type BrainContext = { inputs: string[], outputs: string[] }

const sampleMutationType = keySampler( Settings.brain.mutationRates )
export class BrainGenome {

    hidden!: string[]
    connections!: [ string, string, number ][]
    hiddenNodeCounter: number = 0

    static create( ctx: BrainContext ) {
        let result = new BrainGenome()
        result.connections
    }

    mutate( ctx: BrainContext ) {
        switch ( sampleMutationType() ) {
            case "connect":
                return this.mutateAddConnection( ctx )
            case "disconnect":
                return this.mutateDeleteConnection()
            case "modify":
                this.mutateWeight()
            case "add":
                this.mutateAddHidden( ctx )
        }
    }

    mutateAddConnection( ctx: BrainContext ) {
        let nodeA = this.randomNode( ctx )
        let nodeB = this.randomNode( ctx )
        this.addRandomConnection( nodeA, nodeB )
    }

    addRandomConnection( nodeA, nodeB ) {
        this.connections.push( [ nodeA, nodeB, Math.random() * 2 - 1 ] )
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

    mutateAddHidden( ctx: BrainContext ) {
        if ( this.hidden.length >= Settings.brain.maxHidden )
            return
        let name = "hidden" + this.hiddenNodeCounter++
        this.hidden.push( name )
        for ( let i = 0; i < Settings.brain.initialInputsToHidden; i++ )
            this.addRandomConnection( this.randomNode( ctx ), name )
        for ( let i = 0; i < Settings.brain.initialOutputsToHidden; i++ )
            this.addRandomConnection( name, this.randomNode( ctx ) )
    }

    randomNode( ctx: BrainContext ) {
        let { hidden } = this
        let { inputs, outputs } = ctx

        let netNodes = inputs.length + outputs.length + hidden.length
        let cumInput = inputs.length / netNodes
        let cumOutput = cumInput + outputs.length / netNodes

        let r = Math.random()
        if ( r < cumInput )
            return randomElement( inputs )
        else if ( r < cumOutput )
            return randomElement( outputs )
        else
            return randomElement( hidden )
    }

}