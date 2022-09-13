import { Schema, type } from '@colyseus/schema'
import { IBird } from '../interfaces'
import { MoveState } from './move.state'

export type BirdMovePacket = {
    order: number
    walk: number
    jump: number
    aim: number
}

export type BirdPositionPacket = {
    angle: number
    vx: number
    vy: number
    x: number
    y: number
}

export type BirdCorrectionPacket = BirdMovePacket & BirdPositionPacket

export class BirdState extends Schema implements IBird {
    
    // bird data
    @type('string') public bio: string
    @type('string') public birdId: string
    @type('number') public birdType: number
    @type('string') public name: string
    @type('string') public skin: string // = JSON.stringify({})
    @type('string') public spawn: string // = JSON.stringify({x,y})
    @type('boolean') public isDead = false
    
    // packet
    @type('uint16') public health: number = 100
    @type('uint16') public damage: number = 0
    @type(MoveState) public move = new MoveState

    public available(): boolean {

        if (this.isDead) return false
        if (this.health <= 0) return false
        if (this.damage >= this.health) return false

        return true
    }

    public hit(value: number): boolean {

        if (! this.available()) return false

        this.damage = value

        if (value < this.health) {
            this.health -= value
        } else {
            this.health = 0
            this.isDead = true
        }

        return true
    }

    public walk(message: BirdCorrectionPacket): boolean {

        if (! this.available()) return false
        
        const { x, y, vx, vy, walk } = message
        
        if (walk === this.move.walk) return false
        if (walk !== 0) this.move.direction = walk

        this.move.walk = walk
        this.move.x = x
        this.move.y = y
        this.move.vx = vx
        this.move.vy = vy

        return true
    }

    public jump(message: BirdCorrectionPacket): boolean {

        if (! this.available()) return false

        const { x, y, jump } = message

        if (jump === this.move.jump) return false

        this.move.jump = jump // direction
        this.move.x = x // from x
        this.move.y = y // from y

        return true
    }

    public aim(message: BirdCorrectionPacket): boolean {

        if (! this.available()) return false

        const { aim, angle } = message

        this.move.aim = aim
        this.move.angle = angle // angle correction

        return true

    }

}