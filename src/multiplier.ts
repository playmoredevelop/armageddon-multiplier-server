import e from 'express'
import http from 'http'
import axios from 'axios'
import terminus from '@godaddy/terminus'

import { config } from 'dotenv'
import { createHmac, randomUUID } from 'crypto'
import { Presence, RegisteredHandler, Server } from '@colyseus/core'
import { WebSocketTransport } from '@colyseus/ws-transport'
import { RedisPresence } from '@colyseus/redis-presence'
import { monitor } from '@colyseus/monitor'

import { logger } from './logger'
import { cacheBirds } from './cache'

config()

import { BasicRoom } from './rooms/BasicRoom'
import { OneOnOneRoom } from './rooms/1on1Room'
import { TwoOnTwoRoom } from './rooms/2on2Room'
import { IBird, IErrorResponse, IGetSessionResponse } from './interfaces'

export const {
    SERVER_HOST,
    SERVER_PORT,
    SERVER_ROUND_TIME_SEC,
    SERVER_BIRDS_CHUNK,
    FRONTEND_HOST,
    BACKEND_HOST,
    REDIS_HOST,
    REDIS_PORT,
    TEST_SIGNATURE
} = process.env

export class Multiplier extends Server {
    
    protected rooms: Map<string, RegisteredHandler>
    protected application: e.Express = e()
    protected http: http.Server = http.createServer(this.application)
    protected terminus = terminus.createTerminus(this.http, {
        signal: 'SIGINT',
        healthChecks: { '/health': this.onHealth },
        logger: (message, error) => logger.info('SIGINT', message, error)
    })

    constructor(rooms: Array<[string, typeof BasicRoom]>) {

        super()

        this.attach({
            gracefullyShutdown: false,
            transport: new WebSocketTransport({ server: this.http }),
            presence: REDIS_HOST && REDIS_PORT ? (new RedisPresence({
                host: REDIS_HOST,
                port: Number(REDIS_PORT)
            }) as Presence) : null
        })
        
        // basic routes
        this.application.use(e.json())
        this.application.get('/session', this.getIndex.bind(this))
        this.application.post('/session', this.postIndex.bind(this))
        this.application.use('/monitor', monitor())

        // define rooms
        this.rooms = new Map(rooms.map(([name, symclass]) => {
            return [name, this.define(name, symclass)]
        }))

    }

    public start(host: string, port: number): void {

        this.http.on('listening', () => logger.info(`Server is running. On the air: ${host}:${port}`))
        this.http.on('error', e => logger.error(e))
        this.http.listen(port, host)

        process.on('SIGTERM', () => {
            this.gracefullyShutdown(true)
            this.http.close(() => logger.warn('Server closed'))
        })

    }

    async getIndex(req: e.Request, res: e.Response) {

        if (TEST_SIGNATURE && TEST_SIGNATURE.length) { // auto dev sessions

            const headers = { signature: TEST_SIGNATURE }
            const uuid = randomUUID()
            const hash = createHmac('sha256', TEST_SIGNATURE).update(uuid).digest('hex')

            const response = await axios.get(BACKEND_HOST + '/birds', { headers })
            const birds = response.data.data as Array<IBird>

            await cacheBirds(hash, birds, parseInt(SERVER_BIRDS_CHUNK)) 

            const redirect = `${FRONTEND_HOST}/?session=${hash}&uuid=${uuid}`
            logger.warn({ hash }, 'Test session')

            return res.redirect(302, redirect)
        }

        res.status(404)
        res.send('404')
    }

    // - хэш сессии по сигнатуре, выбранным птицам
    async postIndex(req: e.Request, res: e.Response): Promise <e.Response<IGetSessionResponse | IErrorResponse>> {

        const signature = req.headers.signature as string
        const headers = { signature }

        try {

            if (String(signature).length < 100) throw 1001

            const uuid = randomUUID()
            const hash = createHmac('sha256', signature).update(uuid).digest('hex')

            const response = await axios.get(BACKEND_HOST + '/birds', { headers })
            const birds = response.data.data as Array<IBird>

            await cacheBirds(hash, birds, parseInt(SERVER_BIRDS_CHUNK))

            logger.info({ hash }, 'New session')

            return res.json({
                session: hash,
                iframe: `${FRONTEND_HOST}/?session=${hash}&uuid=${uuid}`
            })

        } catch (code) {

            switch (code) {
                case 1001: logger.warn({ code, signature }, 'Invalid signature')
            }

            switch (code) {
                case 1001: return res.json({ code, error: 'Invalid signature' })
            }

            return res.json({ code: 0, error: 'Server error' })
        }
    }

    async onHealth() {
        return true
    }

}

new Multiplier([
    ['1on1', OneOnOneRoom],
    ['2on2', TwoOnTwoRoom]
]).start(SERVER_HOST, Number(SERVER_PORT))
