const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const path = require('path');

const db = new sqlite3.Database(path.join(__dirname, '..', '..', 'database.db'));

function initializeDatabase() {
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
}

module.exports = { db, initializeDatabase };