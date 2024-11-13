const express = require('express');
const bcrypt = require('bcrypt');
const { getDatabase, addUser } = require('../config/database');
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
      db.get('SELECT * FROM Users WHERE user_name = ?', [username], (err, row) => {
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
      username: user.user_name, 
      role: user.role 
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

router.post('/register', async (req, res) => {
  try {
    const { userName, email, phone, role, specialization, password } = req.body;
    const userId = await addUser(userName, email, phone, role, specialization, password);
    // ... rest of the registration logic
  } catch (error) {
    logger.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

module.exports = router;
