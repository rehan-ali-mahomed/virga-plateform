const express = require('express');
const bcrypt = require('bcrypt');
const { getUserWithPasswordByUsername } = require('../config/database');
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

  try {
    const user = await getUserWithPasswordByUsername(username);

    if (!user) {
      return res.render('login', { 
        error: 'Invalid username',
        errors: [],
        user: null
      });
    }

    if (!user.is_active) {
      return res.render('login', { 
        error: 'User is disabled, contact your administrator',
        errors: [],
        user: null
      });
    }
    
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.render('login', { 
        error: 'Invalid password',
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
