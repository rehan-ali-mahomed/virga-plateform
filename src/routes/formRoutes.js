const express = require('express');
const router = express.Router();
const { getDatabase, getInspectionItems } = require('../config/database');

// GET form page
router.get('/', async (req, res) => {
  try {
    const inspectionItems = await getInspectionItems();
    res.render('form', { 
      data: {},
      errors: [],
      inspectionItems: inspectionItems
    });
  } catch (error) {
    console.error('Error fetching inspection items:', error);
    res.status(500).send('Internal Server Error');
  }
});

// POST form submission
router.post('/submit', async (req, res) => {
  try {
    // ... validation logic ...

    if (errors.length > 0) {
      const inspectionItems = await getInspectionItems();
      return res.render('form', { 
        data: req.body,
        errors: errors,
        inspectionItems: inspectionItems
      });
    }

    // ... save form data logic ...

    res.redirect('/dashboard');
  } catch (error) {
    console.error('Error processing form:', error);
    const inspectionItems = await getInspectionItems();
    res.render('form', { 
      data: req.body,
      errors: [{ msg: 'An error occurred while processing your request.' }],
      inspectionItems: inspectionItems
    });
  }
});

module.exports = router; 