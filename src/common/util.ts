export function removeFromArray( array: any[], value ) {
    let index = array.indexOf( value )
    if ( index > -1 )
        array.splice( index, 1 )
}