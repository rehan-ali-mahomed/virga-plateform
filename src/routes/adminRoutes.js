const express = require('express');
const router = express.Router();
const { isAuthenticated, isAdmin } = require('../middleware/auth');
const { 
  getDatabase,
  // Users
  addUser,
  getUserById,
  updateUser,
  deleteUser,
  // Customers
  addCustomer,
  getAllCustomers,
  getCustomerByPhone,
  getCustomerById,
  deleteCustomer,
  // Vehicules
  addVehicule,
  getVehiculeById,
  updateVehicule,
  getCustomerCarsAndReports
} = require('../config/database');
const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const path = require('path');

// Utility function to promisify db operations
const dbAll = (db, query, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(query, params, (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
};

const dbGet = (db, query, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(query, params, (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row);
      }
    });
  });
};

const dbRun = (db, query, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(query, params, function(err) {
      if (err) {
        reject(err);
      } else {
        resolve(this);
      }
    });
  });
};

// Configure multer for icon uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'public/img/icons/');
  },
  filename: (req, file, cb) => {
    cb(null, `icon_${Date.now()}${path.extname(file.originalname)}`);
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'image/svg+xml') {
      cb(null, true);
    } else {
      cb(new Error('Only SVG files are allowed'));
    }
  }
});

// GET /admin - Render Admin Dashboard
router.get('/', isAuthenticated, isAdmin, async (req, res) => {
  const db = getDatabase();
  const { searchTerm } = req.query;

  try {
    let queries = [
      'SELECT * FROM InspectionReports',
      'SELECT * FROM Users',
      'SELECT * FROM Customers',
      'SELECT * FROM Vehicules',
      'SELECT * FROM InspectionItems'
    ];

    let params = [];

    if (searchTerm) {
      const likeTerm = `%${searchTerm}%`;
      queries = [
        'SELECT * FROM InspectionReports WHERE report_id LIKE ?',
        'SELECT * FROM Users WHERE username LIKE ? OR email LIKE ?',
        'SELECT * FROM Customers WHERE name LIKE ? OR email LIKE ? OR phone LIKE ?',
        'SELECT * FROM Vehicules WHERE license_plate LIKE ? OR brand LIKE ? OR model LIKE ?',
        'SELECT * FROM InspectionItems WHERE name LIKE ? OR category LIKE ?'
      ];
      // Paramètres ajustés en fonction du terme de recherche
      params = [
        likeTerm,
        likeTerm, likeTerm,
        likeTerm, likeTerm, likeTerm,
        likeTerm, likeTerm, likeTerm,
        likeTerm, likeTerm
      ];
    }

    const inspectionReportsPromise = dbAll(db, queries[0], searchTerm ? [params[0]] : []);
    const usersPromise = dbAll(db, queries[1], searchTerm ? [params[1], params[2]] : []);
    const customersPromise = dbAll(db, queries[2], searchTerm ? [params[3], params[4], params[5]] : []);
    const vehiculesPromise = dbAll(db, queries[3], searchTerm ? [params[6], params[7], params[8]] : []);
    const inspectionItemsPromise = dbAll(db, queries[4], searchTerm ? [params[9], params[10]] : []);

    const [inspectionReports, users, customers, vehicules, inspectionItems] = await Promise.all([
      inspectionReportsPromise,
      usersPromise,
      customersPromise,
      vehiculesPromise,
      inspectionItemsPromise
    ]);

    res.render('admin', {
      inspectionReports,
      users,
      customers,
      vehicules,
      inspectionItems,
      user: req.session.user,
      searchTerm: searchTerm || ''
    });
  } catch (error) {
    logger.error('Erreur lors du chargement du tableau de bord administrateur:', error);
    res.status(500).render('error', {
      message: 'Erreur lors du chargement du tableau de bord administrateur.',
      errors: [error.message],
      user: req.session.user
    });
  }
});

// ==================== Users Management ====================

// GET /admin/users - List all active users
router.get('/users', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const users = await getAllActiveUsers();
    res.json({ users });
  } catch (error) {
    logger.error('Erreur lors de la récupération des utilisateurs:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des utilisateurs.' });
  }
});

// GET /admin/users/:id - Get a user by id
router.get('/users/:id', isAuthenticated, isAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const user = await getUserById(id);
    res.json({ user: user });
  } catch (error) {
    logger.error('Erreur lors de la récupération de l\'utilisateur:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération de l\'utilisateur.' });
  }
});

// POST /admin/users - Create a new user
router.post('/users', isAuthenticated, isAdmin, async (req, res) => {
  const { username, email, role, password } = req.body;

  if (!username || !password || !role) {
    return res.status(400).json({ error: 'Nom d\'utilisateur, mot de passe et rôle sont requis.' });
  }

  try {
    await addUser(username, email, role, password);
    res.status(201).json({ message: `Utilisateur ${username} créé avec succès.`});
  } catch (error) {
    logger.error('Erreur lors de la création de l\'utilisateur:', error);
    res.status(500).json({ error: 'Erreur lors de la création de l\'utilisateur.' });
  }
});

// PUT /admin/users/:id - Update an existing user
router.put('/users/:id', isAuthenticated, isAdmin, async (req, res) => {
  const { id } = req.params;
  const { email, role, password, is_active } = req.body;

  try {
    const user = await getUserById(id);
    if (!user) {
      return res.status(404).json({ error: 'Utilisateur non trouvé.' });
    }

    await updateUser(id, { email: email, role: role, password: password, is_active: is_active });

    res.json({ message: 'Utilisateur mis à jour avec succès.' });
  } catch (error) {
    logger.error('Erreur lors de la mise à jour de l\'utilisateur:', error);
    res.status(500).json({ error: 'Erreur lors de la mise à jour de l\'utilisateur.' });
  }
});

// DELETE /admin/users/:id - Delete a user
router.delete('/users/:id', isAuthenticated, isAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    const user = await getUserById(id);
    if(user.is_active === 1) {
      return res.status(400).json({ error: 'Impossible de supprimer un utilisateur actif. Veuillez désactiver l\'utilisateur avant de le supprimer.' });

    } else if (user.is_active === 0) {
      await deleteUser(id);
      res.json({ message: 'Utilisateur supprimé avec succès.' });

    }
  } catch (error) {
    logger.error('Erreur lors de la désactivation de l\'utilisateur:', error);
    res.status(500).json({ error: 'Erreur lors de la désactivation de l\'utilisateur.' });
  }
});

// Check if username exists
router.get('/users/check-username', isAuthenticated, isAdmin, async (req, res) => {
  const { username } = req.query;
  
  try {
    const user = await getUserByUsername(username);
    res.json({ exists: !!user });
  } catch (error) {
    logger.error('Error checking username:', error);
    res.status(500).json({ error: 'Failed to check username' });
  }
});

// Handle icon upload
router.post('/upload-icon', isAuthenticated, isAdmin, upload.single('icon'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  
  const iconPath = `/img/icons/${req.file.filename}`;
  res.json({ iconPath });
});

// ==================== Customers Management ====================

// GET /admin/customers - List all customers
router.get('/customers', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const customers = await getAllCustomers();
    res.json({ customers });
  } catch (error) {
    logger.error('Erreur lors de la récupération des clients:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des clients.' });
  }
});

// GET /admin/customers/:id - Get a customer by id
router.get('/customers/:id', isAuthenticated, isAdmin, async (req, res) => {
  const { id } = req.params;
  const customer = await getCustomerById(id);
  res.json({ customer: customer });
});

// POST /admin/customers - Create a new customer
router.post('/customers', isAuthenticated, isAdmin, async (req, res) => {
  const { name, email, phone, address, is_company } = req.body;

  if (!name || !phone) {
    return res.status(400).json({ error: 'Le nom et le téléphone sont requis.' });
  } else if (phone && await getCustomerByPhone(phone)) {
    return res.status(400).json({ error: 'Un client avec ce numéro de téléphone existe déjà.' });
  }

  try {
    await addCustomer(name, phone, email, address, is_company);
    res.status(201).json({ message: 'Client créé avec succès.' });
  } catch (error) {
    logger.error('Erreur lors de la création du client:', error);
    res.status(500).json({ error: 'Erreur lors de la création du client.' });
  }
});

// PUT /admin/customers/:id - Update an existing customer
router.put('/customers/:id', isAuthenticated, isAdmin, async (req, res) => {
  const db = getDatabase();
  const { id } = req.params;
  const { name, email, phone, address, is_company } = req.body;

  try {
    const customer = await dbGet(db, 'SELECT * FROM Customers WHERE customer_id = ?', [id]);
    if (!customer) {
      return res.status(404).json({ error: 'Client non trouvé.' });
    }

    const updatedName = name || customer.name;
    const updatedEmail = email || customer.email;
    const updatedPhone = phone || customer.phone;
    const updatedAddress = address || customer.address;
    const updatedIsCompany = typeof is_company !== 'undefined' ? (is_company ? 1 : 0) : customer.is_company;

    await updateCustomer(id, updatedName, updatedEmail, updatedPhone, updatedAddress, updatedIsCompany);

    res.json({ message: 'Client mis à jour avec succès.' });
  } catch (error) {
    logger.error('Erreur lors de la mise à jour du client:', error);
    res.status(500).json({ error: 'Erreur lors de la mise à jour du client.' });
  }
});

// DELETE /admin/customers/:id - Delete a customer
router.delete('/customers/:id', isAuthenticated, isAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    await deleteCustomer(id);
    res.json({ message: 'Client supprimé avec succès.' });
  } catch (error) {
    logger.error('Erreur lors de la suppression du client:', error);
    res.status(500).json({ error: 'Erreur lors de la suppression du client.' });
  }
});

// GET /admin/customers/:id/cars-reports - Get customer cars and reports
router.get('/customers/:id/cars-reports', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const result = await getCustomerCarsAndReports(req.params.id);
    
    if (!result) {
      return res.status(404).json({ error: 'Client non trouvé.' });
    }

    res.json(result);
    
  } catch (error) {
    logger.error('Erreur lors de la récupération des véhicules et rapports:', error);
    res.status(500).json({ 
      error: 'Erreur lors de la récupération des véhicules et rapports.' 
    });
  }
});

// ==================== Vehicles Management ====================

// GET /admin/vehicules - List all vehicules
router.get('/vehicules', isAuthenticated, isAdmin, async (req, res) => {
  const db = getDatabase();
  try {
    const vehicules = await dbAll(db, 'SELECT * FROM Vehicules');
    res.json({ vehicules });
  } catch (error) {
    logger.error('Erreur lors de la récupération des véhicules:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des véhicules.' });
  }
});

// GET /admin/vehicules/:id - Get a vehicule by id
router.get('/vehicules/:id', isAuthenticated, isAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    const vehicule = await getVehiculeById(id);
    res.json({ vehicule: vehicule });
  } catch (error) {
    logger.error('Erreur lors de la récupération du véhicule:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération du véhicule.' });
  }
});

// POST /admin/vehicules - Create a new vehicule
router.post('/vehicules', isAuthenticated, isAdmin, async (req, res) => {
  const {
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
  } = req.body;

  if (!license_plate) {
    return res.status(400).json({ error: 'Immatriculation est requis.' });
  }

  try {
    await addVehicule(license_plate, customer_id || null, {
      brand,
      model,
      engine_code,
      revision_oil_type,
      revision_oil_volume,
      brake_disc_thickness_front,
      brake_disc_thickness_rear,
      first_registration_date,
      drain_plug_torque
    });
 
    res.status(201).json({ message: 'Véhicule créé avec succès.' });
  } catch (error) {
    logger.error('Erreur lors de la création du véhicule:', error);
    res.status(500).json({ error: 'Erreur lors de la création du véhicule.' });
  }
});

// PUT /admin/vehicules/:id - Update an existing vehicule
router.put('/vehicules/:id', isAuthenticated, isAdmin, async (req, res) => {
  const { id } = req.params;
  const {
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
  } = req.body;

  try {
    const vehicule = await getVehiculeById(id);
    if (!vehicule) {
      return res.status(404).json({ error: 'Véhicule non trouvé.' });
    }

    const updatedLicensePlate = license_plate ? license_plate.toUpperCase() : vehicule.license_plate;
    const updatedCustomerId = customer_id || vehicule.customer_id;
    const updatedBrand = brand || vehicule.brand;
    const updatedModel = model || vehicule.model;
    const updatedEngineCode = engine_code || vehicule.engine_code;
    const updatedRevisionOilType = revision_oil_type || vehicule.revision_oil_type;
    const updatedRevisionOilVolume = revision_oil_volume || vehicule.revision_oil_volume;
    const updatedBrakeDiscThicknessFront = brake_disc_thickness_front || vehicule.brake_disc_thickness_front;
    const updatedBrakeDiscThicknessRear = brake_disc_thickness_rear || vehicule.brake_disc_thickness_rear;
    const updatedFirstRegistrationDate = first_registration_date || vehicule.first_registration_date;
    const updatedDrainPlugTorque = drain_plug_torque || vehicule.drain_plug_torque;

    await updateVehicule(id, updatedLicensePlate, updatedCustomerId, {
      brand: updatedBrand,
      model: updatedModel,
      engine_code: updatedEngineCode,
      revision_oil_type: updatedRevisionOilType,
      revision_oil_volume: updatedRevisionOilVolume,
      brake_disc_thickness_front: updatedBrakeDiscThicknessFront,
      brake_disc_thickness_rear: updatedBrakeDiscThicknessRear,
      first_registration_date: updatedFirstRegistrationDate,
      drain_plug_torque: updatedDrainPlugTorque
    });

    res.json({ message: 'Véhicule mis à jour avec succès.' });
  } catch (error) {
    logger.error('Erreur lors de la mise à jour du véhicule:', error);
    res.status(500).json({ error: 'Erreur lors de la mise à jour du véhicule.' });
  }
});

// DELETE /admin/vehicules/:id - Delete a vehicule
router.delete('/vehicules/:id', isAuthenticated, isAdmin, async (req, res) => {
  const db = getDatabase();
  const { id } = req.params;

  try {
    const result = await dbRun(db, 'DELETE FROM Vehicules WHERE vehicule_id = ?', [id]);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Véhicule non trouvé.' });
    }
    res.json({ message: 'Véhicule supprimé avec succès.' });
  } catch (error) {
    logger.error('Erreur lors de la suppression du véhicule:', error);
    res.status(500).json({ error: 'Erreur lors de la suppression du véhicule.' });
  }
});

// ==================== Inspection Items Management ====================

// GET /admin/inspectionItems - List all inspection items
router.get('/inspectionItems', isAuthenticated, isAdmin, async (req, res) => {
  const db = getDatabase();
  try {
    const inspectionItems = await dbAll(db, 'SELECT * FROM InspectionItems');
    res.json({ inspectionItems });
  } catch (error) {
    logger.error('Erreur lors de la récupération des points de contrôle:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des points de contrôle.' });
  }
});

// GET /admin/inspectionItems/:id - Get an inspection item by id
router.get('/inspectionItems/:id', isAuthenticated, isAdmin, async (req, res) => {
  const db = getDatabase();
  const { id } = req.params;
  try {
    const inspectionItem = await dbGet(db, 'SELECT * FROM InspectionItems WHERE item_id = ?', [id]);
    res.json({ inspectionItem });
  } catch (error) {
    logger.error('Erreur lors de la récupération des points de contrôle:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des points de contrôle.' });
  }
});

// POST /admin/inspectionItems - Create a new inspection item
router.post('/inspectionItems', isAuthenticated, isAdmin, async (req, res) => {
  const db = getDatabase();
  const { name, type, category, is_active, display_order, options } = req.body;

  if (!name || !type || !category || typeof is_active === 'undefined') {
    return res.status(400).json({ error: 'Nom, type, catégorie et statut actif sont requis.' });
  }

  try {
    const itemId = uuidv4();
    const optionsJSON = options ? JSON.stringify(options) : null;

    await dbRun(db, `
      INSERT INTO InspectionItems (item_id, name, type, category, is_active, display_order, options)
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        itemId,
        name,
        type,
        category,
        is_active ? 1 : 0,
        display_order || 0,
        optionsJSON
      ]
    );

    res.status(201).json({ message: 'Point de contrôle créé avec succès.' });
  } catch (error) {
    logger.error('Erreur lors de la création du point de contrôle:', error);
    res.status(500).json({ error: 'Erreur lors de la création du point de contrôle.' });
  }
});

// PUT /admin/inspectionItems/:id - Update an existing inspection item
router.put('/inspectionItems/:id', isAuthenticated, isAdmin, async (req, res) => {
  const db = getDatabase();
  const { id } = req.params;
  const { name, type, category, is_active, display_order, options } = req.body;

  try {
    const item = await dbGet(db, 'SELECT * FROM InspectionItems WHERE item_id = ?', [id]);
    if (!item) {
      return res.status(404).json({ error: 'Point de contrôle non trouvé.' });
    }

    const updatedName = name || item.name;
    const updatedType = type || item.type;
    const updatedCategory = category || item.category;
    const updatedIsActive = typeof is_active !== 'undefined' ? (is_active ? 1 : 0) : item.is_active;
    const updatedDisplayOrder = display_order || item.display_order;
    const updatedOptions = options ? JSON.stringify(options) : item.options;

    await dbRun(db, `
      UPDATE InspectionItems 
      SET name = ?, type = ?, category = ?, is_active = ?, display_order = ?, options = ?
      WHERE item_id = ?`,
      [
        updatedName,
        updatedType,
        updatedCategory,
        updatedIsActive,
        updatedDisplayOrder,
        updatedOptions,
        id
      ]
    );

    res.json({ message: 'Point de contrôle mis à jour avec succès.' });
  } catch (error) {
    logger.error('Erreur lors de la mise à jour du point de contrôle:', error);
    res.status(500).json({ error: 'Erreur lors de la mise à jour du point de contrôle.' });
  }
});

// DELETE /admin/inspectionItems/:id - Delete an inspection item
router.delete('/inspectionItems/:id', isAuthenticated, isAdmin, async (req, res) => {
  const db = getDatabase();
  const { id } = req.params;

  try {
    const result = await dbRun(db, 'DELETE FROM InspectionItems WHERE item_id = ?', [id]);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Point de contrôle non trouvé.' });
    }
    res.json({ message: 'Point de contrôle supprimé avec succès.' });
  } catch (error) {
    logger.error('Erreur lors de la suppression du point de contrôle:', error);
    res.status(500).json({ error: 'Erreur lors de la suppression du point de contrôle.' });
  }
});

// ==================== Inspection Reports Management ====================

// GET /admin/reports - List all inspection reports
router.get('/reports', isAuthenticated, isAdmin, async (req, res) => {
  const db = getDatabase();
  try {
    const inspectionReports = await dbAll(db, `
      SELECT ir.report_id, ir.created_at, ir.created_at, v.license_plate, v.brand, v.model, 
             c.name as client_name, c.customer_id
      FROM InspectionReports ir
      LEFT JOIN Vehicules v ON ir.vehicule_id = v.vehicule_id
      LEFT JOIN Customers c ON v.customer_id = c.customer_id
      ORDER BY ir.created_at DESC
    `);
    res.json({ inspectionReports });
  } catch (error) {
    logger.error('Erreur lors de la récupération des rapports d\'inspection:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des rapports d\'inspection.' });
  }
});

// DELETE /admin/reports/:id - Delete an inspection report
router.delete('/reports/:id', isAuthenticated, isAdmin, async (req, res) => {
  const db = getDatabase();
  const { id } = req.params;

  try {
    const result = await dbRun(db, 'DELETE FROM InspectionReports WHERE report_id = ?', [id]);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Rapport d\'inspection non trouvé.' });
    }
    res.json({ message: 'Rapport d\'inspection supprimé avec succès.' });
  } catch (error) {
    logger.error('Erreur lors de la suppression du rapport d\'inspection:', error);
    res.status(500).json({ error: 'Erreur lors de la suppression du rapport d\'inspection.' });
  }
});

// ==================== Export the router ====================
module.exports = router;