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
const morgan = require('morgan');

const app = express();
const db = new sqlite3.Database('./database.db');

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(helmet());
app.use(morgan('dev'));

// Configure session
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: {
      secure: false, // Mettez true si vous utilisez HTTPS
      httpOnly: true,
      sameSite: 'strict',
    },
  })
);

// Définir EJS comme moteur de template
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware d'authentification
function isAuthenticated(req, res, next) {
  if (req.session.user) return next();
  res.redirect('/login');
}

// Création des tables si elles n'existent pas
db.serialize(() => {
  console.log('Initialisation de la base de données...');

  // Table users
  db.run(
    `CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username VARCHAR(50) UNIQUE,
      password VARCHAR(255)
    )`,
    (err) => {
      if (err) {
        console.error('Erreur lors de la création de la table users:', err.message);
      } else {
        console.log('Table users vérifiée/créée.');
      }
    }
  );

  // Insertion de l'utilisateur par défaut
  const hashedPassword = bcrypt.hashSync('password', 10);
  db.run(
    `INSERT OR IGNORE INTO users (username, password) VALUES (?, ?)`,
    ['admin', hashedPassword],
    function (err) {
      if (err) {
        console.error("Erreur lors de l'insertion de l'utilisateur par défaut:", err.message);
      } else {
        console.log('Utilisateur par défaut créé ou déjà existant.');
      }
    }
  );

  // Table inspection_reports
  db.run(
    `CREATE TABLE IF NOT EXISTS inspection_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date DATE,
      client_name VARCHAR(50),
      client_phone VARCHAR(15),
      vehicle_registration VARCHAR(20),
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
      revision_oil_type VARCHAR(50),
      revision_torque VARCHAR(50),
      revision_oil_volume VARCHAR(50),
      brake_disc_thickness_front FLOAT,
      brake_disc_thickness_rear FLOAT,
      work_completed TEXT
    )`,
    (err) => {
      if (err) {
        console.error('Erreur lors de la création de la table inspection_reports:', err.message);
      } else {
        console.log('Table inspection_reports vérifiée/créée.');
      }
    }
  );
});

// Routes

// Route de connexion
app.get('/login', (req, res) => {
  console.log('Accès à la page de connexion');
  res.render('login', { error: null });
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  console.log(`Tentative de connexion avec l'utilisateur: ${username}`);

  db.get('SELECT * FROM users WHERE username = ?', [username], (err, user) => {
    if (err) {
      console.error("Erreur lors de la récupération de l'utilisateur:", err.message);
      return res.render('error', { message: 'Une erreur est survenue' });
    }

    if (user) {
      console.log('Utilisateur trouvé dans la base de données:', user.username);

      const passwordMatch = bcrypt.compareSync(password, user.password);
      console.log(`Résultat de la comparaison des mots de passe: ${passwordMatch}`);

      if (passwordMatch) {
        req.session.user = user;
        console.log('Connexion réussie. Redirection vers le tableau de bord.');
        res.redirect('/dashboard');
      } else {
        console.log('Le mot de passe est incorrect.');
        res.render('login', { error: 'Identifiants invalides' });
      }
    } else {
      console.log('Utilisateur non trouvé dans la base de données.');
      res.render('login', { error: 'Identifiants invalides' });
    }
  });
});

app.get('/logout', (req, res) => {
  console.log("Déconnexion de l'utilisateur.");
  req.session.destroy();
  res.redirect('/login');
});

// Redirection de la racine vers le tableau de bord
app.get('/', isAuthenticated, (req, res) => {
  res.redirect('/dashboard');
});

// Route du tableau de bord
app.get('/dashboard', isAuthenticated, (req, res) => {
  db.all('SELECT * FROM inspection_reports ORDER BY date DESC', (err, reports) => {
    if (err) {
      console.error('Erreur lors de la récupération des rapports :', err.message);
      res.render('error', { message: 'Une erreur est survenue lors du chargement du tableau de bord.' });
    } else {
      res.render('dashboard', { user: req.session.user, reports });
    }
  });
});

// Route pour afficher le formulaire
app.get('/form', isAuthenticated, (req, res) => {
  res.render('form', { errors: null, data: {} });
});

// Route de soumission du formulaire
app.post(
  '/submit',
  isAuthenticated,
  [
    // Validation et assainissement
    body('client_name').trim().escape().isLength({ max: 50 }),
    body('client_phone').trim().escape().isLength({ max: 15 }),
    body('vehicle_registration').trim().escape().isLength({ max: 20 }),
    body('vehicle_make').trim().escape().isLength({ max: 50 }),
    body('vehicle_model').trim().escape().isLength({ max: 50 }),
    body('mileage').isInt({ max: 9999999 }),
    body('next_inspection_date').optional({ checkFalsy: true }).isISO8601(),
    body('comments').trim().escape().isLength({ max: 255 }),
    body('front_tires').notEmpty().withMessage('Veuillez sélectionner l\'état des pneus avant.'),
    body('rear_tires').notEmpty().withMessage('Veuillez sélectionner l\'état des pneus arrière.'),
    body('front_lights').notEmpty().withMessage('Veuillez sélectionner l\'état des phares avant.'),
    body('rear_lights').notEmpty().withMessage('Veuillez sélectionner l\'état des phares arrière.'),
    body('front_brake_pads').notEmpty().withMessage('Veuillez sélectionner l\'état des plaquettes de frein avant.'),
    body('rear_brake_pads').notEmpty().withMessage('Veuillez sélectionner l\'état des plaquettes de frein arrière.'),
    body('front_shock_absorbers').notEmpty().withMessage('Veuillez sélectionner l\'état des amortisseurs avant.'),
    body('rear_shock_absorbers').notEmpty().withMessage('Veuillez sélectionner l\'état des amortisseurs arrière.'),
    // Ajoutez la validation pour les autres champs...
  ],
  (req, res) => {
    console.log("Soumission du formulaire par l'utilisateur:", req.session.user.username);
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('Erreurs de validation:', errors.array());
      return res.status(400).render('form', {
        errors: errors.array(),
        data: req.body,
      });
    }

    // Assainissement et traitement des données
    const data = req.body;

    // Conversion des tableaux de cases à cocher en chaînes JSON
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
          console.error("Erreur lors de l'insertion du rapport d'inspection:", err.message);
          res.render('error', { message: 'Une erreur est survenue lors de la soumission du rapport.' });
        } else {
          console.log("Rapport d'inspection inséré avec succès, ID:", this.lastID);
          // Redirection vers la génération du PDF
          res.redirect(`/report/${this.lastID}`);
        }
      }
    );
  }
);

// New route for PDF preview
app.get('/preview/:id', isAuthenticated, (req, res) => {
  const reportId = req.params.id;
  console.log('Génération du PDF pour prévisualisation, rapport ID:', reportId);

  db.get('SELECT * FROM inspection_reports WHERE id = ?', [reportId], (err, report) => {
    if (err) {
      console.error('Erreur lors de la récupération du rapport:', err.message);
      return res.status(500).json({ error: 'Une erreur est survenue lors de la génération du rapport.' });
    }

    if (!report) {
      console.log("Rapport non trouvé pour l'ID:", reportId);
      return res.status(404).json({ error: 'Rapport non trouvé' });
    }

    // Création du document PDF
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    let chunks = [];

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => {
      let pdfData = Buffer.concat(chunks);
      res.setHeader('Content-Type', 'application/pdf');
      res.send(pdfData);
    });

    // Add PDF content (same as in the /report/:id route)
    doc.image('public/company_logo.png', 50, 45, { width: 100 });
    doc.fontSize(20).text("Rapport d'inspection du véhicule", 150, 50);

    doc.fontSize(12).text(`Date : ${report.date}`, 400, 50);
    doc.text(`Nom du client : ${report.client_name}`, 400, 65);
    doc.text(`Téléphone du client : ${report.client_phone}`, 400, 80);

    // Informations du véhicule
    doc.moveDown();
    doc.fontSize(14).text('Informations du véhicule', { underline: true });
    doc.fontSize(12).text(`Immatriculation : ${report.vehicle_registration}`);
    doc.text(`Marque : ${report.vehicle_make}`);
    doc.text(`Modèle : ${report.vehicle_model}`);
    doc.text(`Kilométrage : ${report.mileage}`);
    doc.text(`Prochaine date de contrôle technique : ${report.next_inspection_date}`);

    // Add other sections as needed...

    doc.end();
  });
});

// Modify the existing /report/:id route
app.get('/report/:id', isAuthenticated, (req, res) => {
  const reportId = req.params.id;
  console.log('Génération du PDF pour téléchargement, rapport ID:', reportId);

  db.get('SELECT * FROM inspection_reports WHERE id = ?', [reportId], (err, report) => {
    if (err) {
      console.error('Erreur lors de la récupération du rapport:', err.message);
      return res.status(500).render('error', { message: 'Une erreur est survenue lors de la génération du rapport.' });
    }

    if (!report) {
      console.log("Rapport non trouvé pour l'ID:", reportId);
      return res.status(404).render('error', { message: 'Rapport non trouvé' });
    }

    // Création du document PDF
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    let filename = `Rapport_Inspection_${reportId}.pdf`;

    res.setHeader('Content-disposition', 'attachment; filename="' + filename + '"');
    res.setHeader('Content-type', 'application/pdf');

    doc.pipe(res);

    // Ajout de contenu au PDF (personnalisez la mise en page selon vos besoins)
    // Section d'en-tête
    doc.image('public/company_logo.png', 50, 45, { width: 100 });
    doc.fontSize(20).text("Rapport d'inspection du véhicule", 150, 50);

    doc.fontSize(12).text(`Date : ${report.date}`, 400, 50);
    doc.text(`Nom du client : ${report.client_name}`, 400, 65);
    doc.text(`Téléphone du client : ${report.client_phone}`, 400, 80);

    // Informations du véhicule
    doc.moveDown();
    doc.fontSize(14).text('Informations du véhicule', { underline: true });
    doc.fontSize(12).text(`Immatriculation : ${report.vehicle_registration}`);
    doc.text(`Marque : ${report.vehicle_make}`);
    doc.text(`Modèle : ${report.vehicle_model}`);
    doc.text(`Kilométrage : ${report.mileage}`);
    doc.text(`Prochaine date de contrôle technique : ${report.next_inspection_date}`);

    // Ajoutez d'autres sections selon vos besoins...

    doc.end();
    console.log('PDF généré et envoyé au client.');
  });
});

// Middleware de gestion des erreurs
app.use((err, req, res, next) => {
  console.error('Erreur non gérée:', err.stack);
  res.status(500).render('error', { message: 'Erreur interne du serveur' });
});

// Démarrage du serveur
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Serveur en cours d'exécution sur le port ${PORT}`);
});