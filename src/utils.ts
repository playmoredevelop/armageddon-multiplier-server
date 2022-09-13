import { IBird } from "./interfaces";

export function randomBetween(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min
}

export function randomFrom<T>(values: Array <T>) {
    return values[randomBetween(0, values.length - 1)]
}

export function randomRange(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min
}

export function randomSkin(names: Array <string>): IBird {

    return {
        birdType: 0,
        name: randomUniq(names, 'randomBirdSkin'),
        attributes: {
            body: { display: randomFrom(['Banana', 'Beast', 'Black', 'Brock', 'Electro', 'Ferro', 'Gold']) },
            eyes: { display: randomFrom(['Aqua Prince', 'Banana', 'Bloso', 'Brock', 'Gold', 'LootSquad']) },
            accessory: { display: randomFrom(['Aubergi', 'Bloso', 'Fluxred', 'Merit Circle', 'Polemos', 'Skeletony']) },
            beak: { display: randomFrom(['Amphibian', 'Aubergi', 'Bloso', 'Frima', 'Peacock', 'Santa']) },
            head: { display: randomFrom(['BAYZ', 'BreederDAO', 'Elvis', 'Gayra', 'Mr. Frog', 'Polemos', 'Shade']) },
            wings: { display: randomFrom(['Aqua Prince', 'Banana', 'Cyborg', 'Dreamy', 'Felipe', 'Gold', 'Merit Circle']) },
        }
    }
}

const uniqmap: Map<string, Array<unknown>> = new Map
export function randomUniq<T>(values: Array <T>, key: string): T {

    if (uniqmap.has(key)) {

        const cached = uniqmap.get(key) as Array <T>
        const randomId = randomBetween(0, cached.length - 1)
        const value = cached[randomId]
        cached.splice(randomId, 1)
        cached.length === 0 && uniqmap.delete(key)
        return value
    }

    uniqmap.set(key, values.slice())
    return randomUniq(values, key)
}

export function isBetweenRange(value: number, rangeMax: number, rangeMin: number) {
    return value >= rangeMin && value <= rangeMax;
}