export default function createSampler( weights: number[] ) {
    let cumulativeWeight = 0
    let cdf: number[] = []
    for ( let weight of weights ) cdf.push( cumulativeWeight += weight )
    let netWeight = cdf[ cdf.length - 1 ]

    return () => {
        let threshold = Math.random() * netWeight
        let low = 0
        let high = cdf.length - 1
        while ( true ) {
            let mid = Math.floor( ( low + high ) / 2 )
            let prevValue = cdf[ mid - 1 ] ?? 0
            let midValue = cdf[ mid ]
            if ( midValue >= threshold ) {
                if ( prevValue < threshold )
                    return mid
                else
                    high = mid - 1
            } else {
                low = mid + 1
            }
        }
    }
}