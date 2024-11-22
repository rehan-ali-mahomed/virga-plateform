const express = require('express');
const router = express.Router();
const { isAuthenticated } = require('../middleware/auth');
const { getDatabase } = require('../config/database');
const logger = require('../utils/logger');

router.get('/', isAuthenticated, async (req, res) => {
  const db = getDatabase();
  
  try {
    // Get recent inspection reports with vehicle and technician info
    const reports = await new Promise((resolve, reject) => {
      db.all(`
        SELECT 
          ir.report_id,
          ir.created_at,
          v.license_plate,
          v.owner_name as client_name,
          u.username as username
        FROM InspectionReports ir
        JOIN Cars v ON ir.vehicle_id = v.vehicle_id
        LEFT JOIN Users u ON ir.created_by = u.user_id
        ORDER BY ir.created_at DESC
        LIMIT 10
      `, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    // No need to pass user explicitly as it's already in res.locals
    res.render('dashboard', {
      reports: reports || [],
      errors: []
    });
  } catch (error) {
    logger.error('Error loading dashboard:', error);
    res.render('dashboard', {
      reports: [],
      errors: ['Erreur lors du chargement des rapports']
    });
  }
});

// ... rest of the code ...

// Login post route
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const db = getDatabase();

  try {
    const user = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM Users WHERE username = ?', [username], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!user) {
      return res.render('login', { error: 'Utilisateur non trouvé' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.render('login', { error: 'Mot de passe incorrect' });
    }

    // Store user in session with all necessary data
    req.session.user = {
      user_id: user.user_id,
      username: user.username,
      role: user.role,
      contact_info: user.contact_info,
      specialization: user.specialization
    };

    // Ensure session is saved before redirect
    req.session.save((err) => {
      if (err) {
        logger.error('Session save error:', err);
        return res.render('login', { error: 'Erreur lors de la connexion' });
      }
      res.redirect('/dashboard');
    });
  } catch (error) {
    logger.error('Login error:', error);
    res.render('login', { error: 'Erreur lors de la connexion' });
  }
});

module.exports = router; 