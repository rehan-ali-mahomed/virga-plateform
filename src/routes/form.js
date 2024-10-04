const express = require('express');
const { isAuthenticated } = require('../middleware/auth');
const { validateForm } = require('../utils/validation');
const { insertReport } = require('../services/reportService');
const logger = require('../utils/logger');

const router = express.Router();

router.get('/', isAuthenticated, (req, res) => {
  res.render('form', { errors: null, data: {} });
});

router.post('/', isAuthenticated, validateForm, async (req, res) => {
  try {
    logger.info('Attempting to insert report:', req.body);
    const reportId = await insertReport(req.body);
    logger.info(`Report inserted successfully. ID: ${reportId}`);
    res.redirect('/dashboard');
  } catch (err) {
    logger.error('Error inserting report:', err);
    res.status(500).render('form', { 
      errors: [{ msg: 'An error occurred while submitting the report. Please try again.' }], 
      data: req.body 
    });
  }
});

module.exports = router;
