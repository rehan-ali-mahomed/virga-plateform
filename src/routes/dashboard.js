const express = require('express');
const { isAuthenticated } = require('../middleware/auth');
const { getDatabase } = require('../config/database');
const logger = require('../utils/logger');

const router = express.Router();

router.get('/', isAuthenticated, (req, res) => {
  const db = getDatabase();
  db.all('SELECT * FROM inspection_reports ORDER BY date DESC', (err, reports) => {
    if (err) {
      logger.error('Database error:', err);
      return res.status(500).render('error', { message: 'An error occurred while loading the dashboard.' });
    }
    res.render('dashboard', { user: req.session.user, reports });
  });
});

module.exports = router;
