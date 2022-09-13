import { Client, Delayed, Room } from "@colyseus/core";

import { logger } from "../logger";
import { randomFrom, randomUniq } from "../utils";
import { getRandomBirds, getRandomName } from "../cache";

import { RoomState } from "../schema/room.state";
import { DefferedDamagePacket, TeamState, WeaponExposionPacket } from "../schema/team.state";
import { BirdCorrectionPacket, BirdPositionPacket, BirdState } from "../schema/bird.state";
import { WeaponFirePacket, WeaponSelectedPacket } from "../schema/weapons.state";

import maps from '../default.maps.json' // import json on the nodejs 18+ version

type TOptions = {
    session: string
}

export enum EMapIndex {
    basic,
    MapGarden
}

export const EMapData = [
    maps.basic,
    maps.MapGarden
]

export class BasicRoom extends Room<RoomState> {

    private $hits: Map<string, [number, DefferedDamagePacket]> = new Map() // hit hash -> [same count, message]
    private $explosions: Map<string, [number, WeaponExposionPacket]> = new Map() // explosion hash -> [same count, message]

    public roomName = 'basic'
    public maxClients = 2
    public autoDispose = true
    public patchRate = parseFloat(process.env.SERVER_TICKRATE_MS) | 50

    protected _colors = ["#08c56a", "#9ec508", "#06c5a3", "#258edb", "#a21ad9", "#d727a0"]
    protected _birdsPerClient = 2
    protected _roundIndex = 1
    protected _roundTimer: Delayed
    protected _roundTimeInterval = 20 * 1000
    protected _roundTimeStart = 10 * 1000
    protected _winner: string = null // sess winner

    async onCreate() {

        this.setState(new RoomState)

        this.state.maxClients = this.maxClients
        this.state.activePlayer = 0
        this.state.level = randomFrom([0, 1])
        this.state.roundTimeInterval = this._roundTimeInterval
        this.state.roundTimeStart = this._roundTimeStart

        this.onMessage('bird', this.onBirdMessage.bind(this))
        this.onMessage('bird.hit', this.onHit.bind(this))
        this.onMessage('w.selected', this.onWeaponSelected.bind(this))
        this.onMessage('w.fire', this.onWeaponFire.bind(this))
        this.onMessage('w.explosion', this.onWeaponExplosion.bind(this))
        this.onMessage('ready.next', this.onReadyNext.bind(this))

        this._roundTimer = this.clock.setInterval(
            () => this.turnNextRound(),
            this.state.roundTimeInterval
        )
        this._roundTimer.pause()

        logger.info({ room: this.roomId, state: this.state }, 'ROOM CREATED')

    }

    async onAuth(client: Client, options?: TOptions, req?) {
        // return this.state.isActiveSession(client.sessionId)
        return true
    }

    async onJoin?(client: Client, options?: TOptions, auth?: any): Promise<boolean> {

        if (this.state.isAlive()) return false

        if (options.session) {

            const birds = await getRandomBirds(options.session, this._birdsPerClient)

            if (birds && birds.length === this._birdsPerClient) {

                const team = new TeamState

                // colors and birds
                team.color = randomUniq(this._colors, this.roomId + 'color')
                team.birds.clear()
                team.birds.push(...birds.map(one => {
                    const bird = new BirdState
                    bird.birdType = one.birdType
                    bird.name = one.name || getRandomName()
                    bird.skin = JSON.stringify(one.attributes)
                    // select an unoccupied spawn point, assign coordinates
                    bird.spawn = JSON.stringify(randomUniq(EMapData[this.state.level].spawnPionts, this.roomId + 'spawn'))
                    return bird
                }))

                // set weapon list
                team.weapons.setWeaponsMap()

                logger.info({ room: this.roomId, socket: client.sessionId }, 'JOIN')

                this.state.addTeam(client.sessionId, team)
                this.state.isAlive() && this.onReady() // start room

                return true
            }
        }

        return false
    }

    async onLeave(client: Client): Promise<void> {

        logger.info({ room: this.roomId, socket: client.sessionId }, 'LEAVE')

        this.state.removeTeam(client.sessionId)
        client.leave()

        this.broadcast('room.leave', client.sessionId)

        if (!this.locked) return
        if (this.existsWinner()) return

        // if an active player left, then we move to next round
        if (this.state.isActiveSession(client.sessionId)) {
            this._roundTimer.reset()
            this.turnNextRound()
        }

    }

    async onDispose(): Promise<void> {

        logger.info({ room: this.roomId, active: this.state.teams.size }, 'DISPOSE')

        this.clock.clear()
        this.state.teams.forEach(teamstate => teamstate.birds.clear())
        this.state.teams.clear()

        this.broadcast('room.dispose')
    }

    /**
     * walk left, right, stay
     * jump forward, backflip
     * aim up, down
     */
    protected onBirdMessage(client: Client, message: BirdCorrectionPacket) {

        logger.debug({ room: this.roomId, socket: client.sessionId, message }, 'BIRD MESSAGE')

        if (!this.state.isActiveSession(client.sessionId)) return

        const bird = this.state.activeTeam().currentBird(true)
        const changed = bird && [
            bird.walk(message),
            bird.jump(message),
            bird.aim(message)
        ].some(v => v === true)

        changed && this.broadcastPatch()
    }

    // w.selected
    protected onWeaponSelected(client: Client, message: WeaponSelectedPacket) {

        logger.debug({ room: this.roomId, socket: client.sessionId, message }, 'SELECT WEAPON')

        if (!this.state.isActiveSession(client.sessionId)) return
        if (!this.state.isAllowedSession(client.sessionId)) return

        const team = this.state.teams.get(client.sessionId)
        team.weapons.select(message.select)

        this.broadcastPatch()
    }

    protected onWeaponFire(client: Client, message: BirdPositionPacket & WeaponFirePacket) {

        logger.debug({ room: this.roomId, socket: client.sessionId, message }, 'FIRE')

        if (!this.state.isActiveSession(client.sessionId)) return
        if (!this.state.isAllowedSession(client.sessionId)) return

        const { x, y, angle, impulse } = message
        const team = this.state.teams.get(client.sessionId)
        const bird = team.currentBird(true)

        if (!bird) {
            logger.error({ room: this.roomId, socket: client.sessionId, bird }, 'BIRD IS DEAD')
            return
        }

        bird.move.x = x
        bird.move.y = y
        bird.move.angle = angle

        if (team.weapons.fire(impulse)) {
            // give another 20 seconds for an agreed transition
            this._roundTimer.reset()
            team.allowed = team.weapons.allowOff.includes(team.weapons.selectedWeapon)
        }

        logger.debug({
            room: this.roomId,
            socket: client.sessionId,
            selected: team.weapons.selectedWeapon,
            ammo: team.weapons.current.ammo,
            status: team.weapons.status
        }, 'WEAPON STATE')

        this.broadcastPatch()
    }

    protected onWeaponExplosion(client: Client, message: WeaponExposionPacket) {

        if (!this.state.isAlive()) return
        if (!this.state.teams.has(client.sessionId)) return

        logger.debug({ room: this.roomId, socket: client.sessionId, message }, 'onWeaponExplosion')

        const hash = [
            Math.ceil((message.args[0].x + message.args[0].y) / 10) * 10,
            message.args[1],
            message.args[2]
        ].join('-')

        this.$explosions.has(hash) === false && this.$explosions.set(hash, [0, message])
        this.$explosions.get(hash)[0] += 1

        let selected = client.sessionId === this.state.randomSessionID() && this.$explosions.get(hash)[0] > 0

        if (selected || this.$explosions.get(hash)[0] >= this.maxClients) {

            logger.info({ room: this.roomId, socket: client.sessionId, hash, selected }, 'onWeaponExplosion APPLY')

            this.$explosions.get(hash)[0] = -999

            const team = this.state.teams.get(client.sessionId)

            // correction of the birds' position before the explosion
            for (const t in message.positions) {
                let team = this.state.teams.get(t)
                message.positions[t].map((bpos, order) => {
                    team.birds[order].move.x = bpos.x
                    team.birds[order].move.y = bpos.y
                    team.birds[order].move.vx = bpos.vx
                    team.birds[order].move.vy = bpos.vy
                })
            }

            this.broadcastPatch()

            team.explosions.push(message)

            this.broadcast('w.explosion', message.args)

        }

    }

    protected onHit(client: Client, message: Array<DefferedDamagePacket>) {

        if (!this.state.isAlive()) return
        if (!this.state.teams.has(client.sessionId)) return
        if (!message.length) return

        logger.debug({ room: this.roomId, socket: client.sessionId, message }, 'onHit')
        let isapply = false

        for (const hit of message) {

            if (!this.state.teams.has(hit.sessionId)) continue

            const hash = [hit.sessionId, hit.order, hit.damage].join('-')
            this.$hits.has(hash) === false && this.$hits.set(hash, [0, hit])
            this.$hits.get(hash)[0] += 1

            let selected = client.sessionId === this.state.randomSessionID() && this.$hits.get(hash)[0] > 0

            if (selected || this.$hits.get(hash)[0] >= this.maxClients) {

                logger.info({ room: this.roomId, socket: client.sessionId, hash, selected, $hits: this.$hits.get(hash) }, 'onHit APPLY')

                this.$hits.get(hash)[0] = -999

                const team = this.state.teams.get(hit.sessionId)
                const bird = team.birds[hit.order]

                // if the current active bird has received damage, we close the processing of messages from the client before the transition
                if (bird && team.currentBird(false) === bird) team.allowed = false
                if (bird) bird.hit(hit.damage)
                isapply = true

                team.hits.push(message)

            } continue
        }

        if (isapply) {
            this.broadcastPatch()
            for (const [_, tstate] of this.state.teams) {
                for (const bstate of tstate.birds) bstate.damage = 0
            }
        }
    }

    protected onReadyNext(client: Client, message: { [key: string]: Array<BirdPositionPacket> }) {

        if (!this.state.isAlive()) return
        if (!this.state.teams.has(client.sessionId)) return

        const team = this.state.teams.get(client.sessionId)
        const all = Array.from(this.state.teams.values())
        team.readynext = true

        if (all.every(t => t.readynext)) {

            all.map(teamstate => teamstate.readynext = false)
            this._roundTimer.reset()
            
            logger.debug(message, client.sessionId)
            
            // correction of bird positions by random command
            for (const t in message) {
                let team = this.state.teams.get(t)
                message[t].map((bpos, order) => {
                    team.birds[order].move.x = bpos.x
                    team.birds[order].move.y = bpos.y
                    team.birds[order].move.vx = bpos.vx
                    team.birds[order].move.vy = bpos.vy
                })
            }
            
            this.broadcastPatch()
            this.clock.setTimeout(() => this.turnNextRound(), 2000)

        }
    }

    protected onReady(): void {

        logger.info({ room: this.roomId }, 'READY TO PLAY')

        this.lock()

        this.clock.setTimeout(() => {
            this._roundTimer.resume()
        }, this.state.roundTimeStart)

        this.clock.start()

    }

    protected turnNextRound(): void {

        if (this.state.teamOrder.length <= 0) return
        if (this.existsWinner()) return

        logger.info({ room: this.roomId, current: this.state.activeSessionID() }, 'NEXT TURN')

        this._roundIndex++

        this.state.nextTeam()
        this.state.activeTeam().nextBird()
        this.state.teams.forEach(teamstate => {
            teamstate.allowed = true
            teamstate.readynext = false
            teamstate.weapons.deactivate()
            teamstate.birds.forEach(b => b.move.reset())
        })

        this.$hits.clear()
        this.$explosions.clear()
        this.broadcast('next.turn', {
            ap: this.state.activePlayer,
            ab: this.state.activeTeam().activeBird
        })
    }

    protected existsWinner(): boolean {

        this._winner = this.state.getWinner()

        if (null !== this._winner) {
            this.broadcast('room.winner', this._winner)
            this._roundTimer.pause()
            return true
        }

        return false
    }

}
