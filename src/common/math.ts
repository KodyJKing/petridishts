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

export function randomElementX<T>( ...arrays: T[][] ): T | undefined {
    let netLength = arrays.reduce( ( a, b ) => a + b.length, 0 )
    if ( netLength == 0 )
        return undefined
    let i = randInt( 0, netLength )
    for ( let array of arrays ) {
        if ( i < array.length )
            return array[ i ]
        i -= array.length
    }
}

// Source: https://en.wikipedia.org/wiki/Box%E2%80%93Muller_transform
let __randomGuassian_next__: number | null = null
export function randomGuassian() {
    if ( __randomGuassian_next__ ) {
        let result = __randomGuassian_next__
        __randomGuassian_next__ = null
        return result
    }

    let angle = Math.random() * 2 * Math.PI
    let radius = Math.sqrt( -2 * Math.log( Math.random() ) )

    let result1 = Math.cos( angle ) * radius
    let result2 = Math.sign( angle ) * radius

    __randomGuassian_next__ = result2
    return result1
}

export function clamp( x, min = 0, max = 1 ) {
    if ( x < min ) return min
    if ( x > max ) return max
    return x
}

export function remap( premin: number, premax: number, min: number, max: number, value: number ) {
    let alpha = ( value - premin ) / ( premax - premin )
    return min + alpha * ( max - min )
}

type WeightMap = { [ key: string ]: number }
export function keySampler<T extends WeightMap>( weightMap: T, normalize = true ): () => keyof T {
    let entries = Object.entries( weightMap )

    if ( normalize ) {
        let sum = 0
        for ( let entry of entries )
            sum += entry[ 1 ]
        for ( let entry of entries )
            entry[ 1 ] /= sum
    }

    return function () {
        let u = Math.random()
        for ( let [ key, weight ] of entries ) {
            u -= weight
            if ( u <= 0 )
                return key
        }
    } as () => keyof T
}