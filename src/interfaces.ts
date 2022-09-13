export interface IBird {
    _id?: string
    bio?: string
    birdId?: string
    isEgg?: boolean
    birdType: number
    name: string
    skin?: string // JSON attributes
    attributes?: {
        accessory?: IBirdAttribute
        beak: IBirdAttribute
        background?: IBirdAttribute
        body: IBirdAttribute
        eyes: IBirdAttribute
        head?: IBirdAttribute
        mutation?: IBirdAttribute
        wings: IBirdAttribute
    }
}

export enum ETypeEggByParents {
    Regular = 0,
    Mutated = 1,
    DoubleMutated = 2,
    Legendary = 3,
    DoubleLegendary = 4,
    LegendaryMutated = 5,
    LegendaryDoubleMutated = 6,
    DoubleLegendaryMutated = 7,
    DoubleLegendaryDoubleMutated = 8,
    Collaboration = 9,
}

export interface IBirdAttribute {
    technical?: string
    display: string
}

export interface IGetSessionResponse {
    session: string,
    iframe: string
}

export interface IErrorResponse {
    code: number,
    error: string
}