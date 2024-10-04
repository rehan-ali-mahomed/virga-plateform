const express = require('express');
const { isAuthenticated } = require('../middleware/auth');
const { validateForm } = require('../utils/validation');
const { insertReport } = require('../services/reportService');

const router = express.Router();

router.get('/', isAuthenticated, (req, res) => {
  res.render('form', { errors: null, data: {} });
});

router.post('/', isAuthenticated, validateForm, (req, res) => {
  insertReport(req.body, (err, reportId) => {
    if (err) {
      res.render('error', { message: 'An error occurred while submitting the report.' });
    } else {
      res.redirect(`/report/${reportId}`);
    }
  });
});

module.exports = router;
