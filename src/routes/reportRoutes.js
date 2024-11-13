const express = require('express');
const router = express.Router();
const { isAuthenticated } = require('../middleware/auth');
const { getInspectionReport, getDatabase } = require('../config/database');
const { generatePDF } = require('../services/pdfGenerator');
const logger = require('../utils/logger');
const fs = require('fs');

// View report details
router.get('/:id', isAuthenticated, async (req, res) => {
  try {
    const report = await getInspectionReport(req.params.id);
    
    if (!report) {
      return res.status(404).render('error', {
        message: 'Rapport non trouvé'
      });
    }

    res.render('report', { report });
  } catch (error) {
    logger.error('Error fetching report:', error);
    res.status(500).render('error', {
      message: 'Erreur lors du chargement du rapport'
    });
  }
});

// Download report as PDF
router.get('/download/:id', isAuthenticated, async (req, res) => {
  try {
    const db = getDatabase();
    const report = await new Promise((resolve, reject) => {
      db.get(`
        SELECT ir.*, u.user_name as technician_name
        FROM InspectionReports ir
        LEFT JOIN Users u ON ir.technician_id = u.user_id
        WHERE ir.report_id = ?
      `, [req.params.id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!report) {
      return res.status(404).render('error', {
        message: 'Rapport non trouvé'
      });
    }

    const pdfPath = await generatePDF(report);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=rapport_${report.license_plate}_${report.date}.pdf`);
    
    const fileStream = fs.createReadStream(pdfPath);
    fileStream.pipe(res);
    
    fileStream.on('end', () => {
      fs.unlink(pdfPath, (err) => {
        if (err) logger.error('Error deleting temporary PDF:', err);
      });
    });

  } catch (error) {
    logger.error('Error generating PDF:', error);
    res.status(500).render('error', {
      message: 'Erreur lors de la génération du PDF'
    });
  }
});

module.exports = router; 