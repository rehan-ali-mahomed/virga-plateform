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
          .then(() => seedInspectionItems())
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

      // Create InspectionItems table
      db.run(`CREATE TABLE IF NOT EXISTS InspectionItems (
        item_id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT CHECK(type IN ('checkbox', 'text', 'number', 'select')) NOT NULL,
        category TEXT CHECK(category IN ('interior', 'engine', 'front', 'rear', 'accessories', 'work_completed')) NOT NULL,
        is_active BOOLEAN DEFAULT true,
        description TEXT,
        options TEXT,
        display_order INTEGER
      )`, (err) => {
        if (err) reject(err);
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

const addVehicleStatus = (vehicleId, statusType, details, severityLevel, repairStatus, technicianId) => {
  return new Promise((resolve, reject) => {
    const statusId = uuidv4();
    db.run('INSERT INTO VehicleStatus (status_id, vehicle_id, status_type, details, severity_level, repair_status, technician_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [statusId, vehicleId, statusType, details, severityLevel, repairStatus, technicianId],
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

// Add function to seed default inspection items
const seedInspectionItems = () => {
  return new Promise((resolve, reject) => {
    const defaultItems = [
      // Interior items
      { category: 'interior', name: 'Antivol de roue bon état', type: 'checkbox', display_order: 1 },
      { category: 'interior', name: 'Démarreur', type: 'checkbox', display_order: 2 },
      { category: 'interior', name: 'Témoin tableau de bord', type: 'checkbox', display_order: 3 },
      { category: 'interior', name: 'Rétroviseur', type: 'checkbox', display_order: 4 },
      { category: 'interior', name: 'klaxon', type: 'checkbox', display_order: 5 },
      { category: 'interior', name: 'Frein à main', type: 'checkbox', display_order: 6 },
      { category: 'interior', name: 'essuie glace', type: 'checkbox', display_order: 7 },
      { category: 'interior', name: 'Eclairage', type: 'checkbox', display_order: 8 },
      { category: 'interior', name: 'Jeux au volant', type: 'checkbox', display_order: 9 },

      // Engine items
      { category: 'engine', name: 'Teste batterie/alternateur', type: 'checkbox', display_order: 1 },
      { category: 'engine', name: 'Plaque immat AV', type: 'checkbox', display_order: 2 },
      { category: 'engine', name: 'Fuite boite', type: 'checkbox', display_order: 3 },
      { category: 'engine', name: 'Fuite moteur', type: 'checkbox', display_order: 4 },
      { category: 'engine', name: 'supports moteur', type: 'checkbox', display_order: 5 },
      { category: 'engine', name: 'Liquide de frein', type: 'checkbox', display_order: 6 },
      { category: 'engine', name: 'Filtre à air', type: 'checkbox', display_order: 7 },
      { category: 'engine', name: 'Courroie accessoire', type: 'checkbox', display_order: 8 },

      // Front items
      { category: 'front', name: 'Roulement', type: 'checkbox', display_order: 1 },
      { category: 'front', name: 'Pneus avant', type: 'checkbox', display_order: 2 },
      { category: 'front', name: 'Parallélisme', type: 'checkbox', display_order: 3 },
      { category: 'front', name: 'Disque avant', type: 'checkbox', display_order: 4 },
      { category: 'front', name: 'Plaquettes avant', type: 'checkbox', display_order: 5 },
      { category: 'front', name: 'Amortisseur avant', type: 'checkbox', display_order: 6 },
      { category: 'front', name: 'Biellette barre stab', type: 'checkbox', display_order: 7 },
      { category: 'front', name: 'Direction complet', type: 'checkbox', display_order: 8 },
      { category: 'front', name: 'Cardans', type: 'checkbox', display_order: 9 },
      { category: 'front', name: 'Triangles avant', type: 'checkbox', display_order: 10 },
      { category: 'front', name: 'Flexible de frein', type: 'checkbox', display_order: 11 },

      // Rear items
      { category: 'rear', name: 'Pneus AR', type: 'checkbox', display_order: 1 },
      { category: 'rear', name: 'Frein AR', type: 'checkbox', display_order: 2 },
      { category: 'rear', name: 'Roulement AR', type: 'checkbox', display_order: 3 },
      { category: 'rear', name: 'Flexible AR', type: 'checkbox', display_order: 4 },
      { category: 'rear', name: 'Amortisseur AR', type: 'checkbox', display_order: 5 },
      { category: 'rear', name: 'Silent Bloc AR', type: 'checkbox', display_order: 6 },

      // Accessories items
      { category: 'accessories', name: 'Plaque immat AR', type: 'checkbox', display_order: 1 },
      { category: 'accessories', name: 'Antenne radio', type: 'checkbox', display_order: 2 },
      { category: 'accessories', name: 'Roue de secours', type: 'checkbox', display_order: 3 },
      { category: 'accessories', name: 'Gilet/Triangle secu', type: 'checkbox', display_order: 4 },
      { category: 'accessories', name: 'Crique / Clé roue', type: 'checkbox', display_order: 5 },

      // Work completed items
      { category: 'work_completed', name: 'MISE A ZERO VIDANGE', type: 'checkbox', display_order: 1 },
      { category: 'work_completed', name: 'ROUE SERRER AU COUPLE', type: 'checkbox', display_order: 2 },
      { category: 'work_completed', name: 'ETIQUETTE DE VIDANGE', type: 'checkbox', display_order: 3 },
      { category: 'work_completed', name: 'ETIQUETTE DISTRIBUTION', type: 'checkbox', display_order: 4 },
      { category: 'work_completed', name: 'ETIQUETTE PLAQUETTE', type: 'checkbox', display_order: 5 },
      { category: 'work_completed', name: 'PARFUM', type: 'checkbox', display_order: 6 },
      { category: 'work_completed', name: 'NETTOYAGE', type: 'checkbox', display_order: 7 }
    ];

    // First, get all existing items
    db.all('SELECT name, category FROM InspectionItems', [], (err, existingItems) => {
      if (err) {
        reject(err);
        return;
      }

      // Create a Set of existing items for easy lookup
      const existingSet = new Set(
        existingItems.map(item => `${item.category}:${item.name}`)
      );

      // Filter out items that already exist
      const newItems = defaultItems.filter(item => 
        !existingSet.has(`${item.category}:${item.name}`)
      );

      if (newItems.length === 0) {
        logger.info('No new inspection items to add');
        resolve();
        return;
      }

      // Prepare the statement for new items only
      const stmt = db.prepare(`INSERT INTO InspectionItems 
        (item_id, name, type, category, is_active, description, display_order) 
        VALUES (?, ?, ?, ?, ?, ?, ?)`);

      newItems.forEach(item => {
        const itemId = uuidv4();
        stmt.run([
          itemId,
          item.name,
          item.type,
          item.category,
          true,
          item.description || null,
          item.display_order
        ]);
      });

      stmt.finalize((err) => {
        if (err) {
          reject(err);
        } else {
          logger.info(`Added ${newItems.length} new inspection items`);
          resolve();
        }
      });
    });
  });
};

// Add function to get inspection items
const getInspectionItems = () => {
  return new Promise((resolve, reject) => {
    const db = getDatabase();
    db.all(
      `SELECT * FROM InspectionItems WHERE is_active = true ORDER BY category, display_order`, 
      (err, rows) => {
        if (err) {
          logger.error('Error fetching inspection items:', err);
          reject(err);
        } else {
          resolve(rows || []); // Return empty array if no rows
        }
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
  addVehicleChangeHistory,
  getInspectionItems
};