require('dotenv').config();
const express = require('express');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const bodyParser = require('body-parser');
const path = require('path');
const helmet = require('helmet');
const morgan = require('morgan');
const { initializeDatabase } = require('./src/config/database');
const logger = require('./src/utils/logger');

const authRoutes = require('./src/routes/auth');
const dashboardRoutes = require('./src/routes/dashboard');
const formRoutes = require('./src/routes/form');
const reportRoutes = require('./src/routes/report');
const errorHandler = require('./src/middleware/errorHandler');

const fs = require('fs');
const sessionDir = path.join(__dirname, 'src', 'db');
if (!fs.existsSync(sessionDir)) {
  fs.mkdirSync(sessionDir, { recursive: true });
}

const app = express();

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'public', 'css')));
app.use(express.static(path.join(__dirname, 'public', 'images')));
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'",
        "'unsafe-inline'",
        "https://code.jquery.com",
        "https://cdn.jsdelivr.net",
        "https://stackpath.bootstrapcdn.com",
      ],
      styleSrc: [
        "'self'",
        "'unsafe-inline'",
        "https://stackpath.bootstrapcdn.com",
        "https://cdnjs.cloudflare.com",
      ],
      imgSrc: ["'self'", "data:"],
      fontSrc: ["'self'", "https://cdnjs.cloudflare.com"],
    },
  },
}));
app.use(morgan('dev'));

// Session configuration
app.use(
  session({
    store: new SQLiteStore({ 
      db: 'sessions.db', 
      dir: path.join(__dirname, 'src', 'db'),
      concurrentDB: true
    }),
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000 // 1 day
    }
  })
);

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

    // Error handling middleware
    app.use(errorHandler);

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

// Cleanup temporary PDF files
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

module.exports = app;
