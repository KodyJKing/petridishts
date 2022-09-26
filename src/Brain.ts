/*
    TODO: Implement BrainGenome.buildBrain.
    TODO: Add i/o to some cells.
    TODO: Add way to visualize brain layout and activation. 
        PREREQS: react refactor, rendering refactor, creature details component
*/

import { Settings } from "./Settings"
import createSampler from "./common/createSampler"
import { keySampler, randInt, randomElement, randomElementX } from "./common/math"

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
    biases!: { [ key: string ]: number }

    static create( ctx: BrainContext ) {
        let result = new BrainGenome()
        result.hidden = []
        result.connections = []
        result.biases = {}
    }

    mutate( ctx: BrainContext ) {
        switch ( sampleMutationType() ) {
            case "connect": return this.mutateAddConnection( ctx )
            case "disconnect": return this.mutateDeleteConnection()
            case "modifyWeight": return this.mutateWeight()
            case "modifyBias": return this.mutateBias( ctx )
            case "add": return this.mutateAddHidden( ctx )
            case "delete": return this.mutateDeleteHidden()
        }
    }

    mutateAddConnection( ctx: BrainContext ) {
        this.addRandomConnection(
            this.randomNode( ctx ),
            this.randomNode( ctx, false )
        )
    }

    addRandomConnection( fromNode, toNode ) {
        this.connections.push( [ fromNode, toNode, Math.random() * 2 - 1 ] )
    }

    mutateWeight() {
        if ( this.connections.length == 0 ) return
        let index = randInt( 0, this.connections.length )
        this.connections[ index ][ 2 ] += Math.random() * 2 - 1
    }

    mutateBias( ctx: BrainContext ) {
        let node = this.randomNode( ctx, false )
        this.biases[ node ] += Math.random() * 2 - 1
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
        this.biases[ name ] = Math.random() * 2 - 1
        for ( let i = 0; i < Settings.brain.initialInputsToHidden; i++ )
            this.addRandomConnection( this.randomNode( ctx ), name )
        for ( let i = 0; i < Settings.brain.initialOutputsToHidden; i++ )
            this.addRandomConnection( name, this.randomNode( ctx, false ) )
    }

    mutateDeleteHidden() {
        if ( this.hidden.length == 0 ) return
        let index = randInt( 0, this.hidden.length )
        let name = this.hidden[ index ]
        delete this.biases[ name ]
        this.hidden.splice( index, 1 )
    }

    randomNode( ctx: BrainContext, includeInputs = true, includeOutputs = true ) {
        let arrays = [ this.hidden ]
        if ( includeInputs )
            arrays.push( ctx.inputs )
        if ( includeOutputs )
            arrays.push( ctx.outputs )
        return randomElementX( arrays )
    }

}