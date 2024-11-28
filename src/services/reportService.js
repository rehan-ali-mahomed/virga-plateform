const { getDatabase } = require('../config/database');
const logger = require('../utils/logger');

function insertReport(data) {
  const db = getDatabase();

  return new Promise((resolve, reject) => {
    const {
      date, client_name, client_phone, comments, technician_id, vehicule_id
    } = data;

    const query = `
      INSERT INTO InspectionReports (
        report_id,
        vehicule_id,
        date,
        client_name,
        client_phone,
        comments,
        technician_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
      date, vehicule_id, client_name, client_phone,
      comments, technician_id
    ];

    logger.info('Executing SQL query:', query);
    logger.info('Query parameters:', params);

    db.run(query, params, function (err) {
      if (err) {
        logger.error('Database error:', err);
        reject(err);
      } else {
        logger.info(`Report inserted successfully. ID: ${this.lastID}`);
        resolve(this.lastID);
      }
    });
  });
}

module.exports = { insertReport };