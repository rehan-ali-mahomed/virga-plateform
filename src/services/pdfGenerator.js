const PDFDocument = require('pdfkit');
const { db } = require('../config/database');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

function generatePDF(reportId, res, contentDisposition) {
  return new Promise((resolve, reject) => {
    logger.info(`Starting PDF generation for report ID: ${reportId}`);
    db.get('SELECT * FROM inspection_reports WHERE id = ?', [reportId], (err, report) => {
      if (err) {
        logger.error(`Database error retrieving report: ${err.message}`);
        reject(new Error('An error occurred while generating the report.'));
        return;
      }

      if (!report) {
        logger.warn(`Report not found for ID: ${reportId}`);
        reject(new Error('Report not found'));
        return;
      }

      logger.info(`Report data retrieved for ID: ${reportId}`);

      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      let filename = `Inspection_Report_${reportId}.pdf`;

      res.setHeader('Content-disposition', `${contentDisposition}; filename="${filename}"`);
      res.setHeader('Content-type', 'application/pdf');

      if (contentDisposition === 'inline') {
        res.setHeader('X-Frame-Options', 'SAMEORIGIN');
      }

      doc.pipe(res);

      // Add content to the PDF
      const logoPath = path.join(__dirname, '..', '..', 'public', 'images', 'company_logo.png');
      if (fs.existsSync(logoPath)) {
        doc.image(logoPath, 50, 45, { width: 100 });
        logger.info(`Company logo added to PDF`);
      } else {
        logger.warn(`Logo file not found at path: ${logoPath}`);
      }
      
      doc.fontSize(20).text('Vehicle Inspection Report', 150, 50);
      doc.fontSize(12).text(`Date: ${report.date}`, 400, 50);
      
      // Add more content based on the report data
      doc.fontSize(14).text('Client Information', 50, 150);
      doc.fontSize(12).text(`Name: ${report.client_name}`, 50, 170);
      doc.text(`Phone: ${report.client_phone}`, 50, 190);

      doc.fontSize(14).text('Vehicle Information', 50, 230);
      doc.fontSize(12).text(`Make: ${report.vehicle_make}`, 50, 250);
      doc.text(`Model: ${report.vehicle_model}`, 50, 270);
      doc.text(`Registration: ${report.vehicle_registration}`, 50, 290);
      doc.text(`Mileage: ${report.mileage}`, 50, 310);

      logger.info(`Basic report information added to PDF`);

      // Add more sections as needed...

      doc.end();
      logger.info(`PDF generation completed for report ID: ${reportId}`);
      resolve();
    });
  });
}

module.exports = { generatePDF };