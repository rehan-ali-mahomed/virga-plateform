require('dotenv').config();
const express = require('express');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const bodyParser = require('body-parser');
const path = require('path');
const helmet = require('helmet');
const morgan = require('morgan');

const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');
const formRoutes = require('./routes/form');
const reportRoutes = require('./routes/report');
const { initializeDatabase } = require('./config/database');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '..', 'public')));
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
    store: new SQLiteStore({ db: path.join(__dirname, '..', 'sessions.db') }),
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false, // Set to true if using HTTPS
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
  })
);

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Initialize database
initializeDatabase();

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
  console.log(`Server running on port ${PORT}`);
});
