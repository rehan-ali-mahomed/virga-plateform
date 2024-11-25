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
    logger.debug(`Attempting to create/open database at: ${dbPath}`);

    db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
      if (err) {
        logger.error('Error connecting to the database:', err);
        reject(err);
      } else {
        logger.debug(`Connected to the database at ${dbPath}`);
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
        role TEXT NOT NULL,
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
        drain_plug_torque TEXT,
        FOREIGN KEY (customer_id) REFERENCES Customers(customer_id)
      )`);

      // InspectionItems unchanged
      db.run(`CREATE TABLE IF NOT EXISTS InspectionItems (
        item_id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT CHECK(type IN ('checkbox', 'text', 'number', 'options')) NOT NULL,
        category TEXT NOT NULL,
        is_active BOOLEAN DEFAULT true,
        options TEXT,
        display_order INTEGER
      )`);

      // InspectionReports without license_plate
      db.run(`CREATE TABLE IF NOT EXISTS InspectionReports (
        report_id TEXT PRIMARY KEY,
        vehicle_id TEXT NOT NULL,
        mileage INTEGER,
        comments TEXT,
        next_technical_inspection DATE,
        filters TEXT,
        inspection_results JSON NOT NULL DEFAULT '{}',
        created_by TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (vehicle_id) REFERENCES Vehicules(vehicle_id),
        FOREIGN KEY (created_by) REFERENCES Users(user_id)
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
        logger.debug(`Default user ${defaultUsername} already exists`);
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
          [userId, defaultUsername, 'admin@example.com', 'admin', hashedPassword], 
          (err) => {
            if (err) {
              reject(err);
            } else {
              logger.debug(`Default user ${defaultUsername} created`);
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
      brake_disc_thickness_rear,
      drain_plug_torque
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        vehicleDetails.brake_disc_thickness_rear || null,
        vehicleDetails.drain_plug_torque || null
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

const getUser = (userId) => {
  // log all things from here to debugger
  logger.debug(`Getting user with ID: ${userId}`);
  return new Promise((resolve, reject) => {
    db.get('SELECT username FROM Users WHERE user_id = ?', [userId], (err, row) => {
      if (err) reject(err);
      else if (!row) reject(new Error(`User with ID ${userId} not found`));
      else resolve(row.username);
    });
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
        { category: 'Intérieur', name: 'Antivol de roues', type: 'options', options: defaultOptions, display_order: 1 },
        { category: 'Intérieur', name: 'Démarreur', type: 'options', options: defaultOptions, display_order: 2 },
        { category: 'Intérieur', name: 'Voyants tableau de bord', type: 'options', options: defaultOptions, display_order: 3 },
        { category: 'Intérieur', name: 'Rétroviseurs', type: 'options', options: defaultOptions, display_order: 4 },
        { category: 'Intérieur', name: 'Klaxon', type: 'options', options: defaultOptions, display_order: 5 },
        { category: 'Intérieur', name: 'Frein à main', type: 'options', options: defaultOptions, display_order: 6 },
        { category: 'Intérieur', name: 'Essuie-glaces', type: 'options', options: defaultOptions, display_order: 7 },
        { category: 'Intérieur', name: 'Éclairage', type: 'options', options: defaultOptions, display_order: 8 },
        { category: 'Intérieur', name: 'Jeu au volant', type: 'options', options: defaultOptions, display_order: 9 },

        // Engine items
        { category: 'Moteur', name: 'Niveau d\'huile moteur', type: 'options', options: defaultOptions, display_order: 1 },
        { category: 'Moteur', name: 'Niveau refroidissement', type: 'options', options: defaultOptions, display_order: 2 },
        { category: 'Moteur', name: 'Niveau liquide de frein', type: 'options', options: defaultOptions, display_order: 3 },
        { category: 'Moteur', name: 'Batterie & Alternateur', type: 'options', options: defaultOptions, display_order: 4 },
        { category: 'Moteur', name: 'Fuite boîte de vitesses', type: 'options', options: defaultOptions, display_order: 6 },
        { category: 'Moteur', name: 'Fuite de moteur', type: 'options', options: defaultOptions, display_order: 7 },
        { category: 'Moteur', name: 'Supports moteur', type: 'options', options: defaultOptions, display_order: 8 },
        { category: 'Moteur', name: 'Liquide de frein', type: 'options', options: defaultOptions, display_order: 6 },
        { category: 'Moteur', name: 'Filtre à air', type: 'options', options: defaultOptions, display_order: 7 },
        { category: 'Moteur', name: 'Courroie accessoire', type: 'options', options: defaultOptions, display_order: 8 },


        // Front items
        { category: 'Direction Avant', name: 'Roulement AV', type: 'options', options: defaultOptions, display_order: 1 },
        { category: 'Direction Avant', name: 'Pneus AV', type: 'options', options: defaultOptions, display_order: 2 },
        { category: 'Direction Avant', name: 'Parallélisme', type: 'options', options: defaultOptions, display_order: 3 },
        { category: 'Direction Avant', name: 'Disques de frein AV', type: 'options', options: defaultOptions, display_order: 4 },
        { category: 'Direction Avant', name: 'Plaquettes de frein AV', type: 'options', options: defaultOptions, display_order: 5 },
        { category: 'Direction Avant', name: 'Amortisseur AV', type: 'options', options: defaultOptions, display_order: 6 },
        { category: 'Direction Avant', name: 'Biellette barre stab', type: 'options', options: defaultOptions, display_order: 7 },
        { category: 'Direction Avant', name: 'Direction complète', type: 'options', options: defaultOptions, display_order: 8 },
        { category: 'Direction Avant', name: 'Cardans', type: 'options', options: defaultOptions, display_order: 9 },
        { category: 'Direction Avant', name: 'Triangles AV', type: 'options', options: defaultOptions, display_order: 10 },
        { category: 'Direction Avant', name: 'Flexible de frein AV', type: 'options', options: defaultOptions, display_order: 11 },

        // Rear items
        { category: 'Direction Arrière', name: 'Pneus AR', type: 'options', options: defaultOptions, display_order: 1 },
        { category: 'Direction Arrière', name: 'Freins AR', type: 'options', options: defaultOptions, display_order: 2 },
        { category: 'Direction Arrière', name: 'Roulement AR', type: 'options', options: defaultOptions, display_order: 3 },
        { category: 'Direction Arrière', name: 'Flexible de frein AR', type: 'options', options: defaultOptions, display_order: 4 },
        { category: 'Direction Arrière', name: 'Amortisseur AR', type: 'options', options: defaultOptions, display_order: 5 },
        { category: 'Direction Arrière', name: 'Silent Blocs AR', type: 'options', options: defaultOptions, display_order: 6 },

        // Accessories items
        { category: 'Accessoires', name: 'Plaque immatriculation AV', type: 'options', options: defaultOptions, display_order: 1 },
        { category: 'Accessoires', name: 'Plaque immatriculation AR', type: 'options', options: defaultOptions, display_order: 2 },
        { category: 'Accessoires', name: 'Antenne radio', type: 'options', options: defaultOptions, display_order: 3 },
        { category: 'Accessoires', name: 'Roue de secours', type: 'options', options: defaultOptions, display_order: 4 },
        { category: 'Accessoires', name: 'Gilet & Triangle', type: 'options', options: defaultOptions, display_order: 5 },
        { category: 'Accessoires', name: 'Crique / Clé roue', type: 'options', options: defaultOptions, display_order: 6 },

        // Work completed items
        { category: 'Travaux terminés', name: 'Mise à zéro vidange', type: 'options', options: defaultOptions, display_order: 1 },
        { category: 'Travaux terminés', name: 'Serrage des roues au couple', type: 'options', options: defaultOptions, display_order: 2 },
        { category: 'Travaux terminés', name: 'Etiquette de vidange', type: 'options', options: defaultOptions, display_order: 3 },
        { category: 'Travaux terminés', name: 'Etiquette distribution', type: 'options', options: defaultOptions, display_order: 4 },
        { category: 'Travaux terminés', name: 'Etiquette plaquettes', type: 'options', options: defaultOptions, display_order: 5 },
        { category: 'Travaux terminés', name: 'Parfum intérieur', type: 'options', options: defaultOptions, display_order: 6 },
        { category: 'Travaux terminés', name: 'Nettoyage', type: 'options', options: defaultOptions, display_order: 7 }
      ];

      // Use serialize to ensure sequential insertion
      db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        
        const stmt = db.prepare(`
          INSERT INTO InspectionItems (
            item_id, name, type, category, is_active, options, display_order
          ) VALUES (?, ?, ?, ?, ?, ?, ?)`
        );

        defaultItems.forEach(item => {
          stmt.run([
            uuidv4(),
            item.name,
            item.type,
            item.category,
            true,
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
const saveInspectionReport = (reportData, userId) => {
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
            drain_plug_torque,
            first_registration_date
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
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
            reportData.drain_plug_torque || null,
            reportData.first_registration_date || null
          ], function(err) {
            if (err) throw err;
            // 3. Créer le rapport d'inspection
            db.run(`INSERT INTO InspectionReports (
              report_id,
              vehicle_id,
              mileage,
              comments,
              next_technical_inspection,
              filters,
              inspection_results,
              created_by,
              created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`, [
              reportId,
              vehicleId,
              reportData.mileage || null,
              reportData.comments || null,
              reportData.next_technical_inspection || null,
              reportData.filters || null,
              JSON.stringify(reportData.inspection || '{}'),
              userId
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
        v.*
        u.username as username,
        c.name as client_name,
        c.phone as client_phone,
        c.email as client_email,
        c.address as client_address,
        c.is_company
      FROM InspectionReports ir
      LEFT JOIN Vehicules v ON ir.vehicle_id = v.vehicle_id
      LEFT JOIN Users u ON ir.created_by = u.user_id
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
  getInspectionReport,
  getUser
};
