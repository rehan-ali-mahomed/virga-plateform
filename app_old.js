// app.js

require('dotenv').config();
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcrypt');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { body, validationResult } = require('express-validator');
const helmet = require('helmet');
const PDFDocument = require('pdfkit');

const app = express();
const db = new sqlite3.Database('./database.db');

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(helmet());

// Configure session
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: {
      secure: false, // Set to true if using HTTPS
      httpOnly: true,
      sameSite: 'strict',
    },
  })
);

// Set EJS as the templating engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Authentication middleware
function isAuthenticated(req, res, next) {
  if (req.session.user) return next();
  res.redirect('/login');
}

// Create tables if they don't exist
db.serialize(() => {
  // Users table
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username VARCHAR(50) UNIQUE,
    password VARCHAR(255)
  )`);

  // Insert default user
  const hashedPassword = bcrypt.hashSync('password', 10);
  db.run(`INSERT OR IGNORE INTO users (username, password) VALUES (?, ?)`, [
    'admin',
    hashedPassword,
  ]);

  // Inspection reports table
  db.run(`CREATE TABLE IF NOT EXISTS inspection_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date DATE,
    client_name VARCHAR(50),
    client_phone VARCHAR(10),
    vehicle_registration VARCHAR(10),
    vehicle_make VARCHAR(50),
    vehicle_model VARCHAR(50),
    mileage INT,
    next_inspection_date DATE,
    interior TEXT,
    engine TEXT,
    front TEXT,
    rear TEXT,
    accessories TEXT,
    comments TEXT,
    revision_oil_type VARCHAR(10),
    revision_torque VARCHAR(10),
    revision_oil_volume VARCHAR(10),
    brake_disc_thickness_front FLOAT,
    brake_disc_thickness_rear FLOAT,
    work_completed TEXT
  )`);
});

// Routes

// Login routes
app.get('/login', (req, res) => {
  res.render('login', { error: null });
});

// Registering routes
app.get('/register', (req, res) => {
    res.render('register', { error: null });
  });
  
  app.post('/register', (req, res) => {
    const { username, password } = req.body;
    const hashedPassword = bcrypt.hashSync(password, 10);
    db.run(
      `INSERT INTO users (username, password) VALUES (?, ?)`,
      [username, hashedPassword],
      function (err) {
        if (err) {
          console.error(err.message);
          res.render('register', { error: 'Username already exists.' });
        } else {
          res.redirect('/login');
        }
      }
    );
  });  

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  db.get('SELECT * FROM users WHERE username = ?', [username], (err, user) => {
    if (err) return res.render('error', { message: 'An error occurred' });
    if (user && bcrypt.compareSync(password, user.password)) {
      req.session.user = user;
      res.redirect('/');
    } else {
      res.render('login', { error: 'Invalid credentials' });
    }
  });
});

app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login');
});

// Main form route
app.get('/', isAuthenticated, (req, res) => {
  res.render('form', { errors: null, data: {} });
});

// Form submission route
app.post(
  '/submit',
  isAuthenticated,
  [
    // Validation and sanitization
    body('client_name').trim().escape().isLength({ max: 50 }),
    body('client_phone').trim().escape().isLength({ max: 10 }).isNumeric(),
    body('vehicle_registration').trim().escape().isLength({ max: 10 }),
    body('vehicle_make').trim().escape().isLength({ max: 50 }),
    body('vehicle_model').trim().escape().isLength({ max: 50 }),
    body('mileage').isInt({ max: 999999 }),
    body('next_inspection_date').optional({ checkFalsy: true }).isISO8601(),
    body('comments').trim().escape().isLength({ max: 255 }),
    // Add validation for other fields...
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).render('form', {
        errors: errors.array(),
        data: req.body,
      });
    }

    // Sanitize and process data
    const data = req.body;

    // Convert checkbox arrays to JSON strings
    const interior = JSON.stringify(data.interior || []);
    const engine = JSON.stringify(data.engine || []);
    const front = JSON.stringify(data.front || []);
    const rear = JSON.stringify(data.rear || []);
    const accessories = JSON.stringify(data.accessories || []);
    const work_completed = JSON.stringify(data.work_completed || []);

    db.run(
      `INSERT INTO inspection_reports (
        date, client_name, client_phone, vehicle_registration, vehicle_make,
        vehicle_model, mileage, next_inspection_date, interior, engine, front,
        rear, accessories, comments, revision_oil_type, revision_torque,
        revision_oil_volume, brake_disc_thickness_front, brake_disc_thickness_rear,
        work_completed
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.date,
        data.client_name,
        data.client_phone,
        data.vehicle_registration,
        data.vehicle_make,
        data.vehicle_model,
        data.mileage,
        data.next_inspection_date,
        interior,
        engine,
        front,
        rear,
        accessories,
        data.comments,
        data.revision_oil_type,
        data.revision_torque,
        data.revision_oil_volume,
        data.brake_disc_thickness_front,
        data.brake_disc_thickness_rear,
        work_completed,
      ],
      function (err) {
        if (err) {
          console.error(err.message);
          res.render('error', { message: 'An error occurred while submitting the report.' });
        } else {
          // Redirect to PDF generation
          res.redirect(`/report/${this.lastID}`);
        }
      }
    );
  }
);

// PDF generation route
app.get('/report/:id', isAuthenticated, (req, res) => {
  const reportId = req.params.id;

  db.get('SELECT * FROM inspection_reports WHERE id = ?', [reportId], (err, report) => {
    if (err || !report) {
      return res.status(404).render('error', { message: 'Report not found' });
    }

    // Create PDF document
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    let filename = `Inspection_Report_${reportId}.pdf`;

    res.setHeader('Content-disposition', 'attachment; filename="' + filename + '"');
    res.setHeader('Content-type', 'application/pdf');

    doc.pipe(res);

    // Add content to PDF (customize layout as per A4 format)
    // Header Section
    doc.image('public/company_logo.png', 50, 45, { width: 100 });
    doc.fontSize(20).text('Vehicle Inspection Report', 150, 50);

    doc.fontSize(12).text(`Date: ${report.date}`, 400, 50);
    doc.text(`Client Name: ${report.client_name}`, 400, 65);
    doc.text(`Client Phone: ${report.client_phone}`, 400, 80);

    // Vehicle Information Section
    doc.moveDown();
    doc.fontSize(14).text('Vehicle Information', { underline: true });
    doc.fontSize(12).text(`Registration: ${report.vehicle_registration}`);
    doc.text(`Make: ${report.vehicle_make}`);
    doc.text(`Model: ${report.vehicle_model}`);
    doc.text(`Mileage: ${report.mileage}`);
    doc.text(`Next Technical Inspection Date: ${report.next_inspection_date}`);

    // Continue adding content as per the requirement...

    doc.end();
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).render('error', { message: 'Internal Server Error' });
});

// Start the server
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
