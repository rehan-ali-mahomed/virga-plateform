const express = require('express');
const router = express.Router();
const { getDatabase, getInspectionItems } = require('../config/database');
const { isAuthenticated } = require('../middleware/auth');
const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');

// GET route for rendering the form
router.get('/', isAuthenticated, async (req, res) => {
  try {
    const inspectionItems = await getInspectionItems();
    const license_plate = req.query.license_plate;
    let vehicleData = {};

    if (license_plate) {
      const db = getDatabase();
      vehicleData = await new Promise((resolve, reject) => {
        db.get(
          `SELECT * FROM Vehicules WHERE license_plate = ?`,
          [license_plate],
          (err, row) => {
            if (err) reject(err);
            else resolve(row || {});
          }
        );
      });
    }
    
    res.render('form', {
      inspectionItems,
      data: {
        ...vehicleData,
        license_plate: license_plate || ''
      },
      errors: [],
      user: req.session.user
    });
  } catch (error) {
    logger.error('Error loading form:', error);
    res.render('error', {
      message: 'Error loading form',
      errors: [error.message],
      user: req.session.user
    });
  }
});

// POST route for form submission
router.post('/submit', isAuthenticated, async (req, res) => {
  try {
    const {
      date, client_name, client_phone, license_plate,
      revision_oil_type, revision_oil_volume,
      brake_disc_thickness_front, brake_disc_thickness_rear,
      comments, inspection
    } = req.body;

    // Basic validation
    if (!date || !client_name || !license_plate) {
      const inspectionItems = await getInspectionItems();
      return res.render('form', {
        inspectionItems,
        data: req.body,
        errors: ['Please fill in all required fields'],
        user: req.session.user
      });
    }

    const db = getDatabase();

    // First, update or create vehicle
    await new Promise((resolve, reject) => {
      db.run(`
        INSERT INTO Vehicules (
          vehicle_id,
          license_plate,
          revision_oil_type,
          revision_oil_volume,
          brake_disc_thickness_front,
          brake_disc_thickness_rear
        ) VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(license_plate) DO UPDATE SET
          revision_oil_type = excluded.revision_oil_type,
          revision_oil_volume = excluded.revision_oil_volume,
          brake_disc_thickness_front = excluded.brake_disc_thickness_front,
          brake_disc_thickness_rear = excluded.brake_disc_thickness_rear
      `, [
        uuidv4(),
        license_plate,
        revision_oil_type,
        revision_oil_volume,
        brake_disc_thickness_front,
        brake_disc_thickness_rear
      ], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    // Get vehicle_id
    const vehicle = await new Promise((resolve, reject) => {
      db.get('SELECT vehicle_id FROM Vehicules WHERE license_plate = ?',
        [license_plate],
        (err, row) => {
          if (err) reject(err);
          else if (!row) reject(new Error('Vehicle not found'));
          else resolve(row);
        });
    });

    // Format inspection results
    const inspectionResults = {};
    Object.entries(inspection || {}).forEach(([itemId, value]) => {
      inspectionResults[itemId] = {
        value: value === 'true' ? true : value === 'false' ? false : value,
        type: typeof value === 'boolean' || value === 'true' || value === 'false' ? 'checkbox' : 'text'
      };
    });

    // Create inspection report
    const reportId = await new Promise((resolve, reject) => {
      db.run(`
        INSERT INTO InspectionReports (
          report_id,
          vehicle_id,
          date,
          client_name,
          client_phone,
          comments,
          inspection_results,
          technician_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        uuidv4(),
        vehicle.vehicle_id,
        date,
        client_name,
        client_phone,
        comments,
        JSON.stringify(inspectionResults),
        req.session.user.id
      ], function(err) {
        if (err) reject(err);
        else resolve(this.lastID);
      });
    });

    req.flash('success', 'Report created successfully');
    return res.redirect(`/report/${reportId}`);
  } catch (error) {
    logger.error('Error saving report:', error);
    const inspectionItems = await getInspectionItems();
    return res.render('form', {
      inspectionItems,
      data: req.body,
      errors: ['Error saving report'],
      user: req.session.user
    });
  }
});

module.exports = router;