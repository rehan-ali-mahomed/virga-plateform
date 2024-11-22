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
      inspectionItems,
      user: req.session.user
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
    const userId = req.user.id;
    await submitForm(req, res, userId);
  } catch (error) {
    res.status(500).render('form', {
      data: req.body,
      errors: [{ msg: 'Une erreur est survenue lors de l\'enregistrement.' }],
      inspectionItems: req.inspectionItems || []
    });
  }
});

module.exports = router;