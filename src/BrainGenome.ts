/*
    TODO: Add i/o to some cells.
    TODO: Add way to visualize brain layout and activation. 
        PREREQS: react refactor, rendering refactor, creature details component
*/

import { Settings } from "./Settings"
import createSampler from "./common/createSampler"
import { keySampler, randInt, randomElement, randomElementX } from "./common/math"

const sampleMutationType = keySampler( Settings.brain.mutationRates )

type Weights = { [ key: string ]: number }
type NodeGene = { name: string, bias: number, weights: Weights }
export class BrainGenome {

    hidden!: NodeGene[]
    inputs!: NodeGene[]
    outputs!: NodeGene[]
    hiddenNodeCounter = 0

    static create() {
        let result = new BrainGenome()
        result.hidden = []
        result.inputs = []
        result.outputs = []
        return result
    }

    connectionCount() {
        let count = 0
        for ( let group of [ this.hidden, this.outputs ] )
            for ( let node of group )
                count += Object.keys( node.weights ).length
        return count
    }

    setIOKeys( inKeys: string[], outKeys: string[] ) {
        let inKeySet = new Set( inKeys )
        let outKeySet = new Set( outKeys )

        // console.log( "Setting io keys:" )
        // console.log( { inKeys, outKeys } )

        const addRemoveNodes = ( list: NodeGene[], expectedKeys: Set<string>, isSink: boolean ) => {
            let toRemove: NodeGene[] = []
            for ( let node of list ) {
                if ( !expectedKeys.has( node.name ) )
                    toRemove.push( node )
                expectedKeys.delete( node.name )
            }
            for ( let node of toRemove )
                this.removeNode( list, node )
            for ( let name of expectedKeys ) {
                let node: NodeGene = { name, bias: 0, weights: {} }
                list.push( node )
                if ( isSink )
                    this.initializeSinkNode( node, 2 )
            }
        }

        addRemoveNodes( this.inputs, inKeySet, false )
        addRemoveNodes( this.outputs, outKeySet, false )
    }

    buildBrain() {
        let groups = [ this.hidden, this.inputs, this.outputs ]

        // Number nodes
        let brainMap: BrainMap = {}
        let i = 0
        for ( let group of groups )
            for ( let node of group )
                brainMap[ node.name ] = i++

        let brain = new Brain( brainMap )
        for ( let group of groups ) {
            for ( let nodeGene of group ) {
                let { weights, bias } = nodeGene
                let node: Node = { inputs: [], value: 0, bias, static: group == this.inputs }
                for ( let key in weights )
                    node.inputs.push( [ brainMap[ key ], weights[ key ] ] )
                brain.nodes.push( node )
            }
        }

        return brain
    }

    // Mutation methods:

    mutate() {
        switch ( sampleMutationType() ) {
            case "connect": return this.mutateConnect()
            case "disconnect": return this.mutateDisconect()
            case "modifyWeight": return this.mutateWeight()
            case "modifyBias": return this.mutateBias()
            case "addHidden": return this.mutateAddHidden()
            case "deleteHidden": return this.mutateDeleteHidden()
        }
    }

    mutateConnect() {
        let source = this.randomNode()
        let sink = this.randomSinkNode()
        if ( source && sink )
            sink.weights[ source.name ] = Math.random() * 2 - 1
    }
    mutateDisconect() {
        let weight = this.randomWeight() as [ Weights, string ] | undefined
        if ( weight ) {
            let [ weights, key ] = weight
            delete weights[ key ]
        }
    }
    mutateWeight() {
        let weight = this.randomWeight() as [ Weights, string ] | undefined
        if ( weight ) {
            let [ weights, key ] = weight
            weights[ key ] += Math.random() * 2 - 1
        }
    }
    mutateBias() {
        let node = this.randomSinkNode()
        if ( node )
            node.bias += Math.random() * 2 - 1
    }
    mutateAddHidden() {
        if ( this.hidden.length >= Settings.brain.maxHidden )
            return
        let node = {
            name: "hidden_" + this.hiddenNodeCounter++,
            bias: 0, weights: {}
        }
        this.hidden.push( node )
        this.initializeSinkNode( node )
    }
    initializeSinkNode( node: NodeGene, bias = Math.random() * 2 - 1 ) {
        node.bias = bias
        for ( let i = 0; i < Settings.brain.initialInputsToHidden; i++ ) {
            let otherNode = this.randomNode()
            node.weights[ otherNode.name ] = Math.random() * 2 - 1
        }
        for ( let i = 0; i < Settings.brain.initialOutputsToHidden; i++ ) {
            let otherNode = this.randomSinkNode()
            otherNode.weights[ node.name ] = Math.random() * 2 - 1
        }
    }
    mutateDeleteHidden() {
        let i = randInt( 0, this.hidden.length )
        this.hidden.slice( i, 1 )
    }

    // Utility methods:

    removeNode( from: NodeGene[], node: NodeGene ) {
        from.splice( from.indexOf( node ), 1 )
        for ( let group of [ this.hidden, this.outputs ] )
            for ( let otherNode of group )
                delete otherNode.weights[ node.name ]
    }

    prune() {
        // Build edge maps
        let forwardEdges = {}
        let backwardEdges = {}
        function addEdge( map, a: string, b: string ) {
            let node = map[ a ]
            if ( !node ) node = map[ a ] = []
            node.push( b )
        }
        for ( let group of [ this.hidden, this.inputs, this.outputs ] ) {
            for ( let node of group ) {
                for ( let key in node.weights ) {
                    addEdge( forwardEdges, key, node.name )
                    addEdge( backwardEdges, node.name, key )
                }
            }
        }

        function dfs( key: string, edgeMap: { [ key: string ]: string }, visited: Set<string> ) {
            if ( visited.has( key ) )
                return
            visited.add( key )
            let neighbors = edgeMap[ key ]
            if ( neighbors )
                for ( let other of neighbors )
                    dfs( other, edgeMap, visited )
        }

        let connectedToIn = new Set<string>()
        let connectedToOut = new Set<string>()
        for ( let node of this.inputs ) dfs( node.name, forwardEdges, connectedToIn )
        for ( let node of this.outputs ) dfs( node.name, backwardEdges, connectedToOut )

        let toPrune: NodeGene[] = []
        for ( let node of this.hidden )
            if ( !connectedToIn.has( node.name ) || !connectedToOut.has( node.name ) )
                toPrune.push( node )
        for ( let node of toPrune )
            this.removeNode( this.hidden, node )
        // console.log( "Pruned:", toPrune.map( x => x.name ) )
    }

    getWeightCount() {
        return this.hidden.reduce( ( a, b ) => a + Object.keys( b.weights ).length, 0 )
            + this.outputs.reduce( ( a, b ) => a + Object.keys( b.weights ).length, 0 )
    }

    randomWeight() {
        let netWeights = this.getWeightCount()
        let i = randInt( 0., netWeights )
        for ( let group of [ this.hidden, this.outputs ] ) {
            for ( let node of group ) {
                let keys = Object.keys( node.weights )
                if ( i < keys.length )
                    return [ node.weights, keys[ i ] ]
                i -= keys.length
            }
        }
    }

    randomNode() { return randomElementX( this.hidden, this.inputs, this.outputs ) as NodeGene }
    randomSinkNode() { return randomElementX( this.hidden, this.outputs ) as NodeGene }

    // Tests

    static test() {
        let print = x => console.log( JSON.stringify( x, null, 2 ) )

        let g = BrainGenome.create()
        g.setIOKeys( [ "input_0,0" ], [ "output_1,1" ] )
        // print( g )
        for ( let i = 0; i < 3; i++ )
            g.mutateAddHidden()
        // print( g )
        for ( let i = 0; i < 10; i++ )
            g.mutate()
        g.prune()
        print( g )

        let b = g.buildBrain()
        console.log( b )
        for ( let i = 0; i < 10; i++ ) {
            b.step()
            // console.log( b.nodes.map( n => n.value ) )
        }
    }

}

type Node = { inputs: [ number, number ][], value: number, bias: number, static: boolean }
type BrainMap = { [ key: string ]: number }
export default class Brain {
    nodes: Node[] = []
    brainMap: BrainMap

    constructor( brainMap: BrainMap ) { this.brainMap = brainMap }

    setValue( name, value ) { this.nodes[ this.brainMap[ name ] ].value = value }
    getValue( name ) { return this.nodes[ this.brainMap[ name ] ].value }

    step() {
        let previousValues = this.nodes.map( node => node.value )
        for ( let node of this.nodes ) {
            if ( node.static )
                continue
            let sum = 0
            for ( let [ index, weight ] of node.inputs )
                sum += previousValues[ index ] * weight
            node.value = Math.tanh( sum + node.bias )
        }
    }

}
