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

const authRoutes = require('./src/routes/auth');
const dashboardRoutes = require('./src/routes/dashboard');
const formRoutes = require('./src/routes/formRoutes');
const reportRoutes = require('./src/routes/report');
const errorHandler = require('./src/middleware/errorHandler');

const fs = require('fs');
const { isAuthenticated } = require('./src/middleware/auth');
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
      secure: process.env.NODE_ENV === 'production',
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

// Initialize database before starting the server
initializeDatabase()
  .then(() => {
    // Routes
    app.use('/', authRoutes);
    app.use('/dashboard', dashboardRoutes);
    app.use('/form', formRoutes);
    app.use('/report', reportRoutes);

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

    // Start the server
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    logger.error('Failed to initialize database:', err);
    process.exit(1);
  });

// Ensure temp directory exists
const tempDir = path.join(__dirname, 'temp');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

/* // Cleanup temporary PDF files
const cleanupTempFiles = () => {
  fs.readdir(tempDir, (err, files) => {
    if (err) {
      logger.error('Error reading temp directory:', err);
      return;
    }
    files.forEach(file => {
      const filePath = path.join(tempDir, file);
      fs.stat(filePath, (err, stats) => {
        if (err) {
          logger.error('Error getting file stats:', err);
          return;
        }
        const now = new Date().getTime();
        const endTime = new Date(stats.ctime).getTime() + 24 * 60 * 60 * 1000; // 24 hours
        if (now > endTime) {
          fs.unlink(filePath, err => {
            if (err) {
              logger.error('Error deleting file:', err);
            } else {
              logger.info(`Deleted old temporary file: ${file}`);
            }
          });
        }
      });
    });
  });
}; 

// Run cleanup every hour
setInterval(cleanupTempFiles, 60 * 60 * 1000);
*/

module.exports = app;
