import { pino } from 'pino'

export const logger = pino({
    enabled: true,
    level: 'info'
})

console.log = f => { logger.info(f) }
console.error = e => { logger.error(e, 'error') }
