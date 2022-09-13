import { Schema, type, ArraySchema } from '@colyseus/schema'
import { BirdPositionPacket, BirdState } from './bird.state'
import { WeaponsState } from './weapons.state'

export type DefferedDamagePacket = {
    sessionId: string
    order: number
    damage: number
}

export type WeaponStatePacket = {
    index: number
    state: number
}

export type WeaponExplosionArgs = [
    { x: number, y: number },
    number,
    number,
    number,
    number,
    string
]

export type WeaponExposionPacket = {
    args: WeaponExplosionArgs,
    positions: { [key: string]: Array<BirdPositionPacket> }
}

export class TeamState extends Schema { // Player

    public allowed: boolean = true

    // hits confirmed by this team
    public hits: Array<Array<DefferedDamagePacket>> = []
    
    // explosions confirmed by this team
    public explosions: Array<WeaponExposionPacket> = []

    @type('string') public name: string
    @type('string') public color: string
    @type('number') public points = 0
    @type('number') public activeBird = 0 // current bird id
    @type('boolean') public readynext = false

    @type([BirdState]) public birds = new ArraySchema<BirdState>()
    @type(WeaponsState) public weapons = new WeaponsState()

    public isAlive(): boolean {
        for (const v of this.birds.values()) {
            if (!v.isDead) return true
        }
        return false
    }

    public currentBird(aliveOnly: boolean): BirdState {
        const bird = this.birds[this.activeBird]
        if (aliveOnly && bird.isDead) return null
        return bird
    }

    public nextBird(): BirdState {
        this.activeBird++
        if (!this.isAlive()) return null
        if (this.activeBird > this.birds.length - 1) this.activeBird = 0
        if (this.birds[this.activeBird].isDead) return this.nextBird()
        return this.birds[this.activeBird]
    }

    public updatePoints(): void {
        this.points = this.birds.map(bird => bird.health).reduce((a, b) => a + b)
    }

    public dispose(): void {
        this.points = 0
        this.birds = null
        this.weapons = null
        this.hits = null
        this.explosions = null
    }

}