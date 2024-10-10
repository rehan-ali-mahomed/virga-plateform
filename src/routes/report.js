const express = require('express');
const { isAuthenticated } = require('../middleware/auth');
const { getDatabase } = require('../config/database');
const { generatePDF } = require('../services/pdfGenerator');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

const router = express.Router();

router.get('/preview/:id', isAuthenticated, async (req, res) => {
  const db = getDatabase();
  const reportId = req.params.id;

  logger.info(`PDF preview requested for report ID: ${reportId}`);

  try {
    const report = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM inspection_reports WHERE id = ?', [reportId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!report) {
      return res.status(404).json({
        error: 'Report not found',
        message: 'The requested report could not be found in the database.',
        reportId: reportId
      });
    }

    // display the report in log
    logger.info(`Report: ${JSON.stringify(report)}`);
    const pdfPath = await generatePDF(report);
    res.contentType('application/pdf');
    fs.createReadStream(pdfPath).pipe(res);
  } catch (error) {
    logger.error(`Error generating PDF for preview (ID: ${reportId}):`, error);
    res.status(500).send('Error generating PDF');
  }
});

router.get('/download/:id', isAuthenticated, async (req, res) => {
  const db = getDatabase();
  const reportId = req.params.id;

  logger.info(`PDF download requested for report ID: ${reportId}`);

  try {
    const report = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM inspection_reports WHERE id = ?', [reportId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!report) {
      return res.status(404).send('Report not found');
    }

    const pdfPath = await generatePDF(report);
    res.download(pdfPath, `report_${reportId}.pdf`, (err) => {
      if (err) {
        logger.error(`Error downloading PDF (ID: ${reportId}):`, err);
      }
      // We don't delete the file here as it's handled by the cleanup function in app.js
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
    // Delete the report from the database
    const result = await new Promise((resolve, reject) => {
      db.run('DELETE FROM inspection_reports WHERE id = ?', [reportId], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.changes);
        }
      });
    });

    // Check if any rows were affected
    if (result === 0) {
      logger.warn(`No report found with ID: ${reportId}`);
      return res.status(404).json({ success: false, error: 'Report not found' });
    }

    logger.info(`Successfully deleted report with ID: ${reportId}`);
    res.json({ success: true });
  } catch (error) {
    logger.error(`Error deleting report (ID: ${reportId}):`, error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

module.exports = router;
