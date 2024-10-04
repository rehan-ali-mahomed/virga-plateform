const express = require('express');
const { isAuthenticated } = require('../middleware/auth');
const { db } = require('../config/database');

const router = express.Router();

router.get('/', isAuthenticated, (req, res) => {
  db.all('SELECT * FROM inspection_reports ORDER BY date DESC', (err, reports) => {
    if (err) {
      res.render('error', { message: 'An error occurred while loading the dashboard.' });
    } else {
      res.render('dashboard', { user: req.session.user, reports });
    }
  });
});

module.exports = router;
