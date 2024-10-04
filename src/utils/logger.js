const fs = require('fs');
const path = require('path');

const logFile = path.join(__dirname, '..', '..', 'logs', 'app.log');

function ensureLogDirectoryExists() {
  const logDir = path.dirname(logFile);
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
}

function log(level, message) {
  ensureLogDirectoryExists();
  const timestamp = new Date().toISOString();
  const logMessage = `${timestamp} [${level}] ${message}\n`;
  fs.appendFileSync(logFile, logMessage);
  console.log(logMessage); // Also log to console for immediate feedback
}


module.exports = {
  info: (message) => log('INFO', message),
  warn: (message) => log('WARN', message),
  error: (message) => log('ERROR', message),
  debug: (message) => log('DEBUG', message),
};