/**
 * Deep clones an object. Respects types and topology.
 */
export default function clone( value, cloned = new Map() ) {
    if ( isValueType( value ) )
        return value

    if ( cloned.has( value ) )
        return cloned.get( value )

    let result = new value.constructor()
    cloned.set( value, result )
    for ( let key in value )
        result[ key ] = clone( value[ key ], cloned )

    return result
}

export function isValueType( object ) {
    return typeof object != "object" || object === null
}