const express = require('express');
const bcrypt = require('bcrypt');
const { getUserWithPasswordByUsername } = require('../config/database');
const logger = require('../utils/logger');

const router = express.Router();

router.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  next();
});

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
  console.log('username => ', username);
  console.log('password => ', password);

  try {
    const user = await getUserWithPasswordByUsername(username);

    logger.debug('User => ', user);

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
    
    const isValidPassword = await bcrypt.compareSync(password, user.password);
    logger.debug(`Password dont matches => ${user.password} and ${bcrypt.hashSync(password, 12)} for password => ${password}`);

    if (!isValidPassword) {
      logger.debug('Invalid password for user => ', user.username, ' (', user.user_id, ')');
      return res.render('login', { 
        error: 'Mot de passe incorrect',
        errors: [],
        user: null
      });
    }

    req.session.user = {
      id: user.user_id, 
      first_name: user.first_name,
      last_name: user.last_name,
      email: user.email,
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
    res.redirect('/auth/login');
  });
});

module.exports = router;
