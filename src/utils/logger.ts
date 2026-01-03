import winston from 'winston';
import chalk from 'chalk';

const logFormat = winston.format.printf(({ level, message }) => {
    let colorizedLevel = level;
    switch (level) {
        case 'info':
            colorizedLevel = chalk.blue(level.toUpperCase());
            break;
        case 'error':
            colorizedLevel = chalk.red(level.toUpperCase());
            break;
        case 'warn':
            colorizedLevel = chalk.yellow(level.toUpperCase());
            break;
        case 'success': // Custom level if needed, or just map info
            colorizedLevel = chalk.green('SUCCESS');
            break;
    }
    return `${colorizedLevel}: ${message}`;
});

export const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.simple(),
        logFormat
    ),
    transports: [
        new winston.transports.Console()
    ]
});

export const log = {
    info: (msg: string) => logger.info(msg),
    warn: (msg: string) => logger.warn(msg),
    error: (msg: string) => logger.error(msg),
    success: (msg: string) => console.log(`${chalk.green('SUCCESS')}: ${msg}`) // Winston doesn't have success by default easily without custom levels
};
