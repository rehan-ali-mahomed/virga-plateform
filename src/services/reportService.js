const { db } = require('../config/database');

function insertReport(data, callback) {
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

  db.run(query, [
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
  ], function (err) {
    if (err) {
      callback(err);
    } else {
      callback(null, this.lastID);
    }
  });
}

module.exports = { insertReport };
