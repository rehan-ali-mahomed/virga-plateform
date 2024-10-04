const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');
const bcrypt = require('bcrypt');

let db;

function initializeDatabase() {
  return new Promise((resolve, reject) => {
    const dbPath = path.join(__dirname, '..', '..', 'database.sqlite');
    
    logger.info(`Attempting to create/open database at: ${dbPath}`);

    // Check if the directory exists, if not create it
    const dbDir = path.dirname(dbPath);
    if (!fs.existsSync(dbDir)) {
      logger.info(`Creating directory: ${dbDir}`);
      fs.mkdirSync(dbDir, { recursive: true });
    }

    db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
      if (err) {
        logger.error('Error connecting to the database:', err);
        logger.error('Current working directory:', process.cwd());
        logger.error('__dirname:', __dirname);
        reject(err);
      } else {
        logger.info(`Connected to the database at ${dbPath}`);
        createTables()
          .then(() => createDefaultUser())
          .then(resolve)
          .catch(reject);
      }
    });
  });
}

function createTables() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // Create users table
      db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        password TEXT
      )`, (err) => {
        if (err) reject(err);
      });

      // Create inspection_reports table
      db.run(`CREATE TABLE IF NOT EXISTS inspection_reports (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT,
        client_name TEXT,
        client_phone TEXT,
        vehicle_registration TEXT,
        vehicle_make TEXT,
        vehicle_model TEXT,
        mileage INTEGER,
        next_inspection_date TEXT,
        interior TEXT,
        engine TEXT,
        front TEXT,
        rear TEXT,
        accessories TEXT,
        comments TEXT,
        revision_oil_type TEXT,
        revision_torque TEXT,
        revision_oil_volume TEXT,
        brake_disc_thickness_front TEXT,
        brake_disc_thickness_rear TEXT,
        work_completed TEXT
      )`, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  });
}

async function createDefaultUser() {
  const defaultUsername = 'admin';
  const defaultPassword = 'password123';
  const hashedPassword = await bcrypt.hash(defaultPassword, 10);

  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM users WHERE username = ?', [defaultUsername], (err, row) => {
      if (err) {
        reject(err);
      } else if (row) {
        logger.info('Default user already exists');
        resolve();
      } else {
        db.run('INSERT INTO users (username, password) VALUES (?, ?)', [defaultUsername, hashedPassword], (err) => {
          if (err) {
            reject(err);
          } else {
            logger.info('Default user created');
            resolve();
          }
        });
      }
    });
  });
}

function getDatabase() {
  if (!db) {
    throw new Error('Database not initialized. Call initializeDatabase first.');
  }
  return db;
}

module.exports = {
  initializeDatabase,
  getDatabase
};
