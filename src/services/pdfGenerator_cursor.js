const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

function generatePDF(report) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 20 });
    const pdfPath = path.join(__dirname, '..', '..', 'generated_reports', `${report.vehicle_registration}_${report.date}.pdf`);
    const writeStream = fs.createWriteStream(pdfPath);

    doc.pipe(writeStream);

    // Helper functions
    const drawRect = (x, y, w, h, options = {}) => {
      doc.rect(x, y, w, h);
      if (options.fill) doc.fill(options.fill);
      if (options.stroke) doc.stroke(options.stroke);
    };
    const truncate = (text, length) => text.length > length ? text.substring(0, length - 3) + '...' : text;

    // Color palette
    const colors = {
      primary: '#1a237e',
      secondary: '#0d47a1',
      accent: '#ffd600',
      light: '#e8eaf6',
      text: '#212121',
      checked: '#4caf50',
      unchecked: '#f44336',
    };

    // 1. Header
    drawRect(20, 20, 555, 70, { fill: colors.primary });
    doc.image('src/services/company_logo.png', 30, 25, { width: 50 });
    doc.font('Helvetica-Bold').fontSize(20).fillColor('white')
      .text('AUTO PRESTO', 90, 30);
    doc.font('Helvetica').fontSize(9).fillColor('white')
      .text('3 rue de la Guadeloupe, 97490 SAINTE CLOTILDE', 90, 55)
      .text('0692 01 25 39', 90, 67);

    doc.font('Helvetica-Bold').fontSize(10).fillColor('white')
      .text('DATE :', 430, 30);
    drawRect(470, 25, 90, 20, { fill: 'white' });
    doc.fillColor(colors.text).text(report.date || 'N/A', 475, 31);

    // 2. Vehicle Information
    drawRect(20, 100, 555, 80, { fill: colors.light });
    const infoFields = [
      { label: 'IMMATRICULATION:', value: report.vehicle_registration },
      { label: 'MARQUE:', value: report.vehicle_make },
      { label: 'MODEL:', value: report.vehicle_model },
      { label: 'KILOMETRAGE:', value: report.mileage },
      { label: 'NOM CLIENT:', value: report.client_name },
      { label: 'TELEPHONE:', value: report.client_phone },
      { label: 'PROCHAIN C.T:', value: report.next_inspection_date },
    ];

    infoFields.forEach((field, index) => {
      const x = 30 + (index % 2) * 275;
      const y = 110 + Math.floor(index / 2) * 20;
      doc.font('Helvetica-Bold').fontSize(9).fillColor(colors.text)
        .text(field.label, x, y);
      doc.font('Helvetica').fontSize(9)
        .text(truncate(field.value?.toString() || 'N/A', 25), x + 100, y);
    });

    // 3. Inspection Sections
    const sections = [
      { title: 'INTERIEUR', items: JSON.parse(report.interior || '{}'), x: 20, y: 190, w: 270, h: 150 },
      { title: 'MOTEUR', items: JSON.parse(report.engine || '{}'), x: 305, y: 190, w: 270, h: 150 },
      { title: 'AVANT', items: JSON.parse(report.front || '{}'), x: 20, y: 350, w: 270, h: 150 },
      { title: 'ARRIERE', items: JSON.parse(report.rear || '{}'), x: 305, y: 350, w: 270, h: 150 }
    ];

    const drawSection = (title, items, x, y, w, h) => {
      logger.info(`Processing items for ${title}: ${JSON.stringify(items)}`);
      drawRect(x, y, w, h, { fill: colors.secondary });
      doc.fillColor('white').font('Helvetica-Bold').fontSize(11).text(title, x + 5, y + 5, { width: w - 10, align: 'center' });
      doc.fillColor(colors.text).font('Helvetica').fontSize(8);
      
      const itemsPerColumn = Math.ceil(Object.keys(items).length / 2);
      const columnWidth = (w - 20) / 2;
      
      Object.entries(items).forEach(([item, checked], index) => {
        const column = Math.floor(index / itemsPerColumn);
        const row = index % itemsPerColumn;
        const xPos = x + 5 + column * columnWidth;
        const yPos = y + 25 + row * 13;
        
        doc.text(truncate(item, 25), xPos, yPos, { width: columnWidth - 25 });
        drawRect(xPos + columnWidth - 20, yPos - 2, 15, 8, { fill: checked ? colors.checked : colors.unchecked });
      });
    };

    sections.forEach(section => drawSection(section.title, section.items, section.x, section.y, section.w, section.h));

    // 4. Accessories Section
    drawRect(20, 510, 555, 70, { fill: colors.light });
    doc.fillColor(colors.secondary).font('Helvetica-Bold').fontSize(11).text('ACCESSOIRES', 25, 515);
    doc.fillColor(colors.text).font('Helvetica').fontSize(8);
    const accessories = JSON.parse(report.accessories || '{}');
    const accessoriesPerRow = 4;
    const accessoryWidth = 535 / accessoriesPerRow;
    
    Object.entries(accessories).forEach(([item, checked], index) => {
      const x = 25 + (index % accessoriesPerRow) * accessoryWidth;
      const y = 535 + Math.floor(index / accessoriesPerRow) * 15;
      doc.text(truncate(item, 20), x, y, { width: accessoryWidth - 25 });
      drawRect(x + accessoryWidth - 20, y - 2, 15, 8, { fill: checked ? colors.checked : colors.unchecked });
    });

    // 5. Comment Section
    doc.font('Helvetica-Bold').fontSize(9).fillColor(colors.secondary).text('COMMENTAIRE', 20, 590);
    drawRect(20, 605, 555, 40, { stroke: colors.secondary });
    doc.font('Helvetica').fontSize(8).fillColor(colors.text)
      .text(truncate(report.comments || '', 200), 25, 610, { width: 545, height: 30 });

    // 6. Revision Section
    drawRect(20, 655, 555, 50, { fill: colors.light });
    doc.fillColor(colors.secondary).font('Helvetica-Bold').fontSize(9).text('REVISION', 25, 660);
    doc.fillColor(colors.text).font('Helvetica').fontSize(8)
      .text(`${report.revision_oil_type || 'N/A'}    ${report.revision_torque || 'N/A'}`, 90, 660)
      .text(report.revision_oil_volume || 'N/A', 90, 675)
      .text(`Epaisseur min disque avant: ${report.brake_disc_thickness_front || 'N/A'}`, 290, 660)
      .text(`Epaisseur min disque arrière: ${report.brake_disc_thickness_rear || 'N/A'}`, 290, 675);

    // 7. Work Completed Section
    doc.fillColor(colors.secondary).font('Helvetica-Bold').fontSize(9).text('TRAVAUX :', 20, 715);
    const workCompleted = JSON.parse(report.work_completed || '{}');
    const worksPerRow = 3;
    const workWidth = 535 / worksPerRow;
    
    Object.entries(workCompleted).forEach(([item, checked], index) => {
      const x = 25 + (index % worksPerRow) * workWidth;
      const y = 730 + Math.floor(index / worksPerRow) * 15;
      doc.fillColor(colors.text).font('Helvetica').fontSize(8)
        .text(truncate(item, 25), x, y, { width: workWidth - 25 });
      drawRect(x + workWidth - 20, y - 2, 15, 8, { fill: checked ? colors.checked : colors.unchecked });
    });

    // Footer
    doc.fontSize(8).text('Page 1/1', 20, 800, { align: 'center', width: 555 });

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