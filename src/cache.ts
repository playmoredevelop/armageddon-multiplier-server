import { IBird } from './interfaces'
import { randomBetween, randomSkin, randomUniq } from './utils';

/** @todo redis */
const _CACHED = {
    birds: new Map<string, Array<IBird>>(),
    userdata: new Map<string, { [key: string]: unknown }>(),
    ttl: {
        birds: new Map<string, number>(),
        userdata: new Map<string, number>()
    },
    names: [
        "Anders Hejlsberg", "Ted Henter", "Andy Hertzfeld", "Rich Hickey", "Grace Hopper", "Dave Hyatt", "Miguel de Icaza", "Roberto Ierusalimschy", "Dan Ingalls",
        "Toru Iwatani", "Bo Jangeborg", "Paul Jardetzky", "Lynne Jolitz", "William Jolitz", "Bill Joy", "Mitch Kapor", "Phil Katz", "Alan Kay", "Mel Kaye",
        "Brian Kernighan", "Dennis Ritchie", "Jim Knopf", "Andre LaMothe", "Leslie Lamport", "Butler Lampson", "Sam Lantinga", "Chris Lattner", "Samuel J Leffler",
        "Rasmus Lerdorf", "Linus torvalds"
    ]
}

type IBirds = Array<IBird>

export async function cacheBirds(hash: string, birds: IBirds, limit: number = 10): Promise<IBirds> {

    birds = birds.filter(b => ! b.isEgg)

    const chunked = await chunkedBirds(birds, limit)

    _CACHED.birds.set(hash, chunked)
    _CACHED.ttl.birds.set(hash, Date.now())
    _CACHED.ttl.birds.forEach((t, sess) => (Date.now() - t) > 1000 * 3600 && _CACHED.ttl.birds.delete(sess))

    return chunked
}

export async function cacheUserdata<T extends {}>(hash: string, data: T): Promise<T> {

    _CACHED.userdata.set(hash, data)
    _CACHED.ttl.userdata.set(hash, Date.now())
    _CACHED.ttl.userdata.forEach((t, sess) => (Date.now() - t) > 1000 * 3600 && _CACHED.ttl.userdata.delete(sess))

    return data
}

export async function chunkedBirds(birds: IBirds, limit: number): Promise<IBirds> {

    // ok
    if (birds.length === limit) return birds

    // get chunk -> ok
    if (birds.length > limit) {
        return birds.slice(0, limit)
    }

    // get filled -> ok
    if (birds.length > 0) {
        return Array(limit).fill(null).map(() => birds[randomBetween(0, birds.length - 1)])
    }

    // get random birds -> ok
    if (birds.length <= 0) {
        return Array(limit).fill(null).map(() => randomSkin(_CACHED.names))
    }

    // prohibition to play online
    return null
}

export async function getRandomBirds(hash: string, count: number): Promise<IBirds> {

    const birds = _CACHED.birds.get(hash)

    if (birds && birds.length) {
        return Array(count).fill(null).map(() => birds[randomBetween(0, birds.length - 1)])
    }

    return null

}

export function getRandomName(): string {
    return randomUniq(_CACHED.names, 'getRandomName')
}
