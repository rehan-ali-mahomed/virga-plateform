require('dotenv').config({ path: process.env.SECRETS_PATH || '.env' });
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

// Load routes
const authRoutes = require('./src/routes/authRoutes');
const dashboardRoutes = require('./src/routes/dashboardRoutes');
const formRoutes = require('./src/routes/formRoutes');
const reportRoutes = require('./src/routes/reportRoutes');
const errorHandler = require('./src/middleware/errorHandler');
const { isAuthenticated } = require('./src/middleware/auth');
const adminRoutes = require('./src/routes/adminRoutes');

// Validate required environment variables
const requiredEnvVars = [
  // Admin Credentials
  'ADMIN_USERNAME',
  'ADMIN_PASSWORD',
  'ADMIN_EMAIL',
  'ADMIN_FIRST_NAME',
  'ADMIN_LAST_NAME',

  // Company Details
  'COMPANY_NAME',
  'COMPANY_ADDRESS',
  'COMPANY_PHONE',
  'COMPANY_EMAIL',

  // Security Keys
  'SESSION_SECRET',

  // Instance Information
  'INSTANCE_ID',
  'DOMAIN'
];

// Optional environment variables with defaults
const optionalEnvVars = {
  NODE_ENV: 'production',
  PORT: '3000',
  LOG_LEVEL: 'info',
  BCRYPT_SALT_ROUNDS: '12',
  MAX_LOGIN_ATTEMPTS: '4',
  LOCK_TIME: '15'
};

// Set default values for optional variables
Object.entries(optionalEnvVars).forEach(([key, value]) => {
  if (!process.env[key]) {
    process.env[key] = value;
  }
});

// Validate required variables
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    logger.error(`Missing required environment variable: ${envVar}`);
    process.exit(1);
  }
}

// Create session directory if it doesn't exist
const sessionDir = path.join(__dirname, 'src', 'db');
if (!fs.existsSync(sessionDir)) {
  fs.mkdirSync(sessionDir, { recursive: true });
}

const app = express();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https:'],
      scriptSrc: ["'self'", "'unsafe-inline'", 'https:'],
      imgSrc: ["'self'", 'data:', 'https:'],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/static', express.static(path.join(__dirname, 'public')));
app.use(morgan('combined', { stream: { write: message => logger.info(message.trim()) } }));

// Session configuration
const sessionConfig = {
  store: new SQLiteStore({
    dir: path.join(__dirname, 'src', 'db'),
    db: 'sessions.db',
    table: 'sessions'
  }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: 'strict'
  }
};

if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
  sessionConfig.cookie.secure = true;
}

app.use(session(sessionConfig));

// Flash middleware
app.use(flash());

// Add locals middleware
app.use((req, res, next) => {
  res.locals.success = req.flash('success') || [];
  res.locals.error = req.flash('error') || [];
  res.locals.user = req.session.user || null;
  res.locals.company = {
    name: process.env.COMPANY_NAME,
    address: process.env.COMPANY_ADDRESS,
    phone: process.env.COMPANY_PHONE,
    email: process.env.COMPANY_EMAIL
  };
  next();
});

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'src', 'views'));

// Authentication middleware for default route
app.use('/', (req, res, next) => {
  // Skip auth check for login-related routes
  const publicPaths = ['/login', '/auth/login', '/health'];
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

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/auth', authRoutes);
app.use('/dashboard', isAuthenticated, dashboardRoutes);
app.use('/form', isAuthenticated, formRoutes);
app.use('/report', isAuthenticated, reportRoutes);
app.use('/admin', isAuthenticated, adminRoutes);

// Serve generated reports only to authenticated users
app.use('/generated_reports', isAuthenticated, express.static(path.join(__dirname, 'generated_reports')));

// Error handler
app.use(errorHandler);

// 404 handler
app.use((req, res) => {
  res.status(404).render('error', {
    message: 'Page not found',
    errors: [],
    user: req.session.user
  });
});

// Initialize database before starting the server
initializeDatabase()
  .then(() => {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV}`);
      logger.info(`Company: ${process.env.COMPANY_NAME}`);
    });
  })
  .catch((err) => {
    logger.error('Failed to initialize database:', err);
    process.exit(1);
  });

module.exports = app;