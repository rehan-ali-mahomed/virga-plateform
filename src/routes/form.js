const express = require('express');
const { isAuthenticated } = require('../middleware/auth');
const { getDatabase, addVehicleStatus, addVehicle, getInspectionItems } = require('../config/database');
const { validateForm } = require('../utils/validation');
const logger = require('../utils/logger');

const router = express.Router();

router.get('/', isAuthenticated, async (req, res) => {
  try {
    const inspectionItems = await getInspectionItems();
    res.render('form', { 
      errors: null, 
      data: {}, 
      inspectionItems 
    });
  } catch (error) {
    logger.error('Error fetching inspection items:', error);
    res.status(500).render('form', { 
      errors: [{ msg: 'An error occurred while loading the form.' }],
      data: {},
      inspectionItems: []
    });
  }
});

router.post('/submit', isAuthenticated, validateForm, async (req, res) => {
  const db = getDatabase();
  const {
    license_plate, owner_name, contact_info,
    status_type, details, severity_level, repair_status, cost,
    inspection,
    comments,
    revision_oil_type, revision_torque, revision_oil_volume,
    brake_disc_thickness_front, brake_disc_thickness_rear
  } = req.body;

  try {
    // First, add or get the vehicle
    let vehicleId = await new Promise((resolve, reject) => {
      db.get('SELECT vehicle_id FROM Vehicles WHERE license_plate = ?', [license_plate], async (err, row) => {
        if (err) reject(err);
        else if (row) resolve(row.vehicle_id);
        else {
          const newVehicleId = await addVehicle(license_plate, owner_name, contact_info);
          resolve(newVehicleId);
        }
      });
    });

    // Then, add the vehicle status with inspection details
    const statusId = await addVehicleStatus(
      vehicleId,
      status_type,
      JSON.stringify({
        details,
        inspection,
        comments,
        revision: {
          oil_type: revision_oil_type,
          torque: revision_torque,
          oil_volume: revision_oil_volume,
          brake_disc_thickness_front,
          brake_disc_thickness_rear
        }
      }),
      severity_level,
      repair_status,
      cost,
      req.session.user.id
    );

    res.redirect(`/report/${statusId}`);
  } catch (error) {
    logger.error('Error submitting form:', error);
    res.status(500).render('form', { 
      data: req.body, 
      errors: [{ msg: 'An error occurred while submitting the form.' }] 
    });
  }
});

module.exports = router;
