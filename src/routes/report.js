const express = require('express');
const { isAuthenticated } = require('../middleware/auth');
const { getDatabase } = require('../config/database');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

const router = express.Router();

function generatePDF(report) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument();
    const pdfPath = path.join(__dirname, '..', '..', 'temp', `report_${report.id}.pdf`);
    const writeStream = fs.createWriteStream(pdfPath);

    doc.pipe(writeStream);

    // Add content to the PDF
    doc.fontSize(25).text('Inspection Report', 100, 80);
    doc.fontSize(15).text(`Date: ${report.date}`, 100, 120);
    doc.text(`Client: ${report.client_name}`, 100, 140);
    doc.text(`Vehicle: ${report.vehicle_make} ${report.vehicle_model}`, 100, 160);
    // Add more fields as needed

    doc.end();

    writeStream.on('finish', () => resolve(pdfPath));
    writeStream.on('error', reject);
  });
}

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
      // Delete the temporary file after download
      fs.unlink(pdfPath, (unlinkErr) => {
        if (unlinkErr) logger.error(`Error deleting temporary PDF file:`, unlinkErr);
      });
    });
  } catch (error) {
    logger.error(`Error generating PDF for download (ID: ${reportId}):`, error);
    res.status(500).send('Error generating PDF');
  }
});

module.exports = router;
