const express = require('express');
const bcrypt = require('bcrypt');
const { getDatabase } = require('../config/database');
const logger = require('../utils/logger');

const router = express.Router();

router.get('/login', (req, res) => {
  if (req.session.user) {
    return res.redirect('/dashboard');
  }
  res.render('login', { 
    error: null,
    errors: [],
    user: null
  });
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const db = getDatabase();

  try {
    const user = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM Users WHERE username = ?', [username.toLowerCase()], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!user) {
      return res.render('login', { 
        error: 'Invalid username or password',
        errors: [],
        user: null
      });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.render('login', { 
        error: 'Invalid username or password',
        errors: [],
        user: null
      });
    }

    req.session.user = {
      id: user.user_id, 
      username: user.username, 
      role: user.role.toLowerCase()
    };
    res.redirect('/dashboard');
  } catch (err) {
    logger.error('Login error:', err);
    res.render('login', { 
      error: 'An error occurred during login',
      errors: [],
      user: null
    });
  }
});

router.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) logger.error('Session destruction error:', err);
    res.redirect('/login');
  });
});

module.exports = router;
