const express = require('express');
const router = express.Router();
const { isAuthenticated } = require('../middleware/auth');
const { getDatabase } = require('../config/database');
const { generatePDF } = require('../services/pdfGenerator');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

// Core SQL query for report data
const getReportQuery = `
  SELECT 
    ir.*,
    v.license_plate,
    v.brand,
    v.model,
    v.engine_code,
    v.revision_oil_type,
    v.revision_oil_volume,
    v.brake_disc_thickness_front,
    v.brake_disc_thickness_rear,
    v.first_registration_date,
    c.name as client_name,
    c.phone as client_phone,
    c.email as client_email,
    c.address as client_address,
    c.is_company,
    u.username as technician_name,
    GROUP_CONCAT(json_object(
      'item_id', ii.item_id,
      'name', ii.name,
      'category', ii.category,
      'type', ii.type,
      'description', ii.description
    )) as inspection_items
  FROM InspectionReports ir
  JOIN Vehicules v ON ir.vehicle_id = v.vehicle_id
  JOIN Customers c ON v.customer_id = c.customer_id
  LEFT JOIN Users u ON ir.technician_id = u.user_id
  LEFT JOIN InspectionItems ii ON ii.is_active = true 
    AND JSON_EXTRACT(ir.inspection_results, CONCAT('$.', ii.item_id)) IS NOT NULL
  WHERE ir.report_id = ?
  GROUP BY ir.report_id`;

// Helper Functions
const parseInspectionResults = (row) => {
  if (!row) {
    logger.warn('parseInspectionResults: No row data provided');
    return null;
  }

  try {
    logger.debug('Parsing inspection data:', {
      results: row.inspection_results,
      items: row.inspection_items
    });
    
    // Parse the JSON strings
    const inspectionResults = JSON.parse(row.inspection_results || '{}');
    const items = JSON.parse(`[${row.inspection_items}]`);
    
    // Map items with their values from inspection_results
    row.inspection_results = items.map(item => {
      const value = inspectionResults[item.item_id];
      
      logger.debug(`Mapping item ${item.item_id}:`, {
        itemName: item.name,
        value: value,
        defaultValue: 'Non Vérifier'
      });

      return {
        item_id: item.item_id,
        name: item.name,
        category: item.category,
        type: item.type || 'options',
        // Only use 'Non Vérifier' if value is undefined or null
        value: value !== undefined && value !== null ? value : 'Non Vérifier',
        description: item.description
      };
    });

    return row;
  } catch (error) {
    logger.error('Error parsing inspection results:', { 
      error: error.message,
      rawData: {
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

const getReport = async (reportId) => {
  const db = getDatabase();
  return new Promise((resolve, reject) => {
    db.get(getReportQuery, [reportId], (err, row) => {
      if (err) reject(err);
      else resolve(parseInspectionResults(row));
    });
  });
};

const handlePDFStream = (pdfPath, res, fileName = null, download = false) => {
  const fileStream = fs.createReadStream(pdfPath);
  
  res.setHeader('Content-Disposition', download ? `attachment; filename="${fileName}"` : `inline; filename="${fileName}"`);

  
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
    handlePDFStream(pdfPath, res, `${report.license_plate}.pdf`);
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
    const safeDate = report.date.toISOString().split('T')[0];
    const fileName = `rapport_${report.license_plate}_${safeDate}.pdf`;
    
    handlePDFStream(pdfPath, res, fileName, true);
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

    res.render('report', { 
      report, 
      errors: [],
      user: req.session.user
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

module.exports = router;
