const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const dotenv = require('dotenv');
dotenv.config();

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
          // .then(() => temporaryDatabaseUpdate())
          .then(() => createDefaultAdminUser())
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
      // Users
      db.run(`CREATE TABLE IF NOT EXISTS Users (
        user_id TEXT PRIMARY KEY,
        first_name TEXT,
        last_name TEXT,
        username TEXT UNIQUE NOT NULL,
        email TEXT,
        role TEXT NOT NULL,
        password TEXT NOT NULL,
        is_active BOOLEAN DEFAULT true,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      // Customers
      db.run(`CREATE TABLE IF NOT EXISTS Customers (
        customer_id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        phone TEXT,
        email TEXT,
        address TEXT,
        is_company BOOLEAN DEFAULT false
      )`);

      // Vehicules
      db.run(`CREATE TABLE IF NOT EXISTS Vehicules (
        vehicule_id TEXT PRIMARY KEY,
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

      // InspectionItems
      db.run(`CREATE TABLE IF NOT EXISTS InspectionItems (
        item_id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT CHECK(type IN ('checkbox', 'text', 'number', 'options')) NOT NULL,
        category TEXT NOT NULL,
        is_active BOOLEAN DEFAULT true,
        options TEXT,
        display_order INTEGER
      )`);

      // InspectionReports
      db.run(`CREATE TABLE IF NOT EXISTS InspectionReports (
        report_id TEXT PRIMARY KEY,
        vehicule_id TEXT NOT NULL,
        mileage INTEGER,
        comments TEXT,
        next_technical_inspection DATE,
        filters TEXT,
        inspection_results JSON NOT NULL DEFAULT '{}',
        created_by TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        mechanics TEXT[] DEFAULT '{}',
        FOREIGN KEY (vehicule_id) REFERENCES Vehicules(vehicule_id),
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

const getDatabase = () => {
  if (!db) {
    throw new Error('Database not initialized. Call initializeDatabase first.');
  }
  return db;
};

function toCamelCase(str) {
  return str.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
}

// ==================== Vehicules ====================
const addVehicule = (licensePlate, customerId, vehiculeDetails = {}) => {
  return new Promise((resolve, reject) => {
    const vehiculeId = uuidv4();
    db.run(`INSERT INTO Vehicules (
      vehicule_id, 
      license_plate, 
      customer_id, 
      brand,
      model,
      engine_code,
      revision_oil_type,
      revision_oil_volume,
      brake_disc_thickness_front,
      brake_disc_thickness_rear,
      first_registration_date,
      drain_plug_torque
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      vehiculeId, 
      licensePlate, 
      customerId,
      vehiculeDetails.brand || null,
      vehiculeDetails.model || null,
      vehiculeDetails.engine_code || null,
      vehiculeDetails.revision_oil_type || null,
      vehiculeDetails.revision_oil_volume || null,
      vehiculeDetails.brake_disc_thickness_front || null,
      vehiculeDetails.brake_disc_thickness_rear || null,
      vehiculeDetails.first_registration_date || null,
      vehiculeDetails.drain_plug_torque || null
    ],
    (err) => {
      if (err) reject(err);
      else resolve(vehiculeId);
    }
    );
  });
};

const updateVehicule = (vehiculeId, licensePlate, customerId, vehiculeDetails = {}) => {
  return new Promise((resolve, reject) => {
    try {
      const fields = [];
      const values = [];

      if (licensePlate !== undefined) {
        fields.push('license_plate = ?');
        values.push(licensePlate);
      }

      if (customerId !== undefined) {
        fields.push('customer_id = ?');
        values.push(customerId);
      }

      for (const key in vehiculeDetails) {
        if (vehiculeDetails[key] !== undefined) {
          fields.push(`${key} = ?`);
          values.push(vehiculeDetails[key]);
        }
      }

      if (fields.length === 0) {
        return resolve(); // No updates to perform
      }

      values.push(vehiculeId);

      logger.debug(`Updating vehicle ${vehiculeId} with fields: ${fields.join(', ')} and values: ${values.join(', ')}`);

      const query = `UPDATE Vehicules SET ${fields.join(', ')} WHERE vehicule_id = ?`;
      db.run(query, values, (err) => {
        if (err) reject(err); else resolve();
      });
    } catch (error) {
      reject(error);
    }
  });
};

const getVehiculeById = (vehiculeId) => {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM Vehicules WHERE vehicule_id = ?', [vehiculeId], (err, row) => {
      if (err) reject(err); else resolve(row);
    });
  });
};

const getAllVehicules = async () => {
  return new Promise((resolve, reject) => {
    const db = getDatabase();
    db.all('SELECT * FROM Vehicules', [], (err, vehicules) => {
      if (err) reject(err);
      else {
        resolve(vehicules);
      }
    });
  });
};

const getVehiculeByLicensePlate = async (license_plate) => {
  const db = getDatabase();
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM Vehicules WHERE license_plate = ?', [license_plate], (err, vehicule) => {
      if (err) reject(err);
      else resolve(vehicule);
    });
  });
};

// ==================== Users ====================
const createDefaultAdminUser = async () => {
  const defaultUsername = process.env.ADMIN_USERNAME;
  const defaultFirstName = process.env.ADMIN_FIRST_NAME;
  const defaultLastName = process.env.ADMIN_LAST_NAME;
  const hashedPassword = await bcrypt.hash(process.env.ADMIN_PASSWORD, parseInt(process.env.BCRYPT_SALT_ROUNDS) || 12);
  const defaultEmail = process.env.ADMIN_EMAIL;
  const userId = uuidv4();

  try {
    const user = await getUserByUsername(defaultUsername);
    if (user) {
      logger.debug('Default admin user already exists. Skipping creation.');
      return user.user_id;
    }

    logger.debug('Default admin user not found. Creating it...');
    const userId = await addUser(defaultFirstName, defaultLastName, defaultUsername, defaultEmail, 'admin', hashedPassword, true);
    return userId;
  } catch (error) {
    logger.error('Error checking if default admin user exists:', error);
    throw error;
  }
};

const addUser = async (first_name, last_name, username, email = null, role, password, password_is_hashed = false) => {
  try {
    username = username.toLowerCase();
    email = email?.toLowerCase();
    role = role.toLowerCase();
    const userId = uuidv4();
    first_name = toCamelCase(first_name);
    last_name = last_name.toUpperCase();
    
    // Check if username already exists
    const existingUser = await getUserByUsername(username);
    if (existingUser) {
      throw new Error('Ce nom d\'utilisateur existe déjà.');
    }

    const hashedPassword = password_is_hashed ? password : await bcrypt.hash(password, parseInt(process.env.BCRYPT_SALT_ROUNDS) || 12);
    
    return new Promise((resolve, reject) => {
      db.run(`
        INSERT INTO Users (
          user_id, 
          first_name,
          last_name,
          username, 
          email, 
          role, 
          password
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [userId, first_name, last_name, username, email, role, hashedPassword],
      (err) => {
        if (err) reject(err);
        else resolve(userId);
      }
      );
    });
  } catch (error) {
    logger.error('Error adding user:', error);
    throw new Error('Erreur lors de l\'ajout de l\'utilisateur'); 
  }
};

const updateUser = async (userId, updates) => {
  try {
    // Check if the user is the default admin user to avoid editing it
    const user = await getUserById(userId);
    if (!user) {
      throw new Error('Utilisateur non trouvé');
    }

    logger.debug(`Trying to update user ${userId} with fields: ${JSON.stringify(updates)}`);

    if(process.env.ADMIN_USERNAME === user.username.replace(' (Désactivé)', '')) {
      logger.warn('Cannot edit default admin user.');
      throw new Error('Impossible de modifier l\'administrateur par défaut.');
    }

    const fields = [];
    const values = [];

    if (updates.email !== undefined) {
      fields.push('email = ?');
      values.push(updates.email.toLowerCase());
    }

    if (updates.first_name !== undefined) {
      fields.push('first_name = ?');
      values.push(toCamelCase(updates.first_name));
    }

    if (updates.last_name !== undefined) {
      fields.push('last_name = ?');
      values.push(updates.last_name.toUpperCase());
    }

    if (updates.role !== undefined) {
      fields.push('role = ?');
      values.push(updates.role.toLowerCase());
    }

    if (updates.password !== undefined) {
      fields.push('password = ?');
      const hashedPassword = await bcrypt.hash(updates.password, parseInt(process.env.BCRYPT_SALT_ROUNDS) || 12);
      values.push(hashedPassword);
    }

    if (updates.is_active !== undefined) {
      fields.push('is_active = ?');
      values.push(updates.is_active);
    }

    if (updates.username !== undefined) {
      const existingUser = await getUserByUsername(updates.username);
      if (existingUser && existingUser.user_id !== userId) {
        throw new Error('Ce nom d\'utilisateur existe déjà');
      }
      fields.push('username = ?');
      values.push(updates.username.toLowerCase());
    }

    if (fields.length === 0) {
      logger.debug(`No updates to perform for user ${userId} Fields => ${fields} => ${JSON.stringify(updates)}`);
      return; // No updates to perform
    }

    values.push(userId);
    
    return new Promise((resolve, reject) => {
      const query = `UPDATE Users SET ${fields.join(', ')} WHERE user_id = ?`;
      db.run(query, values, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  } catch (error) {
    logger.error('Error updating user:', error);
    throw new Error('Erreur lors de la mise à jour de l\'utilisateur');
  }
};

const deleteUser = async (userId) => {
  try {
    const user = await getUserById(userId);
    if (!user) {
      throw new Error('Utilisateur non trouvé');
    }

    const admin = await createDefaultAdminUser();

    if(user.role === 'admin' && admin === user.user_id) {
      logger.error('Impossible de supprimer l\'administrateur par défaut.');
      throw new Error('Impossible de supprimer l\'administrateur par défaut.');
    }

    return new Promise((resolve, reject) => {
      db.run('DELETE FROM Users WHERE user_id = ?', [userId], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  } catch (error) {
    logger.error('Error deleting user:', error);
    throw new Error('Erreur lors de la suppression de l\'utilisateur');
  }
};

const getUserById = async (userId) => {
  logger.debug(`Getting user with ID: ${userId}`);
  
  if (!userId) {
    throw new Error('User ID is required');
  }

  return new Promise((resolve, reject) => {
    db.get(
      'SELECT user_id, first_name, last_name, username, email, role, is_active FROM Users WHERE user_id = ?',
      [userId],
      (err, row) => {
        if (err) {
          logger.error(`Database error while fetching user ${userId}:`, err);
          return reject(err);
        }

        if (!row) {
          logger.error(`User with ID ${userId} not found`);
          return resolve(null);
        }

        // Create a new object instead of mutating the original
        const user = {
          ...row,
          username: row.is_active ? row.username : `${row.username} (Désactivé)`
        };

        logger.debug(`User with ID ${userId} found: ${user.username}`);
        resolve(user);
      }
    );
  });
};

const getUserByUsername = async (username) => {
  if (!username) {
    throw new Error('Username is required');
  }

  return new Promise((resolve, reject) => {
    db.get(
      `SELECT 
        user_id, 
        first_name, 
        last_name, 
        username, 
        email, 
        role, 
        is_active
      FROM Users 
      WHERE LOWER(username) = LOWER(?)`, 
      [username],
      (err, row) => {
        if (err) {
          logger.error(`Database error while fetching user ${username}:`, err);
          return reject(err);
        }

        if (!row) {
          logger.debug(`Username ${username} not found`);
          return resolve(null);
        }

        // Create a new object instead of mutating the original
        const user = {
          ...row,
          username: row.is_active ? row.username : `${row.username} (Désactivé)`
        };

        if (!row.is_active) {
          logger.warn(`User ${username} is disabled`);
        }

        logger.debug(`User ${username} found with id: ${user.user_id}`);
        resolve(user);
      }
    );
  });
};

const getUserWithPasswordByUsername = async (username) => {
  if (!username) {
    throw new Error('Username is required');
  }

  return new Promise((resolve, reject) => {
    db.get(
      'SELECT user_id, username, password, first_name, last_name, email, role, is_active FROM Users WHERE LOWER(username) = LOWER(?)',
      [username],
      (err, row) => {
        if (err) {
          logger.error(`Database error while fetching user ${username}:`, err);
          return reject(err);
        }

        if (!row) {
          logger.debug(`Username ${username} not found`);
          return resolve(null);
        }

        // Create a new object instead of mutating the original
        const user = {
          ...row,
          username: row.is_active ? row.username : `${row.username} (Désactivé)`
        };

        if (!row.is_active) {
          logger.warn(`User ${username} is disabled`);
        }

        logger.debug(`User ${username} found with id: ${user.user_id}`);
        resolve(user);
      }
    );
  });
};

const getAllActiveUsers = () => {
  return new Promise((resolve, reject) => {
    db.all('SELECT user_id, first_name, last_name, username, email, role FROM Users WHERE is_active = true', (err, rows) => {
      if (err) reject(err); else resolve(rows);
    });
  });
};

// ==================== Customers ====================
const getCustomerById = async (customer_id) => {
  const db = getDatabase();
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM Customers WHERE customer_id = ?', [customer_id], (err, customer) => {
      if (err) reject(err);
      else resolve(customer);
    });
  });
};

const getCustomerByPhone = (phone) => {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM Customers WHERE phone = ?', [phone], (err, customer) => {
      if (err) reject(err); else resolve(customer);
    });
  });
};

const getAllCustomers = () => {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM Customers', (err, rows) => {
      if (err) reject(err); else resolve(rows);
    });
  });
};

const getCustomerCarsAndReports = (customerId) => {
  return new Promise((resolve, reject) => {
    const db = getDatabase();
    
    db.serialize(() => {
      db.get(
        'SELECT customer_id, name, phone, address FROM Customers WHERE customer_id = ?',
        [customerId],
        (err, customer) => {
          if (err) return reject(err);
          if (!customer) return resolve(null);

          db.all(`
            SELECT 
              v.vehicule_id,
              v.license_plate,
              v.brand,
              v.model,
              v.engine_code,
              v.first_registration_date,
              (
                SELECT json_group_array(
                  json_object(
                    'report_id', r.report_id,
                    'created_at', r.created_at,
                    'status', CASE 
                      WHEN r.inspection_results = '{}' THEN 'pending'
                      ELSE 'completed'
                    END,
                    'mileage', r.mileage,
                    'next_technical_inspection', r.next_technical_inspection,
                    'comments', r.comments
                  )
                )
                FROM InspectionReports r
                WHERE r.vehicule_id = v.vehicule_id
              ) as reports
            FROM Vehicules v
            WHERE v.customer_id = ?
            ORDER BY v.license_plate ASC
          `, [customerId], (err, cars) => {
            if (err) return reject(err);

            const processedCars = cars.map(car => ({
              ...car,
              reports: JSON.parse(car.reports || '[]')
                .filter(Boolean)
                .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
            }));

            resolve({
              customer,
              cars: processedCars
            });
          });
        }
      );
    });
  });
};

const addCustomer = (name, phone, email, address, is_company) => {
  return new Promise((resolve, reject) => {
    const customerId = uuidv4();
    db.run('INSERT INTO Customers (customer_id, name, email, phone, address, is_company) VALUES (?, ?, ?, ?, ?, ?)', 
      [customerId, name, email, phone, address, is_company ? 1 : 0], 
      (err) => {
        if (err) reject(err); else resolve(customerId);
      }
    );
  });
};

const updateCustomer = async (customer_id, updates) => {
  return new Promise((resolve, reject) => {
    try {
      
      logger.debug(`Trying to update user ${customer_id} with fields: ${JSON.stringify(updates)}`);

      const fields = [];
      const values = [];

      if (updates.name !== undefined) {
        fields.push('name = ?');
        values.push(updates.name);
      }

      if (updates.phone !== undefined) {
        fields.push('phone = ?');
        values.push(updates.phone);
      }

      if (updates.email !== undefined) {
        fields.push('email = ?');
        values.push(updates.email);
      }

      if (updates.address !== undefined) {
        fields.push('address = ?');
        values.push(updates.address);
      }

      if (updates.is_company !== undefined) {
        fields.push('is_company = ?');
        values.push(updates.is_company ? 1 : 0);
      }

      values.push(customer_id);

      const query = `UPDATE Customers SET ${fields.join(', ')} WHERE customer_id = ?`;
      db.run(query, values, (err) => {
        if (err) reject(err);
        else resolve();
      });
    } catch (error) {
      reject(error);
    }
  });
};

const deleteCustomer = (customer_id) => {
  return new Promise((resolve, reject) => {
    db.run('DELETE FROM Customers WHERE customer_id = ?', [customer_id], (err) => {
      if (err) reject(err); else resolve();
    });
  });
};

// ==================== Inspection Items ====================
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
        { category: 'Travaux terminés', name: 'Serrage des roues (Nm)', type: 'options', options: defaultOptions, display_order: 2 },
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
      'SELECT * FROM InspectionItems WHERE is_active = true ORDER BY category, display_order', 
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
const addInspectionReport = (reportData, userId) => {
  return new Promise((resolve, reject) => {
    const customerPhone = reportData.client_phone;
    const customerEmail = reportData.client_email;

    // Check if customer already exists based on phone or email
    db.get('SELECT customer_id FROM Customers WHERE phone = ? OR email = ?', [customerPhone, customerEmail], (err, row) => {
      if (err) {
        return reject(err);
      }

      let customerId;
      if (row) {
        customerId = row.customer_id;
        logger.debug(`Existing customer found: ${customerId}`);
        
        // Update existing customer
        db.run(`UPDATE Customers SET
          name = ?,
          phone = ?,
          email = ?,
          address = ?,
          is_company = ?
        WHERE customer_id = ?`, [
          reportData.client_name,
          reportData.client_phone,
          reportData.client_email || null,
          reportData.client_address || null,
          reportData.is_company || false,
          customerId
        ], function(err) {
          if (err) {
            return reject(err);
          }
          proceedWithReport();
        });
      } else {
        logger.debug('No existing customer found, creating new customer with data:', reportData);
        // Create new customer
        customerId = uuidv4();
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
          if (err) {
            return reject(err);
          }
          proceedWithReport();
        });
      }

      const proceedWithReport = () => {
        // First check if vehicle exists
        db.get('SELECT vehicule_id FROM Vehicules WHERE license_plate = ?', 
          [reportData.license_plate.toUpperCase()], 
          (err, existingVehicle) => {
            if (err) return reject(err);

            const vehiculeId = existingVehicle ? existingVehicle.vehicule_id : uuidv4();
            
            // Update or insert vehicle
            const query = existingVehicle ? 
              `UPDATE Vehicules SET 
                customer_id = ?, brand = ?, model = ?, 
                engine_code = ?, revision_oil_type = ?, revision_oil_volume = ?,
                brake_disc_thickness_front = ?, brake_disc_thickness_rear = ?,
                drain_plug_torque = ?, first_registration_date = ?
                WHERE vehicule_id = ?` :
              `INSERT INTO Vehicules (
                vehicule_id, license_plate, customer_id, brand, model, 
                engine_code, revision_oil_type, revision_oil_volume,
                brake_disc_thickness_front, brake_disc_thickness_rear,
                drain_plug_torque, first_registration_date
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

            const params = existingVehicle ? [
              customerId,
              reportData.brand || null,
              reportData.model || null,
              reportData.engine_code || null,
              reportData.revision_oil_type || null,
              reportData.revision_oil_volume || null,
              reportData.brake_disc_thickness_front || null,
              reportData.brake_disc_thickness_rear || null,
              reportData.drain_plug_torque || null,
              reportData.first_registration_date || null,
              vehiculeId
            ] : [
              vehiculeId,
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
            ];

            db.run(query, params, function(err) {
              if (err) return reject(err);

              // Continue with report creation...
              const reportId = uuidv4();
              db.run(`INSERT INTO InspectionReports (
                report_id,
                vehicule_id,
                mileage,
                comments,
                next_technical_inspection,
                filters,
                inspection_results,
                created_by,
                created_at,
                mechanics
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?)`, [
                reportId,
                vehiculeId,
                reportData.mileage || null,
                reportData.comments || null,
                reportData.next_technical_inspection || null,
                reportData.filters || null,
                JSON.stringify(reportData.inspection || '{}'),
                userId,
                JSON.stringify(reportData.mechanics || []),
              ], function(err) {
                if (err) {
                  return reject(err);
                }

                db.run('COMMIT', (err) => {
                  if (err) reject(err);
                  else resolve(reportId);
                });
              });
            });
          }
        );
      };
    });

    db.run('BEGIN TRANSACTION', (err) => {
      if (err) return reject(err);
      // Transaction started
    });
  });
};

const updateInspectionReports = (reportId, reportData, userId) => {
  return new Promise((resolve, reject) => {
    const db = getDatabase();

    // First get the existing report to get vehicule_id and customer_id
    db.get(`
      SELECT 
        ir.vehicule_id,
        v.customer_id
      FROM InspectionReports ir
      LEFT JOIN Vehicules v ON ir.vehicule_id = v.vehicule_id
      WHERE ir.report_id = ?
    `, [reportId], (err, existingReport) => {
      if (err) {
        return reject(err);
      }
      
      if (!existingReport) {
        return reject(new Error('Report not found'));
      }

      db.serialize(() => {
        db.run('BEGIN TRANSACTION');

        try {
          // 1. Update the customer
          db.run(`UPDATE Customers SET
            name = ?,
            phone = ?,
            email = ?,
            address = ?,
            is_company = ?
          WHERE customer_id = ?`, [
            reportData.client_name,
            reportData.client_phone,
            reportData.client_email || null,
            reportData.client_address || null,
            reportData.is_company || false,
            existingReport.customer_id
          ], function(err) {
            if (err) throw err;

            // 2. Update the vehicule
            db.run(`UPDATE Vehicules SET
              license_plate = ?,
              brand = ?,
              model = ?,
              engine_code = ?,
              revision_oil_type = ?,
              revision_oil_volume = ?,
              brake_disc_thickness_front = ?,
              brake_disc_thickness_rear = ?,
              drain_plug_torque = ?,
              first_registration_date = ?
            WHERE vehicule_id = ?`, [
              reportData.license_plate.toUpperCase(),
              reportData.brand || null,
              reportData.model || null,
              reportData.engine_code || null,
              reportData.revision_oil_type || null,
              reportData.revision_oil_volume || null,
              reportData.brake_disc_thickness_front || null,
              reportData.brake_disc_thickness_rear || null,
              reportData.drain_plug_torque || null,
              reportData.first_registration_date || null,
              existingReport.vehicule_id
            ], function(err) {
              if (err) throw err;

              // 3. Update the inspection report
              db.run(`UPDATE InspectionReports SET
                mileage = ?,
                comments = ?,
                next_technical_inspection = ?,
                filters = ?,
                inspection_results = ?,
                created_by = ?,
                mechanics = ?
              WHERE report_id = ?`, [
                reportData.mileage || null,
                reportData.comments || null,
                reportData.next_technical_inspection || null,
                reportData.filters || null,
                JSON.stringify(reportData.inspection || '{}'),
                userId,
                JSON.stringify(reportData.mechanics || '{}'),
                reportId
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
      LEFT JOIN Vehicules v ON ir.vehicule_id = v.vehicule_id
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

// Database backup function
const backupDatabase = (backupPath) => {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error('Database not initialized'));
      return;
    }

    // Ensure the path uses forward slashes for SQLite
    const normalizedPath = backupPath.replace(/\\/g, '/');

    db.run(`VACUUM INTO '${normalizedPath}'`, (err) => {
      if (err) {
        logger.error('Error during VACUUM backup:', err);
        reject(err);
      } else {
        logger.info(`Database backup created successfully at: ${backupPath}`);
        resolve();
      }
    });
  });
};

module.exports = {
  initializeDatabase,
  getDatabase,
  // InspectionItems
  getInspectionItems,
  // InspectionReports
  addInspectionReport,
  getInspectionReport,
  updateInspectionReports,
  // Vehicules
  addVehicule,
  getVehiculeByLicensePlate,
  getVehiculeById,
  getAllVehicules,
  updateVehicule,
  // Users
  addUser,
  getUserById,
  getAllActiveUsers,
  getUserByUsername,
  getUserWithPasswordByUsername,
  updateUser,
  deleteUser,
  // Customers
  addCustomer,
  getAllCustomers,
  getCustomerByPhone,
  getCustomerById,
  updateCustomer,
  deleteCustomer,
  getCustomerCarsAndReports,
  // Database backup
  backupDatabase
};
