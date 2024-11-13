const express = require('express');
const router = express.Router();
const { saveInspectionReport, getInspectionItems } = require('../config/database');
const { isAuthenticated } = require('../middleware/auth');
const logger = require('../utils/logger');

// GET route for rendering the form
router.get('/', isAuthenticated, async (req, res) => {
  try {
    const inspectionItems = await getInspectionItems();
    
    res.render('form', {
      inspectionItems,
      data: {},
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

    // Format inspection results as JSON
    const inspectionResults = {};
    Object.entries(inspection || {}).forEach(([itemId, checked]) => {
      inspectionResults[itemId] = checked === 'true';
    });

    const reportData = {
      date,
      client_name,
      client_phone,
      license_plate,
      revision_oil_type,
      revision_oil_volume,
      brake_disc_thickness_front,
      brake_disc_thickness_rear,
      comments,
      inspection_results: JSON.stringify(inspectionResults)
    };

    const reportId = await saveInspectionReport(reportData, req.session.user.id);
    req.flash('success', 'Report created successfully');
    return res.redirect(`/report/${reportId}`);
  } catch (error) {
    logger.error('Error saving report:', error);
    const inspectionItems = await getInspectionItems();
    req.flash('error', 'Error saving report');
    return res.render('form', {
      inspectionItems,
      data: req.body,
      user: req.session.user
    });
  }
});

module.exports = router;