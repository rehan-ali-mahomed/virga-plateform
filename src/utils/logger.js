const winston = require('winston');
require('dotenv').config();

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json(),
    winston.format.printf(({ timestamp, level, message, ...metadata }) => {
      const meta = Object.keys(metadata).length ? 
        `\n${JSON.stringify(metadata, null, 2)}` : '';
      return `${timestamp} ${level}: ${message}${meta}`;
    })
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'src/logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'src/logs/combined.log' }),
  ],
});

// Temporarily set to debug level to see all logs
logger.level = process.env.LOG_LEVEL || 'debug';

module.exports = logger;