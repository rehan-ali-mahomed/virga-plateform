const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

// Définition des couleurs globales pour tout le fichier - simplified color scheme
const colors = {
  primary: '#2563eb',      // Main blue color
  secondary: '#94a3b8',    // Changed to lighter gray for categories
  accent: '#059669',       // Success green
  warning: '#ca8a04',      // Warning yellow
  error: '#dc2626',        // Error red
  border: '#e2e8f0',       // Light border
  background: '#f8fafc',   // Very light background
  white: '#ffffff',
  black: '#1e293b',        // Text color
  textGray: '#475569'      // Secondary text color
};

// Table de correspondance pour les catégories
const categoryMapping = {
  'engine': 'MOTEUR',
  'interior': 'INTERIEUR',
  'rear': 'ARRIERE',
  'accessories': 'ACCESSOIRES',
  'front': 'AVANT',
  'work_completed': 'TRAVAUX RÉALISÉS',
  'other': 'AUTRES ÉLÉMENTS'
};

// Add this helper function at the top with other helpers
const toSentenceCase = (text) => {
  if (!text) return '';
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
};

// Fonction pour parser et organiser les résultats d'inspection
const parseInspectionResults = (results) => {
  if (!results) {
    logger.info('No inspection results to parse');
    return {};
  }
  
  try {
    const organized = results.reduce((acc, result) => {
      if (!result.category) {
        logger.warn(`Found result without category: ${JSON.stringify(result)}`);
        return acc;
      }
      
      const mappedCategory = categoryMapping[result.category] || 'AUTRES ÉLÉMENTS';
      
      if (!acc[mappedCategory]) {
        acc[mappedCategory] = [];
      }
      
      acc[mappedCategory].push({
        name: toSentenceCase(result.name),  // Transform name to sentence case
        value: result.value,
        type: result.type,
        status: typeof result.value === 'boolean' ? (result.value ? 'OK' : 'NOK') : result.value
      });
      
      return acc;
    }, {});

    logger.info(`Parsed ${results.length} checks into ${Object.keys(organized).length} categories`);
    return organized;
  } catch (error) {
    logger.error('Error parsing inspection results:', error);
    return {};
  }
};

// Fonction pour formater les valeurs selon leur type
const formatValue = (item) => {
  if (!item || typeof item.value === 'undefined') return 'Non vérifié';

  try {
    switch (item.type) {
      case 'boolean':
        return item.value === true ? 'OK' : 'Non OK';
      case 'number':
        return `${item.value}${item.unit ? ` ${item.unit}` : ''}`;
      case 'pressure':
        return `${item.value} bar`;
      case 'thickness':
        return `${item.value} mm`;
      case 'percentage':
        return `${item.value}%`;
      case 'text':
        return item.value;
      default:
        return String(item.value);
    }
  } catch (error) {
    logger.error('Error formatting value:', error);
    return 'Erreur de format';
  }
};

// Fonction pour évaluer l'état d'une valeur numérique
const evaluateNumericValue = (value, type) => {
  let status;
  switch (type) {
    case 'percentage':
      status = value >= 75 ? 'good' : value >= 25 ? 'warning' : 'critical';
      // logger.info(`Evaluating percentage: ${value}% -> ${status}`);
      return status;
    case 'pressure':
      status = value >= 2.0 && value <= 2.5 ? 'good' : 
               value >= 1.8 && value <= 2.7 ? 'warning' : 'critical';
      // logger.info(`Evaluating pressure: ${value} bar -> ${status}`);
      return status;
    case 'thickness':
      status = value >= 5 ? 'good' : value >= 3 ? 'warning' : 'critical';
      // logger.info(`Evaluating thickness: ${value} mm -> ${status}`);
      return status;
    default:
      status = value > 0 ? 'good' : 'critical';
      // logger.info(`Evaluating numeric value: ${value} -> ${status}`);
      return status;
  }
};

// At the top of the file, after requiring modules
const fonts = {
  regular: 'Helvetica',
  bold: 'Helvetica-Bold',
  medium: 'Helvetica'
};

// Définition des styles de texte unifiés
const textStyles = {
  mainTitle: {
    font: fonts.bold,
    size: 24,
    color: colors.primary
  },
  sectionHeader: {
    font: fonts.bold,
    size: 11,              // Increased from 10
    color: colors.white
  },
  categoryHeader: {
    font: fonts.bold,
    size: 8,               // Reduced from 9
    color: colors.white
  },
  label: {
    font: fonts.regular,
    size: 10,              // Increased from 9
    color: colors.black
  },
  value: {
    font: fonts.regular,
    size: 10,              // Increased from 9
    color: colors.black
  },
  itemText: {
    font: fonts.regular,
    size: 10,              // Increased from 9.5
    color: colors.black
  },
  footer: {
    font: fonts.regular,
    size: 8,
    color: colors.textGray
  }
};

function generatePDF(report) {
  return new Promise((resolve, reject) => {
    if (!report || !report.license_plate) {
      logger.error('Invalid report data provided:', report);
      reject(new Error('Invalid report data'));
      return;
    }

    logger.info('Starting PDF generation for report:', {
      report_id: report.report_id,
      license_plate: report.license_plate
    });

    // Initialize document with refined margins
    const doc = new PDFDocument({ 
      size: 'A4', 
      margin: 20,          // Slightly increased for better spacing
      bufferPages: true
    });
    const pdfPath = path.join(__dirname, '..', '..', 'generated_reports', `${report.license_plate}_${report.date}.pdf`);
    const writeStream = fs.createWriteStream(pdfPath);

    doc.pipe(writeStream);

    // Fonction améliorée pour dessiner les indicateurs de statut
    const drawStatusIcon = (x, y, item) => {
      let status = 'neutral';
      
      doc.save();
      
      // Détermination du statut
      if (item.type === 'boolean') {
        status = item.value === true ? 'good' : 'critical';
      } else if (item.value !== undefined && item.value !== null) {
        status = evaluateNumericValue(item.value, item.type);
      } else {
        status = 'neutral';
      }

      // Couleur selon le statut
      const statusColors = {
        good: colors.accent,
        warning: colors.warning,
        critical: colors.error,
        neutral: colors.secondary
      };

      // Adjust radius based on status
      const radius = status === 'good' ? 4.5 : 5.5;

      // White circle with colored border for good status
      // Colored circle with white icon for warning/critical
      if (status === 'good') {
        doc.circle(x, y, radius)
           .fillColor(colors.white)
           .fill()
           .strokeColor(statusColors[status])
           .lineWidth(1.2)
           .stroke();
      } else {
        doc.circle(x, y, radius)
           .fillColor(statusColors[status])
           .fill();
      }

      // Draw the icon
      doc.strokeColor(status === 'good' ? statusColors[status] : colors.white)
         .lineWidth(status === 'good' ? 1.2 : 1.5);

      switch (status) {
        case 'good':
          doc.moveTo(x - 2.5, y)
             .lineTo(x, y + 2.5)
             .lineTo(x + 3, y - 2.5)
             .stroke();
          break;
        case 'critical':
          doc.moveTo(x - 3, y - 3)
             .lineTo(x + 3, y + 3)
             .moveTo(x + 3, y - 3)
             .lineTo(x - 3, y + 3)
             .stroke();
          break;
        case 'warning':
          doc.moveTo(x, y - 3)
             .lineTo(x, y + 1)
             .stroke()
          doc.circle(x, y + 3, 1)
             .fillColor(colors.white)
             .fill();
          break;
      }
      
      doc.restore();
    };

    // Helper function for creating modern section headers - more discrete
    const createSectionHeader = (title, y) => {
      doc.save();
      doc.roundedRect(25, y, 545, 20, 4)
         .fill(colors.primary);

      doc.font(textStyles.sectionHeader.font)
         .fontSize(textStyles.sectionHeader.size)
         .fillColor(textStyles.sectionHeader.color)
         .text(title, 35, y + 5);

      doc.restore();
      return y + 24;
    };

    // Optimize header with bigger logo and better layout
    doc.image('src/services/company_logo.png', 25, 15, { width: 65 });  // Increased width

    // Company name
    doc.font(textStyles.mainTitle.font)
       .fontSize(textStyles.mainTitle.size)
       .fillColor(textStyles.mainTitle.color)
       .text('AUTO PRESTO', 100, 15);

    // Separator line with more subtle style
    doc.moveTo(100, 45)
       .lineTo(350, 45)
       .strokeColor(colors.border)
       .lineWidth(0.8)                        // Slightly thicker
       .stroke();

    // Company info with better organization and hierarchy
    const companyInfoLeft = [
      { label: 'Adresse', value: '123 Rue Principale' },
      { value: '75000 Paris, France' },
      { label: 'Tél', value: '01 23 45 67 89', bold: true }
    ];

    let infoY = 52;
    companyInfoLeft.forEach(info => {
      if (info.label) {
        doc.font(fonts.medium)
           .fontSize(9)                           // Increased from 8
           .fillColor(colors.textGray)
           .text(info.label + ' :', 100, infoY);
        
        doc.font(info.bold ? fonts.bold : fonts.regular)
           .fontSize(9.5)                         // Increased from 8.5
           .fillColor(colors.black)
           .text(info.value, 145, infoY);
      } else {
        doc.font(fonts.regular)
           .fontSize(9.5)
           .fillColor(colors.black)
           .text(info.value, 145, infoY);
      }
      infoY += 10;
    });

    // Contact info on the right
    doc.font('Helvetica-Bold')
       .fontSize(8)
       .fillColor(colors.secondary)
       .text('Email :', 280, 52);

    doc.font('Helvetica')
       .fontSize(8.5)
       .fillColor(colors.primary)
       .text('contact@autopresto.fr', 315, 52);

    // Report info with enhanced styling
    doc.roundedRect(430, 15, 140, 45, 3)
       .fillColor(colors.background)
       .fill();

    doc.font('Helvetica-Bold')
       .fontSize(9)
       .fillColor(colors.primary)
       .text('RAPPORT N°', 440, 20);

    doc.font('Helvetica-Bold')
       .fontSize(10)
       .fillColor(colors.black)
       .text(report.id, 505, 20);

    doc.font('Helvetica-Bold')
       .fontSize(9)
       .fillColor(colors.primary)
       .text('Date :', 440, 35);

    doc.font('Helvetica-Bold')
       .fontSize(9)
       .fillColor(colors.black)
       .text(new Date(report.date).toLocaleDateString('fr-FR'), 505, 35);

    let yPosition = 105;  // Increased from 90 to add more space

    // Add separator line before INFORMATIONS section
    doc.moveTo(25, yPosition - 10)
       .lineTo(570, yPosition - 10)
       .strokeColor(colors.border)
       .lineWidth(0.5)
       .stroke();

    // Vehicle and Client Info Section Header
    yPosition = createSectionHeader('INFORMATIONS', yPosition);

    // Create side-by-side sections
    const sectionWidth = 255;
    const spacing = 20;

    // Left section - Vehicle Information
    doc.save();
    doc.roundedRect(25, yPosition, sectionWidth, 85, 4)
       .fill(colors.background);
    doc.restore();

    // Vehicle header with same color as sections
    doc.save();
    doc.roundedRect(25, yPosition, sectionWidth, 20, 3)
       .fill(colors.secondary);          // Using secondary color for subsections
    
    doc.font(fonts.bold)
       .fontSize(9)
       .fillColor(colors.white)
       .text('VÉHICULE', 35, yPosition + 6);
    doc.restore();

    const vehicleInfo = [
      { label: 'Immatriculation', value: report.license_plate, bold: true },
      { label: 'Type d\'huile', value: report.revision_oil_type },
      { label: 'Capacité', value: `${report.revision_oil_volume} L` },
      { label: 'Disque avant', value: `${report.brake_disc_thickness_front} mm` },
      { label: 'Disque arrière', value: `${report.brake_disc_thickness_rear} mm` }
    ];

    vehicleInfo.forEach((info, index) => {
      // Label on left without colon
      doc.font(textStyles.label.font)
         .fontSize(textStyles.label.size)
         .fillColor(textStyles.label.color)
         .text(info.label, 35, yPosition + 25 + (index * 13));
      
      // Value on right
      doc.font(info.bold ? fonts.bold : textStyles.value.font)
         .fontSize(textStyles.value.size)
         .fillColor(textStyles.value.color)
         .text(info.value || 'N/A', 
              35, yPosition + 25 + (index * 13), {
                width: sectionWidth - 15,
                align: 'right'
              });
    });

    // Right section - Client Information with matching style
    doc.save();
    doc.roundedRect(25 + sectionWidth + spacing, yPosition, sectionWidth, 85, 4)
       .fill(colors.background);

    // Client header with category style
    doc.roundedRect(25 + sectionWidth + spacing, yPosition, sectionWidth, 18, 2)
       .fill(colors.secondary);          // Using secondary color
    
    doc.font('Helvetica-Bold')
       .fontSize(8)
       .fillColor(colors.white)
       .text('CLIENT', 35 + sectionWidth + spacing, yPosition + 5);
    doc.restore();

    const clientInfo = [
      { label: 'Nom', value: report.client_name },
      { label: 'Téléphone', value: report.client_phone },
      { label: 'Email', value: report.client_email }
    ];

    clientInfo.forEach((info, index) => {
      // Label on left without colon
      doc.font(textStyles.label.font)
         .fontSize(textStyles.label.size)
         .fillColor(textStyles.label.color)
         .text(info.label, 
              35 + sectionWidth + spacing, 
              yPosition + 25 + (index * 13));   // Increased spacing
      
      // Value on right
      doc.font(fonts.regular)
         .fontSize(10)                          // Increased from 9
         .fillColor(colors.black)
         .text(info.value || 'N/A', 
              35 + sectionWidth + spacing, 
              yPosition + 25 + (index * 13), {
                width: sectionWidth - 15,
                align: 'right'
              });
    });

    yPosition += 100;

    // Comments Section with matching style
    if (report.comments && report.comments.trim()) {
      yPosition = createSectionHeader('OBSERVATIONS', yPosition);

      doc.save();
      doc.roundedRect(25, yPosition, 545, 55, 3)  // Reduced height
         .fillColor(colors.background)
         .fillOpacity(0.5)
         .fill();

      doc.font(fonts.regular)
         .fontSize(10)                          // Increased from 9.5
         .fillColor(colors.black)               // Changed from textGray to black
         .fillOpacity(1)
         .text(report.comments, 35, yPosition + 8, {
           width: 525,
           height: 40,
           lineGap: 4,                          // Increased from 3
           align: 'justify'
         });

      doc.restore();
      yPosition += 65;                          // Reduced spacing
    } else {
      yPosition += 10;
    }

    // Inspection Points Section (already using createSectionHeader)
    yPosition = createSectionHeader('POINTS DE CONTRÔLE', yPosition);

    // Configuration for inspection points with better spacing
    const columnWidth = 170;    // Adjusted for better proportions
    const margin = 25;          // Better alignment
    const columns = 3;
    const itemHeight = 16;                // Reduced from 18
    const itemPadding = 5;
    const columnSpacing = 8;    // More space between columns

    let currentColumn = 0;
    let startY = yPosition + 5; // Réduit
    let currentY = startY;
    let maxY = startY;

    // Parse and organize inspection results
    const inspectionResults = parseInspectionResults(report.inspection_results);

    // Render inspection points by category
    Object.entries(inspectionResults).forEach(([category, items]) => {
      const currentX = margin + (currentColumn * (columnWidth + columnSpacing));
      
      // En-tête de catégorie plus discret
      const categoryHeaderHeight = 16;      // Reduced from 18
      
      doc.save();
      doc.roundedRect(currentX, currentY, columnWidth, categoryHeaderHeight, 2)  // Reduced corner radius
         .fill(colors.secondary);
      
      // Adjust category text position
      const textHeight = 8;
      const yOffset = (categoryHeaderHeight - textHeight) / 2;
      
      doc.font(textStyles.categoryHeader.font)
         .fontSize(textStyles.categoryHeader.size)
         .fillColor(textStyles.categoryHeader.color)
         .text(category, 
              currentX + 6, 
              currentY + yOffset,
              { width: columnWidth - 12 });
      doc.restore();
      
      currentY += categoryHeaderHeight + 1;  // Reduced spacing after category header

      // Items avec design plus raffiné - increased visibility
      items.forEach((item) => {
        doc.save();
        
        // Determine status for background color
        let status = 'neutral';
        if (item.type === 'boolean') {
          status = item.value === true ? 'good' : 'critical';
        } else if (item.value !== undefined && item.value !== null) {
          status = evaluateNumericValue(item.value, item.type);
        }

        // Background color based on status with reduced opacity
        const statusColors = {
          good: colors.accent,
          warning: colors.warning,
          critical: colors.error,
          neutral: colors.secondary
        };

        const rowBackground = status === 'good' ? 
          (items.indexOf(item) % 2 === 0 ? colors.background : colors.white) : 
          statusColors[status];

        doc.roundedRect(currentX, currentY, columnWidth, itemHeight, 2)
           .fillColor(rowBackground)
           .fillOpacity(status === 'good' ? 0.7 : 0.15)  // More subtle backgrounds
           .fill();

        // Nom de l'item - more visible
        doc.font(fonts.regular)
           .fontSize(9.5)
           .fillColor(status === 'good' ? colors.black : statusColors[status])
           .fillOpacity(1)
           .text(item.name, 
                currentX + 10,                    // More padding
                currentY + (itemHeight/2) - 4,
                { width: columnWidth - 28 });     // Adjusted for icon space

        // Status icon - slightly adjusted position
        drawStatusIcon(
          currentX + columnWidth - 16,           // Better icon placement
          currentY + (itemHeight / 2),
          item
        );

        doc.restore();
        
        currentY += itemHeight;
        maxY = Math.max(maxY, currentY);
      });

      // Gestion des colonnes avec moins d'espace
      currentColumn++;
      if (currentColumn >= columns) {
        currentColumn = 0;
        startY = maxY + 5;
      }
      currentY = startY;
    });

    // Footer with refined style
    doc.font(textStyles.footer.font)
       .fontSize(textStyles.footer.size)
       .fillColor(textStyles.footer.color)
       .text('© 2024 Auto Presto. Tous droits réservés.', 30, 815, {
         align: 'center', 
         width: 535,
         opacity: 0.85,
         baseline: 'bottom'
       });

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