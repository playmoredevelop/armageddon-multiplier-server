import { Schema, type, MapSchema, ArraySchema } from '@colyseus/schema'
import { TeamState } from "./team.state"
import { randomFrom } from '../utils'

export class RoomState extends Schema {

    @type(["string"]) public teamOrder = new ArraySchema<string>()
    @type('number') public activePlayer: number = 0 // current team
    @type('number') public maxClients: number = 0
    @type('number') public level: number // map BasicRoom.EMapName
    @type('number') public roundTimeInterval = 20 * 1000
    @type('number') public roundTimeStart = 10 * 1000

    @type({ map: TeamState }) public teams = new MapSchema<TeamState>()

    public addTeam(sessionId: string, team: TeamState): void {
        this.teams.set(sessionId, team)
        this.teamOrder.push(sessionId)
    }

    public removeTeam(sessionId: string): boolean {
        if (this.teams.has(sessionId)) {
            const index = this.teamOrder.indexOf(sessionId)
            this.teams.get(sessionId).dispose()
            this.teams.delete(sessionId)
            index >= 0 && this.teamOrder.splice(index, 1)
            return true
        }
        return false
    }

    public getWinner(): string {

        if (this.teams.size === 1 && this.teamOrder.length === 1) {
            return this.teamOrder.shift()
        }

        let needAgain = false

        this.teamOrder.forEach(s => {
            const summ = this.teams.get(s).birds.map(b => b.health).reduce((p,c) => p + c)
            if (summ <= 0) {
                this.removeTeam(s)
                needAgain = true
            }
        })

        if (needAgain) return this.getWinner()

        return null
    }

    public isActiveSession(sessionId: string): boolean {
        return this.teams.has(sessionId) && (this.activeSessionID() === sessionId)
    }

    public isAllowedSession(sessionId: string): boolean {
        return this.teams.has(sessionId) && (this.teams.get(sessionId).allowed === true)
    }

    public isAlive(): boolean {
        return this.teams.size === this.maxClients
    }

    public existsAlive(): boolean {
        for (const v of this.teams.values()) {
            if (v.isAlive()) return true
        }
        return false
    }

    public activeSessionID(): string {
        return this.teamOrder[this.activePlayer]
    }

    public randomSessionID(): string {
        return randomFrom(this.teamOrder)
    }

    public activeTeam(): TeamState {
        return this.teams.get(this.activeSessionID())
    }

    public nextTeam(): TeamState {
        this.activePlayer++
        if (!this.existsAlive()) return null
        if (this.activePlayer > this.teamOrder.length - 1) this.activePlayer = 0
        return this.activeTeam()
    }
}