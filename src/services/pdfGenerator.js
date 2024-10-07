const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

function generatePDF(report) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const pdfPath = path.join(__dirname, '..', '..', 'temp', `report_${report.id}.pdf`);
    const writeStream = fs.createWriteStream(pdfPath);

    doc.pipe(writeStream);

    // Helper functions
    const drawRect = (x, y, w, h, radius = 0) => doc.roundedRect(x, y, w, h, radius).stroke();
    const drawFilledRect = (x, y, w, h, radius = 0, color = 'black') => doc.roundedRect(x, y, w, h, radius).fill(color);

    // 1. Header
    doc.fontSize(24).font('Helvetica-Bold').text('AUTO PRESTO', 50, 50);
    drawFilledRect(450, 40, 80, 80, 10, '#333'); // Logo placeholder
    doc.fontSize(10).font('Helvetica')
       .text('3 rue de la Guadeloupe, 97490 SAINTE CLOTILDE', 50, 80)
       .text('Tel: 0692 01 25 39 | Email: contact@autopresto.com', 50, 95)
       .text(`Report Date: ${report.date}`, 50, 110);

    // 2. Vehicle Information
    drawRect(50, 140, 495, 80, 5);
    doc.fontSize(14).font('Helvetica-Bold').text('Vehicle Information', 60, 150);
    doc.fontSize(10).font('Helvetica')
       .text(`Immatriculation: ${report.immatriculation} | Marque: ${report.vehicle_make} | Model: ${report.vehicle_model}`, 60, 170)
       .text(`Kilometrage: ${report.kilometrage} | Prochain C.T: ${report.prochain_ct}`, 60, 185)
       .text(`Client: ${report.client_name} | Contact: ${report.client_contact}`, 60, 200);

    // 3. Inspection Sections
    const inspectionSections = [
      { title: 'Interior', color: '#4CAF50', icon: '🚗' },
      { title: 'Engine', color: '#2196F3', icon: '🔧' },
      { title: 'Front', color: '#FFC107', icon: '🛞' },
      { title: 'Rear', color: '#9C27B0', icon: '🚙' },
      { title: 'Accessories', color: '#FF5722', icon: '🔌' }
    ];

    const drawInspectionSection = (section, x, y, width, height, items) => {
      drawFilledRect(x, y, width, 30, 5, section.color);
      doc.fillColor('white').fontSize(14).font('Helvetica-Bold')
         .text(`${section.icon} ${section.title}`, x + 10, y + 8);
      drawRect(x, y + 30, width, height - 30, 5);
      
      doc.fontSize(9).font('Helvetica').fillColor('black');
      items.forEach((item, i) => {
        doc.text(item.name, x + 10, y + 40 + i * 20);
        drawFilledRect(x + width - 70, y + 38 + i * 20, 60, 15, 3, item.status ? '#4CAF50' : '#E0E0E0');
      });
    };

    doc.addPage();
    inspectionSections.forEach((section, index) => {
      const x = index % 2 === 0 ? 50 : 300;
      const y = 50 + Math.floor(index / 2) * 220;
      drawInspectionSection(section, x, y, 245, 200, report[section.title.toLowerCase() + '_items'] || []);
    });

    // 4. Summary Section
    doc.addPage();
    doc.fontSize(18).font('Helvetica-Bold').text('Summary', 50, 50);

    // Comments
    drawRect(50, 80, 495, 100, 5);
    doc.fontSize(12).font('Helvetica-Bold').text('📝 Comments:', 60, 90);
    doc.fontSize(10).font('Helvetica').text(report.comments || 'No comments', 60, 110);

    // Revision
    drawRect(50, 190, 495, 80, 5);
    doc.fontSize(12).font('Helvetica-Bold').text('🔎 Revision:', 60, 200);
    doc.fontSize(10).font('Helvetica')
       .text(`Oil: ${report.oil_type} | Torque: ${report.torque} | Capacity: ${report.oil_capacity}`, 60, 220)
       .text(`Min. front disc thickness: ${report.front_disc_thickness} MM`, 60, 235)
       .text(`Min. rear disc thickness: ${report.rear_disc_thickness} MM`, 60, 250);

    // Travaux
    drawRect(50, 280, 495, 150, 5);
    doc.fontSize(12).font('Helvetica-Bold').text('🔨 Work Performed:', 60, 290);
    const travauxItems = report.travaux_items || [];
    travauxItems.forEach((item, i) => {
      doc.fontSize(10).font('Helvetica').text(`☐ ${item}`, 60, 310 + i * 20);
    });

    doc.end();

    writeStream.on('finish', () => resolve(pdfPath));
    writeStream.on('error', reject);
  });
}

module.exports = { generatePDF };