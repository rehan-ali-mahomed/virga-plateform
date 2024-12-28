require('dotenv').config();
const express = require('express');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const flash = require('connect-flash');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const { initializeDatabase } = require('./src/config/database');
const logger = require('./src/utils/logger');
const https = require('https');
const fs = require('fs');
const authRoutes = require('./src/routes/authRoutes');
const dashboardRoutes = require('./src/routes/dashboardRoutes');
const formRoutes = require('./src/routes/formRoutes');
const reportRoutes = require('./src/routes/reportRoutes');
const errorHandler = require('./src/middleware/errorHandler');
const { isAuthenticated } = require('./src/middleware/auth');
const adminRoutes = require('./src/routes/adminRoutes');

// Create session directory if it doesn't exist
const sessionDir = path.join(__dirname, 'src', 'db');
if (!fs.existsSync(sessionDir)) {
  fs.mkdirSync(sessionDir, { recursive: true });
}

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/static', express.static(path.join(__dirname, 'public')));
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https:'],
      scriptSrc: ["'self'", "'unsafe-inline'", 'https:'],
      imgSrc: ["'self'", 'data:', 'https:'],
    },
  },
}));
app.use(morgan('dev'));

// Session configuration
app.use(
  session({
    store: new SQLiteStore({
      dir: path.join(__dirname, 'src', 'db'),
      db: 'sessions.db',
      table: 'sessions'
    }),
    secret: process.env.SESSION_SECRET || 'default-secret-key-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: true,
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000
    }
  })
);

// Flash middleware
app.use(flash());

// Add locals middleware
app.use((req, res, next) => {
  res.locals.success = req.flash('success') || [];
  res.locals.error = req.flash('error') || [];
  res.locals.user = req.session.user || null;
  next();
});

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'src', 'views'));

// Authentication middleware for default route
app.use('/', (req, res, next) => {
  // Skip auth check for login-related routes
  const publicPaths = ['/login'];
  if (publicPaths.includes(req.path)) {
    return next();
  }

  // For the root path, redirect based on auth status
  if (req.path === '/') {
    if (req.session && req.session.user) {
      logger.debug(`Redirecting authenticated user (${req.session.user.username}) to dashboard`);
      return res.redirect('/dashboard');
    } else {
      return res.redirect('/login');
    }
  }

  next();
});

// if SSL_KEY_PATH, SSL_CERT_PATH, SSL_CA_PATH are set, use them
if (process.env.SSL_KEY_PATH && process.env.SSL_CERT_PATH && process.env.SSL_CA_PATH) {
  // SSL/TLS configuration using PEM file
  const sslOptions = {
    key: fs.readFileSync(process.env.SSL_KEY_PATH),
  cert: fs.readFileSync(process.env.SSL_CERT_PATH),
  ca: [
    fs.readFileSync(process.env.SSL_CA_PATH),
  ],
    rejectUnauthorized: false
  };
}

// Initialize database before starting the server
initializeDatabase()
  .then(() => {
    logger.debug('Database initialized');

    // Routes
    app.use('/', authRoutes);
    
    // Protected routes
    app.use('/dashboard', isAuthenticated, dashboardRoutes);
    app.use('/form', isAuthenticated, formRoutes);
    app.use('/report', isAuthenticated, reportRoutes);
    app.use('/admin', isAuthenticated, adminRoutes);

    // Serve generated reports only to authenticated users
    app.use('/generated_reports', isAuthenticated, express.static(path.join(__dirname, 'generated_reports')));

    // Error handling middleware
    app.use(errorHandler);

    // 404 handler
    app.use((req, res) => {
      res.status(404).render('error', {
        message: 'Page not found',
        errors: [],
        user: req.session.user
      });
    });

    // Start the HTTPS server if SSL_KEY_PATH, SSL_CERT_PATH, SSL_CA_PATH are set
    if (process.env.SSL_KEY_PATH && process.env.SSL_CERT_PATH && process.env.SSL_CA_PATH) {
      const PORT = process.env.PORT || 3000;
      https.createServer(sslOptions, app).listen(PORT, () => {
        logger.info(`HTTPS Server running on port ${PORT}`);
      });
    } else {
      // Start the HTTP server
      const PORT = process.env.PORT || 3000;
      app.listen(PORT, () => {
        logger.info(`HTTP Server running on port ${PORT}`);
      });
    }
  })
  .catch((err) => {
    logger.error('Failed to initialize database:', err);
    process.exit(1);
  });

module.exports = app;