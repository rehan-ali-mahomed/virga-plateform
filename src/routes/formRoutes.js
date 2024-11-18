const express = require('express');
const router = express.Router();
const { isAuthenticated } = require('../middleware/auth');
const { submitForm } = require('../controllers/formController');
const { getInspectionItems } = require('../config/database');

router.get('/', isAuthenticated, async (req, res) => {
  try {
    const inspectionItems = await getInspectionItems();
    res.render('form', { 
      errors: null, 
      data: {}, 
      inspectionItems 
    });
  } catch (error) {
    res.status(500).render('error', { 
      message: 'Error loading form',
      error: error
    });
  }
});

router.post('/submit', isAuthenticated, async (req, res) => {
  try {
    const inspectionItems = await getInspectionItems();
    req.inspectionItems = inspectionItems;
    await submitForm(req, res);
  } catch (error) {
    res.status(500).render('form', {
      data: req.body,
      errors: [{ msg: 'Une erreur est survenue lors de l\'enregistrement.' }],
      inspectionItems: req.inspectionItems || []
    });
  }
});

module.exports = router;