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
    keys() {
        return Object.keys( this.values ).map( key => {
            let [ x, y ] = key.split( "," )
            return { x: parseInt( x ), y: parseInt( y ) }
        } )
    }
}