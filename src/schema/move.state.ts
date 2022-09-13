import { Schema, type } from '@colyseus/schema'
import { BirdCorrectionPacket } from './bird.state'

export class MoveState extends Schema implements Omit<BirdCorrectionPacket, 'order'> {

    @type('number') public x: number
    @type('number') public y: number
    @type('number') public vx: number
    @type('number') public vy: number
    @type('number') public direction: number = 1
    @type('number') public walk: number = 0 // [-1,1,0] -> [left, right, stop]
    @type('number') public jump: number = 0 // [-1,1,0] -> [backflip, jump, stop]
    @type('number') public aim: number = 0 // [-1,1,0] => [up, down, stop]
    @type('number') public angle: number = null

    public reset(): void {

        this.walk = 0
        this.jump = 0
        this.aim = 0
    }

}