export default class CircularQueue<T> {

    back: number = 0
    front: number = 0
    data: T[]

    constructor( capacity: number ) {
        this.data = new Array( capacity )
    }

    enqueue( value: T, allowOverflow = false ) {
        let overflow = this.size() + 1 == this.data.length
        if ( !allowOverflow && overflow )
            return false
        this.data[ this.back % this.data.length ] = value
        this.back++
        return true
    }

    dequeue() {
        if ( this.size() == 0 )
            return undefined
        let front = this.data[ this.front % this.data.length ]
        this.front++
        return front
    }

    size() {
        return this.back - this.front
    }

}