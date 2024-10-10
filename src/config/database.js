const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');

let db;

const initializeDatabase = () => {
  return new Promise((resolve, reject) => {
    const dbPath = path.join(process.cwd(), 'src', 'db', 'database.sqlite');
    
    logger.info(`Attempting to create/open database at: ${dbPath}`);

    const dbDir = path.dirname(dbPath);
    if (!fs.existsSync(dbDir)) {
      logger.info(`Creating directory: ${dbDir}`);
      fs.mkdirSync(dbDir, { recursive: true });
    }

    db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
      if (err) {
        logger.error('Error connecting to the database:', err);
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
};

const createTables = () => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // Create Vehicles table
      db.run(`CREATE TABLE IF NOT EXISTS Vehicles (
        vehicle_id TEXT PRIMARY KEY,
        license_plate TEXT UNIQUE,
        owner_name TEXT,
        contact_info TEXT
      )`, (err) => {
        if (err) reject(err);
      });

      // Create Users table
      db.run(`CREATE TABLE IF NOT EXISTS Users (
        user_id TEXT PRIMARY KEY,
        user_name TEXT UNIQUE,
        contact_info TEXT,
        role TEXT CHECK(role IN ('Technician', 'Manager', 'Customer Service', 'Admin')),
        specialization TEXT,
        password TEXT
      )`, (err) => {
        if (err) reject(err);
      });

      // Create VehicleStatus table
      db.run(`CREATE TABLE IF NOT EXISTS VehicleStatus (
        status_id TEXT PRIMARY KEY,
        vehicle_id TEXT,
        status_type TEXT CHECK(status_type IN ('entry_diagnostic', 'exit_repair')),
        status_date DATE DEFAULT CURRENT_TIMESTAMP,
        details TEXT,
        severity_level INTEGER,
        repair_status TEXT,
        cost DECIMAL(10, 2),
        technician_id TEXT,
        FOREIGN KEY (vehicle_id) REFERENCES Vehicles(vehicle_id),
        FOREIGN KEY (technician_id) REFERENCES Users(user_id)
      )`, (err) => {
        if (err) reject(err);
      });

      // Create VehicleChangeHistory table
      db.run(`CREATE TABLE IF NOT EXISTS VehicleChangeHistory (
        change_id TEXT PRIMARY KEY,
        vehicle_id TEXT,
        change_type TEXT,
        change_date DATE DEFAULT CURRENT_TIMESTAMP,
        details TEXT,
        old_status TEXT,
        new_status TEXT,
        technician_id TEXT,
        FOREIGN KEY (vehicle_id) REFERENCES Vehicles(vehicle_id),
        FOREIGN KEY (technician_id) REFERENCES Users(user_id)
      )`, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  });
};

const createDefaultUser = async () => {
  const defaultUsername = 'admin';
  const defaultPassword = 'password123';
  const hashedPassword = await bcrypt.hash(defaultPassword, 10);

  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM Users WHERE user_name = ?', [defaultUsername], (err, row) => {
      if (err) {
        reject(err);
      } else if (row) {
        logger.info('Default user already exists');
        resolve();
      } else {
        const userId = uuidv4();
        db.run('INSERT INTO Users (user_id, user_name, contact_info, role, password) VALUES (?, ?, ?, ?, ?)', 
          [userId, defaultUsername, 'admin@example.com', 'Admin', hashedPassword], 
          (err) => {
            if (err) {
              reject(err);
            } else {
              logger.info('Default user created');
              resolve();
            }
          }
        );
      }
    });
  });
};

const getDatabase = () => {
  if (!db) {
    throw new Error('Database not initialized. Call initializeDatabase first.');
  }
  return db;
};

// Utility functions for each table

const addVehicle = (licensePlate, ownerName, contactInfo) => {
  return new Promise((resolve, reject) => {
    const vehicleId = uuidv4();
    db.run('INSERT INTO Vehicles (vehicle_id, license_plate, owner_name, contact_info) VALUES (?, ?, ?, ?)',
      [vehicleId, licensePlate, ownerName, contactInfo],
      (err) => {
        if (err) reject(err);
        else resolve(vehicleId);
      }
    );
  });
};

const addUser = (userName, contactInfo, role, specialization, password) => {
  return new Promise(async (resolve, reject) => {
    const userId = uuidv4();
    const hashedPassword = await bcrypt.hash(password, 10);
    db.run('INSERT INTO Users (user_id, user_name, contact_info, role, specialization, password) VALUES (?, ?, ?, ?, ?, ?)',
      [userId, userName, contactInfo, role, specialization, hashedPassword],
      (err) => {
        if (err) reject(err);
        else resolve(userId);
      }
    );
  });
};

const addVehicleStatus = (vehicleId, statusType, details, severityLevel, repairStatus, cost, technicianId) => {
  return new Promise((resolve, reject) => {
    const statusId = uuidv4();
    db.run('INSERT INTO VehicleStatus (status_id, vehicle_id, status_type, details, severity_level, repair_status, cost, technician_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [statusId, vehicleId, statusType, details, severityLevel, repairStatus, cost, technicianId],
      (err) => {
        if (err) reject(err);
        else resolve(statusId);
      }
    );
  });
};

const addVehicleChangeHistory = (vehicleId, changeType, details, oldStatus, newStatus, technicianId) => {
  return new Promise((resolve, reject) => {
    const changeId = uuidv4();
    db.run('INSERT INTO VehicleChangeHistory (change_id, vehicle_id, change_type, details, old_status, new_status, technician_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [changeId, vehicleId, changeType, details, oldStatus, newStatus, technicianId],
      (err) => {
        if (err) reject(err);
        else resolve(changeId);
      }
    );
  });
};

module.exports = {
  initializeDatabase,
  getDatabase,
  addVehicle,
  addUser,
  addVehicleStatus,
  addVehicleChangeHistory
};