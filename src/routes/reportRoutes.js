const express = require('express');
const router = express.Router();
const { isAuthenticated } = require('../middleware/auth');
const { getDatabase, getUserById } = require('../config/database');
const { generatePDF } = require('../services/pdfGenerator');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

const INSPECTION_ICONS = {
  0: { path: 'img/icon_conforme.svg', label: 'Conforme' },
  1: { path: 'img/icon_not_conforme.svg', label: 'Non conforme' },
  2: { path: 'img/icon_unverified.svg', label: 'Non vérifié' },
  3: { path: 'img/icon_to_plan.svg', label: 'À planifier' }
};

const getInspectionLabeledIcon = (value, includeIconAbsolutePath = true) => {
  const iconConfig = INSPECTION_ICONS[value] || INSPECTION_ICONS[2]; // Default to unverified
  return {
    icon_relative_path: `/static/${iconConfig.path}`,
    icon_absolute_path: includeIconAbsolutePath ? path.join(process.cwd(), 'public', iconConfig.path) : null,
    label: iconConfig.label,
    value: value
  };
};

// Core SQL query for report data
const getReportQuery = `
  SELECT 
    ir.*,
    v.*,
    c.name as client_name,
    c.phone as client_phone,
    c.email as client_email,
    c.address as client_address,
    c.is_company,
    u.username as username,
    GROUP_CONCAT(json_object(
      'item_id', ii.item_id,
      'name', ii.name,
      'category', ii.category,
      'type', ii.type
    )) as inspection_items
  FROM InspectionReports ir
  JOIN Vehicules v ON ir.vehicule_id = v.vehicule_id
  JOIN Customers c ON v.customer_id = c.customer_id
  LEFT JOIN Users u ON ir.created_by = u.user_id
  LEFT JOIN InspectionItems ii ON ii.is_active = true 
    AND JSON_EXTRACT(ir.inspection_results, CONCAT('$.', ii.item_id)) IS NOT NULL
  WHERE ir.report_id = ?
  GROUP BY ir.report_id`;

// Helper Functions
const parseInspectionResults = (row, includeIconAbsolutePath = true) => {
  if (!row) {
    logger.warn('parseInspectionResults: No row data provided');
    return null;
  }

  try {
    logger.debug('Parsing inspection data:', {
      results: row.inspection_results.length,
      items: row.inspection_items.split(',').length
    });
    
    // Parse the JSON strings
    const inspectionResults = JSON.parse(row.inspection_results || '{}');
    const items = JSON.parse(`[${row.inspection_items}]`);
    
    // Map items with their values from inspection_results
    row.inspection_results = items.map(item => {
      const item_value = inspectionResults[item.item_id];
      const labeledIcon = getInspectionLabeledIcon(item_value, includeIconAbsolutePath);

      // Log each item mapping with structured data
      logger.debug(`Mapping inspection item ${item.name} : ${labeledIcon.label} [${labeledIcon.icon_absolute_path}]`);

      return {
        item_id: item.item_id,
        name: item.name,
        category: item.category,
        type: item.type || 'options',
        value: labeledIcon
      };
    });

    return row;
  } catch (error) {
    logger.error('Failed to parse inspection results', { 
      error_name: error.name,
      error_message: error.message,
      stack: error.stack,
      raw_data: {
        inspection_results: row.inspection_results,
        inspection_items: row.inspection_items
      }
    });
    return { ...row, inspection_results: [] };
  }
};

const formatDates = (report) => {
  const datesToFormat = ['created_at', 'date', 'first_registration_date'];
  datesToFormat.forEach(dateField => {
    if (report[dateField]) {
      report[dateField] = new Date(report[dateField]);
    }
  });
  return report;
};

const getReport = async (reportId, includeIconAbsolutePath = true) => {
  const db = getDatabase();
  return new Promise((resolve, reject) => {
    db.get(getReportQuery, [reportId], (err, row) => {
      if (err) reject(err);
      else resolve(parseInspectionResults(row, includeIconAbsolutePath));
    });
  });
};

const handlePDFStream = (pdfPath, res, customer_name, license_plate, formatedDate, download = false) => {
  const fileStream = fs.createReadStream(pdfPath);
  const fileName = `${customer_name} - ${license_plate} - ${formatedDate}.pdf`;
  
  res.setHeader('Content-Disposition', download ?
     `attachment; filename="${fileName}"` : 
     `inline; filename="${fileName}"`);

  
  res.setHeader('Content-Type', 'application/pdf');
  fileStream.pipe(res);
  
  fileStream.on('end', () => {
    fs.unlink(pdfPath, (err) => {
      if (err) logger.error('Error deleting temporary PDF:', err);
    });
  });

  fileStream.on('error', (error) => {
    logger.error('Error streaming PDF:', error);
    res.status(500).send('Error streaming PDF');
  });
};

// Routes
router.get('/preview/:id', isAuthenticated, async (req, res) => {
  try {
    const report = await getReport(req.params.id);
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    formatDates(report);
    const pdfPath = await generatePDF(report);
    const formatedDate = report.created_at.toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' });
    handlePDFStream(pdfPath, res, report.client_name, report.license_plate, formatedDate);
  } catch (error) {
    logger.error(`Error in preview route (ID: ${req.params.id}):`, error);
    res.status(500).json({ error: 'Error generating preview' });
  }
});

router.get('/download/:id', isAuthenticated, async (req, res) => {
  try {
    const report = await getReport(req.params.id);
    if (!report) {
      return res.status(404).send('Report not found');
    }

    formatDates(report);
    const pdfPath = await generatePDF(report);
    const formatedDate = report.created_at.toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' });
    
    handlePDFStream(pdfPath, res, report.client_name, report.license_plate, formatedDate, true);
  } catch (error) {
    logger.error(`Error generating PDF for download (ID: ${req.params.id}):`, error);
    res.status(500).send('Error generating PDF');
  }
});

router.delete('/delete/:id', isAuthenticated, async (req, res) => {
  const db = getDatabase();
  const reportId = req.params.id;

  try {
    await new Promise((resolve, reject) => {
      db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        db.run('DELETE FROM InspectionReports WHERE report_id = ?', [reportId], function(err) {
          if (err || this.changes === 0) {
            db.run('ROLLBACK');
            reject(err || new Error('Report not found'));
          } else {
            db.run('COMMIT');
            resolve();
          }
        });
      });
    });

    logger.info(`Successfully deleted report with ID: ${reportId}`);
    res.json({ success: true });
  } catch (error) {
    logger.error(`Error deleting report (ID: ${reportId}):`, error);
    res.status(500).json({ 
      success: false, 
      error: error.message === 'Report not found' ? 'Report not found' : 'Internal server error' 
    });
  }
});

router.get('/:id', isAuthenticated, async (req, res) => {
  try {
    const report = await getReport(req.params.id);
    if (!report) {
      return res.status(404).render('error', {
        message: 'Report not found',
        errors: [],
        user: req.session.user
      });
    }

    const created_by = (await getUserById(report.created_by)).username;
    logger.debug(`Created by: ${created_by} with id: ${report.created_by}`);

    let mechanicsParsed = JSON.parse(report.mechanics);
    let mechanics = [];

    for (let mechanic in mechanicsParsed) {
      const mechanic_id = mechanicsParsed[mechanic];
      const mechanic_user = await getUserById(mechanic_id);
      mechanics.push(mechanic_user.username);
    }

    res.render('report', { 
      report, 
      errors: [],
      user: req.session.user,
      created_by: created_by,
      mechanics: mechanics
    });
  } catch (error) {
    logger.error('Error fetching report:', error);
    res.status(500).render('error', {
      message: 'Error loading report',
      errors: [error.message],
      user: req.session.user
    });
  }
});

// API to get an inspection item
router.get('/api-inspection-report/:id', isAuthenticated, async (req, res) => {
  try {
    const report = await getReport(req.params.id, false);
    if (!report) {
      return res.status(404).json({ error: `Report ${req.params.id} not found` });
    }
    
    res.json(report);
  } catch (error) {
    logger.error('Error fetching inspection item:', error);
    res.status(500).json({ error: 'Error fetching inspection item' });
  }
});

module.exports = router;
