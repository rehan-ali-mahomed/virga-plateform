const express = require('express');
const { isAuthenticated } = require('../middleware/auth');
const { getDatabase, addCarstatus, addVehicle, getInspectionItems } = require('../config/database');
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
  try {
    // Convert inspection values to integers
    if (req.body.inspection) {
      Object.keys(req.body.inspection).forEach(key => {
        req.body.inspection[key] = {
          value: parseInt(req.body.inspection[key], 10)
        };
      });
    }

    const reportId = await saveInspectionReport(req.body, req.user.user_id);
    res.redirect(`/report/${reportId}`);
  } catch (error) {
    logger.error('Error submitting form:', error);
    res.status(500).render('form', { 
      data: req.body, 
      errors: [{ msg: 'Une erreur est survenue lors de l\'enregistrement.' }],
      inspectionItems: req.inspectionItems || []
    });
  }
});

module.exports = router;
