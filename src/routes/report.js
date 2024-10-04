const express = require('express');
const { isAuthenticated } = require('../middleware/auth');
const { generatePDF } = require('../services/pdfGenerator');
const logger = require('../utils/logger');

const router = express.Router();

router.get('/:id/download', isAuthenticated, async (req, res) => {
  const reportId = req.params.id;
  logger.info(`PDF download requested for report ID: ${reportId}`);
  try {
    await generatePDF(reportId, res, 'attachment');
    logger.info(`PDF download successful for report ID: ${reportId}`);
  } catch (error) {
    logger.error(`Error generating PDF for download (ID: ${reportId}): ${error.message}`);
    res.status(500).render('error', { message: error.message });
  }
});

router.get('/:id/preview', isAuthenticated, async (req, res) => {
  const reportId = req.params.id;
  logger.info(`PDF preview requested for report ID: ${reportId}`);
  try {
    await generatePDF(reportId, res, 'inline');
    logger.info(`PDF preview successful for report ID: ${reportId}`);
  } catch (error) {
    logger.error(`Error generating PDF for preview (ID: ${reportId}): ${error.message}`);
    res.status(500).render('error', { message: error.message });
  }
});

module.exports = router;
