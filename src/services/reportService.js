const { getDatabase } = require('../config/database');
const logger = require('../utils/logger');

function insertReport(data) {
  const db = getDatabase();

  return new Promise((resolve, reject) => {
    const {
      date, client_name, client_phone, license_plate,
      revision_oil_type, revision_oil_volume,
      brake_disc_thickness_front, brake_disc_thickness_rear,
      comments, technician_id
    } = data;

    const query = `
      INSERT INTO InspectionReports (
        report_id,
        date,
        client_name,
        client_phone,
        license_plate,
        revision_oil_type,
        revision_oil_volume,
        brake_disc_thickness_front,
        brake_disc_thickness_rear,
        comments,
        technician_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const processCheckboxes = (obj, defaultItems) => {
      logger.info(`Processing object: ${JSON.stringify(obj)}`);
      const processedObj = { ...defaultItems };
      Object.keys(obj || {}).forEach(key => {
        processedObj[key] = obj[key] === 'true';
      });
      return processedObj;
    };

    // Define default items for each checkbox group
    const defaultInterior = {
      'Antivol de roue bon état': false, 'Démarreur': false, 'Témoin tableau de bord': false,
      'Rétroviseur': false, 'klaxon': false, 'Frein à main': false, 'essuie glace': false,
      'Eclairage': false, 'Jeux au volant': false
    };
    const defaultEngine = {
      'Teste batterie/alternateur': false, 'Plaque immat AV': false, 'Fuite boite': false,
      'Fuite moteur': false, 'supports moteur': false, 'Liquide de frein': false,
      'Filtre à air': false, 'Courroie accessoire': false
    };
    const defaultFront = {
      'Roulement': false, 'Pneus avant': false, 'Parallélisme': false, 'Disque avant': false,
      'Plaquettes avant': false, 'Amortisseur avant': false, 'Biellette barre stab': false,
      'Direction complet': false, 'Cardans': false, 'Triangles avant': false, 'Flexible de frein': false
    };
    const defaultRear = {
      'Pneus AR': false, 'Frein AR': false, 'Roulement AR': false, 'Flexible AR': false,
      'Amortisseur AR': false, 'Silent Bloc AR': false
    };
    const defaultAccessories = {
      'Plaque immat AR': false, 'Antenne radio': false, 'Roue de secours': false,
      'Gilet/Triangle secu': false, 'Crique / Clé roue': false
    };
    const defaultWorkCompleted = {
      'MISE A ZERO VIDANGE': false, 'ROUE SERRER AU COUPLE': false, 'ETIQUETTE DE VIDANGE': false,
      'ETIQUETTE DISTRIBUTION': false, 'ETIQUETTE PLAQUETTE': false, 'PARFUM': false, 'NETTOYAGE': false
    };

    const params = [
      date, client_name, client_phone, license_plate,
      revision_oil_type, revision_oil_volume,
      brake_disc_thickness_front, brake_disc_thickness_rear,
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