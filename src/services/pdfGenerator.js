const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

function generatePDF(report) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 10 });
    const pdfPath = path.join(__dirname, '..', '..', 'generated_reports', `${report.vehicle_registration}_${report.date}.pdf`);
    const writeStream = fs.createWriteStream(pdfPath);

    doc.pipe(writeStream);

    // Color palette
    const colors = {
      primary: '#333333',
      secondary: '#757575',
      accent: '#4CAF50',
      warning: '#F44336',
      lightGray: '#E0E0E0',
    };

    // Helper functions
    const drawCheckbox = (x, y, checked, color) => {
      doc.circle(x, y, 6, { stroke: color });
      if (checked) {
        doc.circle(x, y, 4).fill(color);
      }
    };

    // Header
    doc.image('src/services/company_logo.png', 50, 50, { width: 60 });
    doc.font('Helvetica-Bold').fontSize(18).fillColor(colors.primary).text('Auto Presto', 120, 50);
    doc.font('Helvetica').fontSize(10).fillColor(colors.secondary)
      .text('3 rue de la Guadeloupe, 97400 SAINTE-CLOTILDE', 120, 72)
      .text('Tél: 0692 01 25 39', 120, 87);

    doc.font('Helvetica-Bold').fontSize(16).fillColor(colors.primary).text('Rapport d\'inspection', 400, 50);
    doc.font('Helvetica').fontSize(10).fillColor(colors.secondary)
      .text(`Date: ${report.date || 'N/A'}`, 400, 72)
      .text(`N° Rapport: ${report.report_number || 'N/A'}`, 400, 87);

    // Vehicle and Client Information
    doc.moveTo(50, 120).lineTo(545, 120).stroke(colors.lightGray);

    const infoFields = [
      { label: 'Immatriculation:', value: report.vehicle_registration },
      { label: 'Marque:', value: report.vehicle_make },
      { label: 'Modèle:', value: report.vehicle_model },
      { label: 'Kilométrage:', value: report.mileage ? `${report.mileage} KM` : 'N/A' },
      { label: 'Prochain C.T:', value: report.next_inspection_date },
      { label: 'Nom:', value: report.client_name },
      { label: 'Téléphone:', value: report.client_phone },
      { label: 'Adresse:', value: report.client_address || 'N/A' },
    ];

    doc.font('Helvetica-Bold').fontSize(12).fillColor(colors.primary).text('Informations du Véhicule', 50, 130);
    doc.font('Helvetica-Bold').fontSize(12).fillColor(colors.primary).text('Informations du Client', 300, 130);

    infoFields.forEach((field, index) => {
      const x = index < 5 ? 50 : 300;
      const y = 155 + (index % 5) * 20;
      doc.font('Helvetica-Bold').fontSize(10).fillColor(colors.secondary).text(field.label, x, y);
      doc.font('Helvetica').fontSize(10).fillColor(colors.primary).text(field.value || 'N/A', x + 100, y, { width: 150, ellipsis: true });
    });

    // Inspection Summary
    doc.moveTo(50, 260).lineTo(545, 260).stroke(colors.lightGray);
    doc.font('Helvetica-Bold').fontSize(12).fillColor(colors.primary).text('Résumé de l\'inspection', 50, 270);
    
    drawCheckbox(60, 295, true, colors.accent);
    doc.font('Helvetica').fontSize(10).fillColor(colors.primary).text('Bon État Général', 80, 290);

    const inspectionPoints = JSON.parse(report.inspection_points || '{}');
    const pointsChecked = Object.values(inspectionPoints).filter(Boolean).length;
    doc.font('Helvetica-Bold').fontSize(12).fillColor(colors.primary).text(`${pointsChecked} sur ${Object.keys(inspectionPoints).length} points vérifiés`, 300, 290);

    // Points d'inspection
    doc.moveTo(50, 320).lineTo(545, 320).stroke(colors.lightGray);
    doc.font('Helvetica-Bold').fontSize(12).fillColor(colors.primary).text('Points d\'inspection', 50, 330);

    const columns = 2;
    const itemsPerColumn = Math.ceil(Object.keys(inspectionPoints).length / columns);
    const columnWidth = 245;

    let yPosition = 355;
    let currentColumn = 0;

    Object.entries(inspectionPoints).forEach(([item, checked], index) => {
      const x = 50 + currentColumn * columnWidth;
      const y = yPosition;

      drawCheckbox(x, y, checked, checked ? colors.accent : colors.warning);
      doc.font('Helvetica').fontSize(10).fillColor(colors.primary).text(item, x + 20, y - 5, { width: columnWidth - 30 });

      if ((index + 1) % itemsPerColumn === 0) {
        currentColumn++;
        yPosition = 355;
      } else {
        yPosition += 20;
      }
    });

    // Révision and Travaux Effectués
    yPosition = Math.max(yPosition, 355 + (itemsPerColumn * 20)) + 20;
    doc.moveTo(50, yPosition).lineTo(545, yPosition).stroke(colors.lightGray);

    doc.font('Helvetica-Bold').fontSize(12).fillColor(colors.primary).text('Révision', 50, yPosition + 10);
    doc.font('Helvetica-Bold').fontSize(12).fillColor(colors.primary).text('Travaux Effectués', 300, yPosition + 10);

    const revisionItems = [
      { label: 'Huile:', value: report.revision_oil_type },
      { label: 'Couple de serrage:', value: report.revision_torque },
      { label: 'Quantité:', value: report.revision_oil_volume },
      { label: 'Epaisseur min disque avant:', value: report.brake_disc_thickness_front },
      { label: 'Epaisseur min disque arrière:', value: report.brake_disc_thickness_rear },
    ];

    revisionItems.forEach((item, index) => {
      const y = yPosition + 35 + index * 20;
      doc.font('Helvetica-Bold').fontSize(9).fillColor(colors.secondary).text(item.label, 50, y);
      doc.font('Helvetica').fontSize(9).fillColor(colors.primary).text(item.value || 'N/A', 160, y, { width: 130 });
    });

    const workCompleted = JSON.parse(report.work_completed || '{}');
    Object.entries(workCompleted).forEach(([item, checked], index) => {
      const y = yPosition + 35 + index * 20;
      drawCheckbox(300, y, checked, colors.accent);
      doc.font('Helvetica').fontSize(9).fillColor(colors.primary).text(item, 320, y - 5, { width: 225 });
    });

    // Commentaires et Recommandations
    const commentsY = Math.max(yPosition + 35 + (revisionItems.length * 20), yPosition + 35 + (Object.keys(workCompleted).length * 20)) + 20;
    doc.moveTo(50, commentsY).lineTo(545, commentsY).stroke(colors.lightGray);
    doc.font('Helvetica-Bold').fontSize(12).fillColor(colors.primary).text('Commentaires et Recommandations', 50, commentsY + 10);
    doc.font('Helvetica').fontSize(9).fillColor(colors.primary)
      .text(report.comments || 'Aucun commentaire.', 50, commentsY + 30, { width: 495, align: 'justify' });

    // Footer
    doc.font('Helvetica').fontSize(8).fillColor(colors.secondary)
      .text('Ce rapport est généré automatiquement et ne nécessite pas de signature.', 50, 780, { align: 'center', width: 495 })
      .text('Pour toute question, veuillez contacter Auto Presto au 0692 01 25 39', 50, 795, { align: 'center', width: 495 })
      .text('© 2024 Auto Presto. Tous droits réservés.', 50, 810, { align: 'center', width: 495 });

    doc.end();

    writeStream.on('finish', () => {
      logger.info(`PDF generated successfully: ${pdfPath}`);
      resolve(pdfPath);
    });
    writeStream.on('error', (error) => {
      logger.error(`Error generating PDF: ${error.message}`);
      reject(error);
    });
  });
}

module.exports = { generatePDF };