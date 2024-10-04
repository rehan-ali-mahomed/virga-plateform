const { getDatabase } = require('../config/database');
const logger = require('../utils/logger');

function insertReport(data) {
  return new Promise((resolve, reject) => {
    const db = getDatabase();
    const {
      date, client_name, client_phone, vehicle_registration, vehicle_make,
      vehicle_model, mileage, next_inspection_date, interior, engine, front,
      rear, accessories, comments, revision_oil_type, revision_torque,
      revision_oil_volume, brake_disc_thickness_front, brake_disc_thickness_rear,
      work_completed
    } = data;

    const query = `
      INSERT INTO inspection_reports (
        date, client_name, client_phone, vehicle_registration, vehicle_make,
        vehicle_model, mileage, next_inspection_date, interior, engine, front,
        rear, accessories, comments, revision_oil_type, revision_torque,
        revision_oil_volume, brake_disc_thickness_front, brake_disc_thickness_rear,
        work_completed
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
      date, client_name, client_phone, vehicle_registration, vehicle_make,
      vehicle_model, mileage, next_inspection_date,
      JSON.stringify(interior || []),
      JSON.stringify(engine || []),
      JSON.stringify(front || []),
      JSON.stringify(rear || []),
      JSON.stringify(accessories || []),
      comments, revision_oil_type, revision_torque,
      revision_oil_volume, brake_disc_thickness_front, brake_disc_thickness_rear,
      JSON.stringify(work_completed || [])
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
