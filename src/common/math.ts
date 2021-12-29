export function random( min, max ) {
    return min + ( max - min ) * Math.random()
}

export function randInt( min, max ) {
    return Math.floor( random( min, max ) )
}

export function randomElement( array ) {
    if ( array.length == 0 )
        return null
    return array[ randInt( 0, array.length ) ]
}

export function clamp( x, min = 0, max = 1 ) {
    if ( x < min ) return min
    if ( x > max ) return max
    return x
}