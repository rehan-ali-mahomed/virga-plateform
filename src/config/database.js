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
    path.join(process.cwd(), 'generated_reports')
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
      // Users table remains unchanged
      db.run(`CREATE TABLE IF NOT EXISTS Users (
        user_id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE,
        role TEXT CHECK(role IN ('Technician', 'Manager', 'Customer Service', 'Admin')) NOT NULL,
        password TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      // Customers table
      db.run(`CREATE TABLE IF NOT EXISTS Customers (
        customer_id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        phone TEXT,
        email TEXT,
        address TEXT,
        is_company BOOLEAN DEFAULT false
      )`);

      // Vehicules table with license_plate as the main identifier
      db.run(`CREATE TABLE IF NOT EXISTS Vehicules (
        vehicle_id TEXT PRIMARY KEY,
        license_plate TEXT UNIQUE NOT NULL,
        customer_id TEXT,
        brand TEXT,
        model TEXT,
        engine_code TEXT,
        revision_oil_type TEXT,
        revision_oil_volume TEXT,
        brake_disc_thickness_front TEXT,
        brake_disc_thickness_rear TEXT,
        first_registration_date TEXT,
        FOREIGN KEY (customer_id) REFERENCES Customers(customer_id)
      )`);

      // InspectionItems unchanged
      db.run(`CREATE TABLE IF NOT EXISTS InspectionItems (
        item_id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT CHECK(type IN ('checkbox', 'text', 'number', 'options')) NOT NULL,
        category TEXT CHECK(category IN ('interior', 'engine', 'front', 'rear', 'accessories', 'work_completed')) NOT NULL,
        is_active BOOLEAN DEFAULT true,
        description TEXT,
        options TEXT,
        display_order INTEGER
      )`);

      // InspectionReports without license_plate
      db.run(`CREATE TABLE IF NOT EXISTS InspectionReports (
        report_id TEXT PRIMARY KEY,
        vehicle_id TEXT NOT NULL,
        date DATE NOT NULL,
        comments TEXT,
        inspection_results JSON NOT NULL DEFAULT '{}',
        technician_id TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        mileage INTEGER,
        next_technical_inspection DATE,
        FOREIGN KEY (vehicle_id) REFERENCES Vehicules(vehicle_id),
        FOREIGN KEY (technician_id) REFERENCES Users(user_id)
      )`, (err) => {
        if (err) {
          logger.error('Error creating tables:', err);
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
    db.get('SELECT * FROM Users WHERE username = ?', [defaultUsername], (err, row) => {
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
            username, 
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

const addVehicle = (licensePlate, ownerName, contactInfo, vehicleDetails = {}) => {
  return new Promise((resolve, reject) => {
    const vehicleId = uuidv4();
    db.run(`INSERT INTO Vehicules (
      vehicle_id, 
      license_plate, 
      owner_name, 
      contact_info,
      brand,
      model,
      engine_code,
      revision_oil_type,
      revision_oil_volume,
      brake_disc_thickness_front,
      brake_disc_thickness_rear
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        vehicleId, 
        licensePlate, 
        ownerName, 
        contactInfo,
        vehicleDetails.brand || null,
        vehicleDetails.model || null,
        vehicleDetails.engine_code || null,
        vehicleDetails.revision_oil_type || null,
        vehicleDetails.revision_oil_volume || null,
        vehicleDetails.brake_disc_thickness_front || null,
        vehicleDetails.brake_disc_thickness_rear || null
      ],
      (err) => {
        if (err) reject(err);
        else resolve(vehicleId);
      }
    );
  });
};

const addUser = (userName, email, role, password) => {
  return new Promise(async (resolve, reject) => {
    const userId = uuidv4();
    const hashedPassword = await bcrypt.hash(password, 10);
    
    db.run(`
      INSERT INTO Users (
        user_id, 
        username, 
        email, 
        role, 
        password
      ) VALUES (?, ?, ?, ?, ?)`,
      [userId, userName, email, role, hashedPassword],
      (err) => {
        if (err) reject(err);
        else resolve(userId);
      }
    );
  });
};

// Add function to seed default inspection items
const seedInspectionItems = () => {
  const defaultOptions = JSON.stringify([
    { id: 0, label: 'Conforme', icon: '/static/img/icon_conforme.svg' },
    { id: 1, label: 'Non conforme', icon: '/static/img/icon_not_conforme.svg' },
    { id: 2, label: 'Non vérifié', icon: '/static/img/icon_unverified.svg' },
    { id: 3, label: 'À planifier', icon: '/static/img/icon_to_plan.svg' }
  ]);

  return new Promise((resolve, reject) => {
    // First check if items already exist
    db.get('SELECT COUNT(*) as count FROM InspectionItems', [], (err, row) => {
      if (err) {
        reject(err);
        return;
      }
      
      if (row.count > 0) {
        resolve(); // Items already seeded
        return;
      }

      const defaultItems = [
        // Interior items
        { category: 'interior', name: 'Antivol de roue bon état', type: 'options', options: defaultOptions, display_order: 1 },
        { category: 'interior', name: 'Démarreur', type: 'options', options: defaultOptions, display_order: 2 },
        { category: 'interior', name: 'Témoin tableau de bord', type: 'options', options: defaultOptions, display_order: 3 },
        { category: 'interior', name: 'Rétroviseur', type: 'options', options: defaultOptions, display_order: 4 },
        { category: 'interior', name: 'Klaxon', type: 'options', options: defaultOptions, display_order: 5 },
        { category: 'interior', name: 'Frein à main', type: 'options', options: defaultOptions, display_order: 6 },
        { category: 'interior', name: 'Essuie glace', type: 'options', options: defaultOptions, display_order: 7 },
        { category: 'interior', name: 'Eclairage', type: 'options', options: defaultOptions, display_order: 8 },
        { category: 'interior', name: 'Jeux au volant', type: 'options', options: defaultOptions, display_order: 9 },

        // Engine items
        { category: 'engine', name: 'Teste batterie/alternateur', type: 'options', options: defaultOptions, display_order: 1 },
        { category: 'engine', name: 'Plaque immat AV', type: 'options', options: defaultOptions, display_order: 2 },
        { category: 'engine', name: 'Fuite boite', type: 'options', options: defaultOptions, display_order: 3 },
        { category: 'engine', name: 'Fuite moteur', type: 'options', options: defaultOptions, display_order: 4 },
        { category: 'engine', name: 'Supports moteur', type: 'options', options: defaultOptions, display_order: 5 },
        { category: 'engine', name: 'Liquide de frein', type: 'options', options: defaultOptions, display_order: 6 },
        { category: 'engine', name: 'Filtre à air', type: 'options', options: defaultOptions, display_order: 7 },
        { category: 'engine', name: 'Courroie accessoire', type: 'options', options: defaultOptions, display_order: 8 },

        // Front items
        { category: 'front', name: 'Roulement', type: 'options', options: defaultOptions, display_order: 1 },
        { category: 'front', name: 'Pneus avant', type: 'options', options: defaultOptions, display_order: 2 },
        { category: 'front', name: 'Parallélisme', type: 'options', options: defaultOptions, display_order: 3 },
        { category: 'front', name: 'Disque avant', type: 'options', options: defaultOptions, display_order: 4 },
        { category: 'front', name: 'Plaquettes avant', type: 'options', options: defaultOptions, display_order: 5 },
        { category: 'front', name: 'Amortisseur avant', type: 'options', options: defaultOptions, display_order: 6 },
        { category: 'front', name: 'Biellette barre stab', type: 'options', options: defaultOptions, display_order: 7 },
        { category: 'front', name: 'Direction complet', type: 'options', options: defaultOptions, display_order: 8 },
        { category: 'front', name: 'Cardans', type: 'options', options: defaultOptions, display_order: 9 },
        { category: 'front', name: 'Triangles avant', type: 'options', options: defaultOptions, display_order: 10 },
        { category: 'front', name: 'Flexible de frein', type: 'options', options: defaultOptions, display_order: 11 },

        // Rear items
        { category: 'rear', name: 'Pneus AR', type: 'options', options: defaultOptions, display_order: 1 },
        { category: 'rear', name: 'Frein AR', type: 'options', options: defaultOptions, display_order: 2 },
        { category: 'rear', name: 'Roulement AR', type: 'options', options: defaultOptions, display_order: 3 },
        { category: 'rear', name: 'Flexible AR', type: 'options', options: defaultOptions, display_order: 4 },
        { category: 'rear', name: 'Amortisseur AR', type: 'options', options: defaultOptions, display_order: 5 },
        { category: 'rear', name: 'Silent Bloc AR', type: 'options', options: defaultOptions, display_order: 6 },

        // Accessories items
        { category: 'accessories', name: 'Plaque immat AR', type: 'options', options: defaultOptions, display_order: 1 },
        { category: 'accessories', name: 'Antenne radio', type: 'options', options: defaultOptions, display_order: 2 },
        { category: 'accessories', name: 'Roue de secours', type: 'options', options: defaultOptions, display_order: 3 },
        { category: 'accessories', name: 'Gilet/Triangle secu', type: 'options', options: defaultOptions, display_order: 4 },
        { category: 'accessories', name: 'Crique / Clé roue', type: 'options', options: defaultOptions, display_order: 5 },

        // Work completed items
        { category: 'work_completed', name: 'Mise a zero vidange', type: 'options', options: defaultOptions, display_order: 1 },
        { category: 'work_completed', name: 'Roue serrer au couple', type: 'options', options: defaultOptions, display_order: 2 },
        { category: 'work_completed', name: 'Etiquette de vidange', type: 'options', options: defaultOptions, display_order: 3 },
        { category: 'work_completed', name: 'Etiquette distribution', type: 'options', options: defaultOptions, display_order: 4 },
        { category: 'work_completed', name: 'Etiquette plaquette', type: 'options', options: defaultOptions, display_order: 5 },
        { category: 'work_completed', name: 'Parfum', type: 'options', options: defaultOptions, display_order: 6 },
        { category: 'work_completed', name: 'Nettoyage', type: 'options', options: defaultOptions, display_order: 7 }
      ];

      // Use serialize to ensure sequential insertion
      db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        
        const stmt = db.prepare(`
          INSERT INTO InspectionItems (
            item_id, name, type, category, is_active, description, options, display_order
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        );

        defaultItems.forEach(item => {
          stmt.run([
            uuidv4(),
            item.name,
            item.type,
            item.category,
            true,
            null,
            item.options,
            item.display_order
          ]);
        });

        stmt.finalize();

        db.run('COMMIT', (err) => {
          if (err) reject(err);
          else resolve();
        });
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
    const customerId = uuidv4();

    db.serialize(() => {
      db.run('BEGIN TRANSACTION');

      try {
        // 1. Créer le client
        db.run(`INSERT INTO Customers (
          customer_id, name, phone, email, address, is_company
        ) VALUES (?, ?, ?, ?, ?, ?)`, [
          customerId,
          reportData.client_name,
          reportData.client_phone,
          reportData.client_email || null,
          reportData.client_address || null,
          reportData.is_company || false
        ], function(err) {
          if (err) throw err;

          // 2. Créer ou mettre à jour le véhicule
          db.run(`INSERT OR REPLACE INTO Vehicules (
            vehicle_id, license_plate, customer_id, brand, model, 
            engine_code, revision_oil_type, revision_oil_volume,
            brake_disc_thickness_front, brake_disc_thickness_rear,
            first_registration_date
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
            vehicleId,
            reportData.license_plate.toUpperCase(),
            customerId,
            reportData.brand || null,
            reportData.model || null,
            reportData.engine_code || null,
            reportData.revision_oil_type || null,
            reportData.revision_oil_volume || null,
            reportData.brake_disc_thickness_front || null,
            reportData.brake_disc_thickness_rear || null,
            reportData.first_registration_date || null
          ], function(err) {
            if (err) throw err;

            // 3. Créer le rapport d'inspection
            db.run(`INSERT INTO InspectionReports (
              report_id,
              vehicle_id,
              date,
              comments,
              inspection_results,
              technician_id,
              created_at,
              mileage,  
              next_technical_inspection
            ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?, ?)`, [
              reportId,
              vehicleId,
              reportData.date,
              reportData.comments || null,
              JSON.stringify(reportData.inspection || '{}'),
              technicianId,
              reportData.mileage || null,
              reportData.next_technical_inspection || null
            ], function(err) {
              if (err) throw err;

              db.run('COMMIT', (err) => {
                if (err) reject(err);
                else resolve(reportId);
              });
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
    
    // First get the report details
    db.get(`
      SELECT 
        ir.*,
        v.license_plate,
        v.brand,
        v.model,
        v.revision_oil_type,
        v.revision_oil_volume,
        v.brake_disc_thickness_front,
        v.brake_disc_thickness_rear,
        v.first_registration_date,
        u.username as technician_name,
        c.name as client_name,
        c.phone as client_phone,
        c.email as client_email,
        c.address as client_address,
        c.is_company
      FROM InspectionReports ir
      LEFT JOIN Vehicules v ON ir.vehicle_id = v.vehicle_id
      LEFT JOIN Users u ON ir.technician_id = u.user_id
      LEFT JOIN Customers c ON v.customer_id = c.customer_id
      WHERE ir.report_id = ?
    `, [reportId], (err, reportData) => {
      if (err) {
        logger.error('Error fetching inspection report:', err);
        return reject(err);
      }
      
      if (!reportData) {
        return resolve(null);
      }

      // Then get all active inspection items
      db.all(`
        SELECT 
          item_id,
          name,
          category,
          type,
          options
        FROM InspectionItems 
        WHERE is_active = true
        ORDER BY category, display_order
      `, [], (err, items) => {
        if (err) {
          logger.error('Error fetching inspection items:', err);
          return reject(err);
        }

        try {
          const inspectionResults = JSON.parse(reportData.inspection_results || '{}');
          
          // Map inspection results to items
          const formattedResults = items.map(item => {
            const result = inspectionResults[item.item_id] || {};
            return {
              item_id: item.item_id,
              name: item.name,
              category: item.category,
              type: item.type,
              value: parseInt(result.value, 10) || 0,
              options: JSON.parse(item.options || '[]'),
              unit: result.unit
            };
          });

          reportData.inspection_results = formattedResults;
          resolve(reportData);
        } catch (error) {
          logger.error('Error parsing inspection results:', error);
          reportData.inspection_results = [];
          resolve(reportData);
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