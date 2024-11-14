const express = require('express');
const router = express.Router();
const { isAuthenticated } = require('../middleware/auth');
const { getDatabase } = require('../config/database');
const { generatePDF } = require('../services/pdfGenerator');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

// Add the parseInspectionResults function
const parseInspectionResults = (row) => {
  if (!row) return null;
  
  try {
    const inspectionResults = JSON.parse(row.inspection_results || '{}');
    const items = JSON.parse(`[${row.inspection_items}]`);
    
    row.inspection_results = items.map(item => {
      const result = inspectionResults[item.item_id] || {};
      return {
        item_id: item.item_id,
        name: item.name,
        category: item.category,
        type: item.type || 'checkbox',
        value: result.value !== undefined ? result.value : false,
        description: item.description
      };
    });
    
    delete row.inspection_items;
    return row;
  } catch (error) {
    logger.error('Error parsing inspection results:', error);
    row.inspection_results = [];
    return row;
  }
};

// Update preview route
router.get('/preview/:id', isAuthenticated, async (req, res) => {
  const db = getDatabase();
  const reportId = req.params.id;

  logger.info(`PDF preview requested for report ID: ${reportId}`);

  try {
    const report = await new Promise((resolve, reject) => {
      db.get(`
        SELECT 
          ir.*,
          v.license_plate,
          v.revision_oil_type,
          v.revision_oil_volume,
          v.brake_disc_thickness_front,
          v.brake_disc_thickness_rear,
          u.user_name as technician_name,
          GROUP_CONCAT(json_object(
            'item_id', ii.item_id,
            'name', ii.name,
            'category', ii.category,
            'type', ii.type,
            'description', ii.description
          )) as inspection_items
        FROM InspectionReports ir
        JOIN Vehicules v ON ir.vehicle_id = v.vehicle_id
        LEFT JOIN Users u ON ir.technician_id = u.user_id
        LEFT JOIN InspectionItems ii ON ii.is_active = true
        WHERE ir.report_id = ?
        GROUP BY ir.report_id
      `, [reportId], (err, row) => {
        if (err) reject(err);
        else resolve(parseInspectionResults(row));
      });
    });

    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    const pdfPath = await generatePDF(report);
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="preview.pdf"');
    
    const fileStream = fs.createReadStream(pdfPath);
    fileStream.pipe(res);
    
    fileStream.on('end', () => {
      fs.unlink(pdfPath, (err) => {
        if (err) logger.error('Error deleting temporary PDF:', err);
      });
    });
  } catch (error) {
    logger.error(`Error generating PDF preview (ID: ${reportId}):`, error);
    res.status(500).json({ error: 'Error generating preview' });
  }
});

// Update download route to use the same parsing
router.get('/download/:id', isAuthenticated, async (req, res) => {
  const db = getDatabase();
  const reportId = req.params.id;

  logger.info(`PDF download requested for report ID: ${reportId}`);

  try {
    const report = await new Promise((resolve, reject) => {
      db.get(`
        SELECT 
          ir.*,
          v.license_plate,
          v.revision_oil_type,
          v.revision_oil_volume,
          v.brake_disc_thickness_front,
          v.brake_disc_thickness_rear,
          u.user_name as technician_name,
          GROUP_CONCAT(json_object(
            'item_id', ii.item_id,
            'name', ii.name,
            'category', ii.category,
            'type', ii.type,
            'description', ii.description
          )) as inspection_items
        FROM InspectionReports ir
        JOIN Vehicules v ON ir.vehicle_id = v.vehicle_id
        LEFT JOIN Users u ON ir.technician_id = u.user_id
        LEFT JOIN InspectionItems ii ON ii.is_active = true
        WHERE ir.report_id = ?
        GROUP BY ir.report_id
      `, [reportId], (err, row) => {
        if (err) reject(err);
        else resolve(parseInspectionResults(row));
      });
    });

    if (!report) {
      logger.error('Report not found:', reportId);
      return res.status(404).send('Report not found');
    }

    const pdfPath = await generatePDF(report);
    const fileName = `rapport_${report.license_plate}_${report.date}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    
    const fileStream = fs.createReadStream(pdfPath);
    fileStream.pipe(res);
    
    fileStream.on('end', () => {
      fs.unlink(pdfPath, (err) => {
        if (err) logger.error('Error deleting temporary PDF:', err);
      });
    });

    fileStream.on('error', (error) => {
      logger.error('Error streaming PDF:', error);
      res.status(500).send('Error downloading PDF');
    });

  } catch (error) {
    logger.error(`Error generating PDF for download (ID: ${reportId}):`, error);
    res.status(500).send('Error generating PDF');
  }
});

router.delete('/delete/:id', isAuthenticated, async (req, res) => {
  const db = getDatabase();
  const reportId = req.params.id;

  logger.info(`Delete requested for report ID: ${reportId}`);

  try {
    await new Promise((resolve, reject) => {
      db.serialize(() => {
        db.run('BEGIN TRANSACTION');

        // Delete the report directly since inspection results are now stored in JSON
        db.run('DELETE FROM InspectionReports WHERE report_id = ?', [reportId], function(err) {
          if (err) {
            db.run('ROLLBACK');
            reject(err);
          } else if (this.changes === 0) {
            db.run('ROLLBACK');
            reject(new Error('Report not found'));
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

// Update generic route to use the same parsing
router.get('/:id', isAuthenticated, async (req, res) => {
  try {
    const db = getDatabase();
    const report = await new Promise((resolve, reject) => {
      db.get(`
        SELECT 
          ir.*,
          v.license_plate,
          v.revision_oil_type,
          v.revision_oil_volume,
          v.brake_disc_thickness_front,
          v.brake_disc_thickness_rear,
          u.user_name as technician_name,
          GROUP_CONCAT(json_object(
            'item_id', ii.item_id,
            'name', ii.name,
            'category', ii.category,
            'type', ii.type,
            'description', ii.description
          )) as inspection_items
        FROM InspectionReports ir
        JOIN Vehicules v ON ir.vehicle_id = v.vehicle_id
        LEFT JOIN Users u ON ir.technician_id = u.user_id
        LEFT JOIN InspectionItems ii ON ii.is_active = true
        WHERE ir.report_id = ?
        GROUP BY ir.report_id
      `, [req.params.id], (err, row) => {
        if (err) reject(err);
        else resolve(parseInspectionResults(row));
      });
    });

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
