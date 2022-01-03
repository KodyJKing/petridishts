type Position = { x: number, y: number }

export default class Grid {
    values: any

    static Create() {
        let result = new Grid()
        result.values = {}
        return result
    }

    get( x, y ) { return this.values[ x + ", " + y ] }
    set( x, y, value ) { return this.values[ x + ", " + y ] = value }
    delete( x, y ) { delete this.values[ x + ", " + y ] }
    keys(): Position[] {
        return Object.keys( this.values ).map( key => {
            let [ x, y ] = key.split( "," )
            return { x: parseInt( x ), y: parseInt( y ) }
        } )
    }

    getReachableKeys( x, y, allowDiagonal = true ): Position[] {
        let visited = new Set()
        let result: Position[] = []

        const visit = ( x, y ) => {
            let key = x + ", " + y
            if ( visited.has( key ) )
                return
            visited.add( key )

            let value = this.get( x, y )
            if ( value == undefined )
                return

            result.push( { x, y } )

            for ( let dx = -1; dx < 2; dx++ ) {
                for ( let dy = -1; dy < 2; dy++ ) {
                    if ( !allowDiagonal && Math.abs( dx ) > 0 && Math.abs( dy ) > 0 )
                        continue
                    visit( x + dx, y + dy )
                }
            }

        }

        visit( x, y )

        return result
    }

    getUnreachableKeys( x, y, allowDiagonal = true ): Position[] {
        let reachableKeys = this.getReachableKeys( x, y, allowDiagonal )
        let reachableKeySet = new Set( reachableKeys.map( posKey ) )
        return this.keys().filter( pos => !reachableKeySet.has( posKey( pos ) ) )
    }

    get size() {
        return Object.keys( this.values ).length
    }
}

function posKey( pos: Position ) {
    return pos.x + ", " + pos.y
}