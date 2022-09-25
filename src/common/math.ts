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