const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');

let db;

const ensureDirectories = () => {
  const dirs = [
    path.join(process.cwd(), 'src', 'db'),
    path.join(process.cwd(), 'generated_reports'),
    path.join(process.cwd(), 'temp')
  ];

  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
};

const initializeDatabase = () => {
  return new Promise((resolve, reject) => {
    ensureDirectories();
    
    const dbPath = path.join(process.cwd(), 'src', 'db', 'database.sqlite');
    logger.info(`Attempting to create/open database at: ${dbPath}`);

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
      // Create Users table with updated schema
      db.run(`CREATE TABLE IF NOT EXISTS Users (
        user_id TEXT PRIMARY KEY,
        user_name TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE,           -- Changed from contact_info
        phone TEXT,                  -- Added phone field
        role TEXT CHECK(role IN ('Technician', 'Manager', 'Customer Service', 'Admin')) NOT NULL,
        specialization TEXT,
        password TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`, (err) => {
        if (err) {
          logger.error('Error creating Users table:', err);
          reject(err);
        }
      });

      // Create Vehicles table
      db.run(`CREATE TABLE IF NOT EXISTS Vehicles (
        vehicle_id TEXT PRIMARY KEY,
        license_plate TEXT UNIQUE,
        owner_name TEXT,
        contact_info TEXT
      )`, (err) => {
        if (err) {
          logger.error('Error creating Vehicles table:', err);
          reject(err);
        }
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
        if (err) {
          logger.error('Error creating InspectionItems table:', err);
          reject(err);
        }
      });

      // Create InspectionReports table
      db.run(`CREATE TABLE IF NOT EXISTS InspectionReports (
        report_id TEXT PRIMARY KEY,
        vehicle_id TEXT,
        date DATE NOT NULL,
        client_name TEXT NOT NULL,
        client_phone TEXT NOT NULL,
        license_plate TEXT NOT NULL,
        revision_oil_type TEXT,
        revision_oil_volume TEXT,
        brake_disc_thickness_front TEXT,
        brake_disc_thickness_rear TEXT,
        comments TEXT,
        inspection_results JSON NOT NULL DEFAULT '{}',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        technician_id TEXT,
        FOREIGN KEY (vehicle_id) REFERENCES Vehicles(vehicle_id),
        FOREIGN KEY (technician_id) REFERENCES Users(user_id)
      )`, (err) => {
        if (err) {
          logger.error('Error creating InspectionReports table:', err);
          reject(err);
        } else {
          resolve();
        }
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
        db.run(`
          INSERT INTO Users (
            user_id, 
            user_name, 
            email, 
            role, 
            password
          ) VALUES (?, ?, ?, ?, ?)`, 
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

const addUser = (userName, email, phone, role, specialization, password) => {
  return new Promise(async (resolve, reject) => {
    const userId = uuidv4();
    const hashedPassword = await bcrypt.hash(password, 10);
    
    db.run(`
      INSERT INTO Users (
        user_id, 
        user_name, 
        email, 
        phone,
        role, 
        specialization, 
        password
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [userId, userName, email, phone, role, specialization, hashedPassword],
      (err) => {
        if (err) reject(err);
        else resolve(userId);
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
          resolve(rows || []); // Always return an array
        }
      }
    );
  });
};

// Add function to save inspection report
const saveInspectionReport = (reportData, technicianId) => {
  return new Promise((resolve, reject) => {
    const db = getDatabase();
    const reportId = uuidv4();
    const vehicleId = uuidv4();

    db.serialize(() => {
      db.run('BEGIN TRANSACTION');

      try {
        // First, create or get vehicle
        db.run(`INSERT OR IGNORE INTO Vehicles (
          vehicle_id, license_plate, owner_name, contact_info
        ) VALUES (?, ?, ?, ?)`, [
          vehicleId,
          reportData.license_plate.toUpperCase(),
          reportData.client_name,
          reportData.client_phone
        ]);

        // Get the vehicle_id if it already existed
        db.get('SELECT vehicle_id FROM Vehicles WHERE license_plate = ?', 
          [reportData.license_plate.toUpperCase()], 
          (err, row) => {
            if (err) throw err;
            
            const finalVehicleId = row ? row.vehicle_id : vehicleId;

            // Create inspection report with JSON inspection_results
            db.run(`INSERT INTO InspectionReports (
              report_id,
              vehicle_id,
              date,
              client_name,
              client_phone,
              license_plate,
              revision_oil_type,
              revision_oil_volume,
              brake_disc_thickness_front,
              brake_disc_thickness_rear,
              comments,
              inspection_results,
              technician_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
              reportId,
              finalVehicleId,
              reportData.date,
              reportData.client_name,
              reportData.client_phone,
              reportData.license_plate.toUpperCase(),
              reportData.revision_oil_type || null,
              reportData.revision_oil_volume || null,
              reportData.brake_disc_thickness_front || null,
              reportData.brake_disc_thickness_rear || null,
              reportData.comments || null,
              reportData.inspection_results || '{}',
              technicianId
            ], (err) => {
              if (err) {
                throw err;
              }
              
              db.run('COMMIT', (err) => {
                if (err) {
                  reject(err);
                } else {
                  resolve(reportId);
                }
              });
            });
          });

      } catch (error) {
        db.run('ROLLBACK', () => {
          reject(error);
        });
      }
    });
  });
};

// Add function to get inspection report by ID
const getInspectionReport = (reportId) => {
  return new Promise((resolve, reject) => {
    const db = getDatabase();
    db.get(`
      SELECT 
        ir.*,
        u.user_name as technician_name,
        ii.item_id,
        ii.name,
        ii.category
      FROM InspectionReports ir
      LEFT JOIN Users u ON ir.technician_id = u.user_id
      LEFT JOIN InspectionItems ii ON ii.is_active = true
      WHERE ir.report_id = ?
    `, [reportId], (err, row) => {
      if (err) {
        logger.error('Error fetching inspection report:', err);
        reject(err);
      } else {
        if (row) {
          try {
            // Parse the JSON inspection results
            const inspectionResults = JSON.parse(row.inspection_results || '{}');
            
            // Format the results to match the expected structure
            row.inspection_results = Object.entries(inspectionResults).map(([itemId, checked]) => ({
              item_id: itemId,
              name: row.name,
              category: row.category,
              checked: checked
            }));

            // Remove redundant fields
            delete row.item_id;
            delete row.name;
            delete row.category;
          } catch (error) {
            logger.error('Error parsing inspection results:', error);
            row.inspection_results = [];
          }
        }
        resolve(row);
      }
    });
  });
};

// Add this function to handle database migrations
const migrateDatabase = () => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // Check if we need to migrate Users table
      db.all("PRAGMA table_info(Users)", [], (err, rows) => {
        if (err) {
          logger.error('Error checking table info:', err);
          reject(err);
          return;
        }

        // If contact_info column exists, migrate to new schema
        if (Array.isArray(rows) && rows.some(row => row.name === 'contact_info')) {
          logger.info('Starting Users table migration...');
          
          db.serialize(() => {
            db.run('BEGIN TRANSACTION');

            try {
              // Create temporary table with new schema
              db.run(`CREATE TABLE Users_new (
                user_id TEXT PRIMARY KEY,
                user_name TEXT UNIQUE NOT NULL,
                email TEXT UNIQUE,
                phone TEXT,
                role TEXT CHECK(role IN ('Technician', 'Manager', 'Customer Service', 'Admin')) NOT NULL,
                specialization TEXT,
                password TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
              )`);

              // Copy data from old table to new table
              db.run(`INSERT INTO Users_new (
                user_id, user_name, email, role, specialization, password
              ) SELECT 
                user_id, user_name, contact_info, role, specialization, password 
                FROM Users`);

              // Drop old table
              db.run("DROP TABLE Users");

              // Rename new table to Users
              db.run("ALTER TABLE Users_new RENAME TO Users", [], (err) => {
                if (err) {
                  throw err;
                }
                db.run('COMMIT', [], () => {
                  logger.info('Users table migration completed successfully');
                  resolve();
                });
              });
            } catch (error) {
              db.run('ROLLBACK', [], () => {
                logger.error('Error during migration:', error);
                reject(error);
              });
            }
          });
        } else {
          logger.info('No migration needed for Users table');
          resolve();
        }
      });
    });
  });
};

module.exports = {
  initializeDatabase,
  getDatabase,
  addVehicle,
  addUser,
  getInspectionItems,
  saveInspectionReport,
  getInspectionReport
};