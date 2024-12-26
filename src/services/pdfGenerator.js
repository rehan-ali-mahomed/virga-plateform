const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');
const SVGtoPDF = require('svg-to-pdfkit');

PDFDocument.prototype.addSVG = function(svg, x, y, options) {
  return SVGtoPDF(this, svg, x, y, options);
};

// Core styling constants
const fonts = {
  regular: 'Helvetica',
  bold: 'Helvetica-Bold',
  medium: 'Helvetica'
};

const colors = {
  primary: {
    main: '#1e293b',
    light: '#f8fafc',
    medium: '#e2e8f0',
    contrast: '#ffffff'
  }
};

const spacing = {
  xs: 1,
  sm: 2,
  md: 4,
  lg: 8,
  xl: 12,
  xxl: 16
};

const textStyles = {
  mainTitle: {
    font: fonts.bold,
    size: 20,
    color: colors.primary.main
  },
  headerDate: {
    font: fonts.bold,
    size: 13,
    color: colors.primary.main
  },
  headerInfo: {
    font: fonts.regular,
    size: 9,
    color: colors.primary.main
  },
  sectionHeader: {
    font: fonts.bold,
    size: 11,
    color: colors.primary.contrast
  },
  itemText: {
    font: fonts.regular,
    size: 11,
    color: colors.primary.main
  }
};

// Optimized grid settings
const optimizedGrid = {
  columnCount: 3,
  columnWidth: Math.floor((545 - (spacing.lg * 2)) / 3),
  itemHeight: 16,
  headerHeight: 18,
  spacing: spacing.xs,
  itemPadding: 6
};

const organizeInspectionResults = (results) => {
  if (!results || !Array.isArray(results)) {
    logger.warn('No inspection results to organize or invalid format');
    return {};
  }

  try {
    return results.reduce((acc, result) => {
      if (!result.category) {
        logger.warn('Found result without category:', { result });
        return acc;
      }

      const mappedCategory = result.category.toUpperCase();

      if (!acc[mappedCategory]) {
        acc[mappedCategory] = [];
      }

      acc[mappedCategory].push({
        name: result.name,
        value: result.value || 'Non Vérifier',
        type: result.type || 'options',
        status: result.value === 'Conforme' ? 'good' : 
                result.value === 'Pas bon' ? 'critical' : 
                'neutral'
      });

      return acc;
    }, {});
  } catch (error) {
    logger.error('Error organizing inspection results:', { error: error.message });
    return {};
  }
};

const drawHeader = (doc, report) => {
  const headerHeight = 80;  
  
  // Left side - Company logo
  doc.save();
  doc.roundedRect(25, 15, headerHeight * 0.75, headerHeight * 0.75, 4)
     .clip();
  doc.image(path.join(process.cwd(), 'public', 'img', 'company_logo.png'), 25, 15, { height: headerHeight * 0.75 });
  doc.restore();

  // Company name
  doc.font(textStyles.mainTitle.font)
     .fontSize(textStyles.mainTitle.size)
     .fillColor(colors.primary.main)
     .text(process.env.COMPANY_NAME, 97, 15);

  // Separator line
  doc.moveTo(95, 35)
     .lineTo(300, 35)
     .strokeColor(colors.primary.medium)
     .lineWidth(0.5)
     .stroke();

  // Company info
  const companyInfo = [
    { label: 'Adresse', value: process.env.COMPANY_ADDRESS },
    { label: 'Téléphone', value: process.env.COMPANY_PHONE },
    { label: 'Email', value: process.env.COMPANY_EMAIL }
  ];

  let infoY = 42;
  companyInfo.forEach(info => {
    doc.font(textStyles.headerInfo.font)
       .fontSize(textStyles.headerInfo.size)
       .fillColor(colors.primary.main)
       .text(`${info.label}`, 95, infoY);

    doc.font(textStyles.headerInfo.font)
       .text(info.value, 140, infoY);
    infoY += spacing.xl;
  });

  // Right side - Client info box
  doc.roundedRect(380, 15, 190, headerHeight - 15, 4)
     .fillColor(colors.primary.light)
     .fill();

  doc.font(textStyles.headerDate.font)
     .fontSize(textStyles.headerDate.size)
     .fillColor(colors.primary.main)
     .text(` ${new Date(report.created_at).toLocaleDateString('fr-FR')}`, 390, 20, {
       width: 170,
       align: 'center'
     });

  doc.moveTo(390, 35)
     .lineTo(560, 35)
     .strokeColor(colors.primary.medium)
     .lineWidth(0.5)
     .stroke();

  const clientInfo = [
    { label: 'Nom', value: report.client_name || 'N/A' },
    { label: 'Téléphone', value: report.client_phone || 'N/A' },
    { label: 'Email', value: report.client_email || 'N/A' }
  ];

  let clientY = 42;
  clientInfo.forEach(info => {
    doc.font(textStyles.headerInfo.font)
       .fontSize(textStyles.headerInfo.size)
       .fillColor(colors.primary.main)
       .text(info.label, 390, clientY);

    doc.font(textStyles.headerInfo.font)
       .text(info.value, 440, clientY);
    clientY += spacing.xl;
  });

  return headerHeight + 5;
};

const drawInfoSection = (doc, report, startY) => {
  const sectionWidth = 545;
  const infoHeight = 16;
  const columnWidth = (sectionWidth - 60) / 2;

  const leftColumnInfo = [
    { label: 'Immatriculation', value: report.license_plate, bold: true },
    { label: 'Marque', value: report.brand || 'N/A' },
    { label: 'Modèle', value: report.model || 'N/A' },
    { label: 'Kilométrage', value: report.mileage ? `${report.mileage} km` : 'N/A' },
    { label: 'Mise en circulation', value: report.first_registration_date ? 
      new Date(report.first_registration_date).toLocaleDateString('fr-FR') : 'N/A' },
    { label: 'Prochain C.T', value: report.next_technical_inspection ? 
      new Date(report.next_technical_inspection).toLocaleDateString('fr-FR') : 'N/A' },
  ];

  const rightColumnInfo = [
    { label: 'Code moteur', value: report.engine_code || 'N/A' },
    { label: 'Type d\'huile', value: report.revision_oil_type || 'N/A' },
    { label: 'Quantité / Serrage', value: `${report.revision_oil_volume ? `${report.revision_oil_volume} L` : 'N/A'} / ${report.drain_plug_torque ? `${report.drain_plug_torque} Nm` : 'N/A'}` },
    { label: 'Disques avant (mm)', value: report.brake_disc_thickness_front ? `${report.brake_disc_thickness_front}` : 'N/A' },
    { label: 'Disques arrière (mm)', value: report.brake_disc_thickness_rear ? `${report.brake_disc_thickness_rear}` : 'N/A' },
    { label: 'Filtres révision', value: report.filters || 'N/A' }
  ];

  const vehiculeHeight = Math.max(infoHeight * leftColumnInfo.length, infoHeight * rightColumnInfo.length) + infoHeight + spacing.lg;
  
  doc.roundedRect(25, startY, sectionWidth, vehiculeHeight, 4)
     .fillColor(colors.primary.light)
     .fill();

  doc.roundedRect(25, startY, sectionWidth, 20, 4)
     .fillColor(colors.primary.main)
     .fill();

  doc.font(textStyles.sectionHeader.font)
     .fontSize(textStyles.sectionHeader.size)
     .fillColor(colors.primary.contrast)
     .text('VÉHICULE', 25, startY + 5, {
       width: sectionWidth,
       align: 'center'
     });

  let infoY = startY + 27;
  
  // Draw left column
  leftColumnInfo.forEach(info => {
    doc.font(fonts.medium)
       .fontSize(9)
       .fillColor(colors.primary.main)
       .text(info.label, 35, infoY);

    doc.font(info.bold ? fonts.bold : fonts.regular)
       .text(info.value, 35, infoY, {
         width: columnWidth - 20,
         align: 'right'
       });
    infoY += infoHeight;
  });

  // Draw right column
  infoY = startY + 27;
  rightColumnInfo.forEach(info => {
    doc.font(fonts.medium)
       .fontSize(9)
       .fillColor(colors.primary.main)
       .text(info.label, sectionWidth/2 + 15, infoY);

    doc.font(info.bold ? fonts.bold : fonts.regular)
       .text(info.value, sectionWidth/2 + 50, infoY, {
         width: columnWidth - 10,
         align: 'right'
       });
    infoY += infoHeight;
  });

  infoY += spacing.lg;

  // Draw comments section if present
  if (report.comments?.trim()) {
    const commentsY = startY + vehiculeHeight + spacing.lg;
    const commentsHeight = 100;

    doc.roundedRect(25, commentsY, sectionWidth, commentsHeight, 4)
       .fillColor(colors.primary.light)
       .fill();

    doc.roundedRect(25, commentsY, sectionWidth, 20, 4)
       .fillColor(colors.primary.main)
       .fill();

    doc.font(textStyles.sectionHeader.font)
       .fontSize(textStyles.sectionHeader.size)
       .fillColor(colors.primary.contrast)
       .text('OBSERVATIONS', 25, commentsY + 5, {
         width: sectionWidth,
         align: 'center'
       });

    doc.font(fonts.regular)
       .fontSize(8)
       .fillColor(colors.primary.main)
       .text(report.comments.replace(/[^\x20-\x7E\n]/g, ""), 
            35, 
            commentsY + 25, 
            {
              width: sectionWidth - 40,
              height: commentsHeight - 35,
              lineGap: 3,
              paragraphGap: 3,
              align: 'left'
            });

    return commentsY + commentsHeight + spacing.lg;
  }

  return startY + vehiculeHeight + spacing.lg;
};

const drawInspectionGrid = (doc, x, y, results, options) => {
  let currentY = y;
  const sectionWidth = 170; // Width for each category section
  const spacing = 12; // Space between sections
  const categories = Object.entries(results);
  const lineHeight = 22;
  
  // Process categories in groups of 3
  for (let i = 0; i < categories.length; i += 3) {
    const rowCategories = categories.slice(i, i + 3);
    let maxHeight = 0;
    
    // Draw each category in the row
    rowCategories.forEach(([ category, items ], index) => {
      const xPos = x + (sectionWidth + spacing) * index;
      let yPos = currentY;
      
      // Draw background for the entire section
      doc.roundedRect(xPos, yPos, sectionWidth, 
                     (items.length + 1) * lineHeight,
                     4)
         .fillColor(colors.primary.light)
         .fill();
      
      // Draw category header with smaller height and new color
      doc.roundedRect(xPos, yPos, sectionWidth, 18, 4)
         .fillColor('#2596be')
         .fill();

      // Center the text vertically and horizontally
      doc.font(textStyles.sectionHeader.font)
         .fontSize(textStyles.sectionHeader.size)
         .fillColor(colors.primary.contrast)
         .text(category, 
               xPos, 
               yPos + (18 - textStyles.sectionHeader.size) / 2, // Center vertically
               { 
                 width: sectionWidth,
                 align: 'center',
                 lineGap: 0
               });

      yPos += lineHeight;

      // Draw items
      items.forEach(item => {
        doc.font(textStyles.itemText.font)
           .fontSize(textStyles.itemText.size)
           .fillColor(textStyles.itemText.color)
           .text(item.name, 
                 xPos + 10, 
                 yPos + (18 - textStyles.itemText.size) / 2,
                 { width: sectionWidth - 40 });

        if (item.type === 'options') {
          if (fs.existsSync(item.value.icon_absolute_path)) {
            const svgContent = fs.readFileSync(item.value.icon_absolute_path, 'utf8');
            doc.addSVG(svgContent, 
                      xPos + sectionWidth - 25, 
                      yPos, 
                      { width: 16, height: 16 });
          }
        }

        yPos += lineHeight;
      });

      const sectionHeight = yPos - currentY;
      maxHeight = Math.max(maxHeight, sectionHeight);
    });

    currentY += maxHeight + spacing;
  }
  
  return currentY;
};

const drawFooter = (doc, pageHeight) => {
  const footerMargin = 30;
  
  doc.save()
     .moveTo(25, pageHeight - footerMargin)
     .lineTo(570, pageHeight - footerMargin)
     .strokeColor(colors.primary.medium)
     .lineWidth(0.5)
     .stroke();

  doc.font(fonts.regular)
     .fontSize(9)
     .fillColor(colors.primary.main)
     .text(
      // This pdf has been generated by Auto Presto
       `Ce document a été généré automatiquement par ${process.env.COMPANY_NAME}. © ${new Date().getFullYear()} Tous droits réservés.`,
       0,
       pageHeight - footerMargin + 10,
       {
         align: 'center',
         width: doc.page.width
       }
     );
};

const generatePDF = (report) => {
  return new Promise((resolve, reject) => {
    try {
      if (!report || !report.license_plate) {
        throw new Error('Invalid report data');
      }

      const doc = new PDFDocument({
        size: 'A4',
        margin: spacing.lg,
        bufferPages: true
      });

      const date = new Date();
      const formattedDate = `${date.getDate().toString().padStart(2, '0')}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getFullYear()}`;
      const tempFileName = `${report.license_plate}_${formattedDate}.pdf`;
      const pdfPath = path.join(__dirname, '..', '..', 'generated_reports', tempFileName);
      const writeStream = fs.createWriteStream(pdfPath);

      doc.pipe(writeStream);

      const pageHeight = doc.page.height;
      const headerHeight = drawHeader(doc, report);
      let currentY = headerHeight + spacing.md;
      
      currentY = drawInfoSection(doc, report, currentY);
      
      const organizedResults = organizeInspectionResults(report.inspection_results || []);
      currentY = drawInspectionGrid(doc, 25, currentY, organizedResults, optimizedGrid);
      
      drawFooter(doc, pageHeight);

      doc.end();

      writeStream.on('finish', () => resolve(pdfPath));
      writeStream.on('error', reject);

    } catch (error) {
      logger.error('Error generating PDF:', error);
      reject(error);
    }
  });
};

module.exports = { generatePDF };
