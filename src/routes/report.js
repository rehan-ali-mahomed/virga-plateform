const express = require('express');
const { isAuthenticated } = require('../middleware/auth');
const { getDatabase } = require('../config/database');
const { generatePDF } = require('../services/pdfGenerator');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

const router = express.Router();

router.get('/:id/preview', isAuthenticated, async (req, res) => {
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
      return res.status(404).send('Report not found');
    }

    const pdfPath = await generatePDF(report);
    res.contentType('application/pdf');
    fs.createReadStream(pdfPath).pipe(res);
  } catch (error) {
    logger.error(`Error generating PDF for preview (ID: ${reportId}):`, error);
    res.status(500).send('Error generating PDF');
  }
});

router.get('/:id/download', isAuthenticated, async (req, res) => {
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

module.exports = router;
