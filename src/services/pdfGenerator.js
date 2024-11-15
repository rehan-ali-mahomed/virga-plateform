const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

// 1. Constants and Configurations (These stay outside functions)
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
    contrast: '#ffffff',
    accent: '#2563eb',
    header: '#334155'
  }
};

const statusColors = {
  good: colors.primary.main,
  warning: colors.primary.main,
  critical: colors.primary.main,
  neutral: colors.primary.main
};

const spacing = {
  xs: 1,
  sm: 2,
  md: 4,
  lg: 8,
  xl: 12,
  xxl: 16
};

const grid = {
  columns: 12,
  gutter: spacing.md,
  containerPadding: spacing.lg,
  maxWidth: 545,
  columnWidth: (545 - (spacing.md * 11)) / 12
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
    size: 12,
    color: colors.primary.contrast
  },
  categoryHeader: {
    font: fonts.bold,
    size: 10,
    color: colors.primary.contrast
  },
  label: {
    font: fonts.medium,
    size: 10,
    color: colors.primary.main
  },
  value: {
    font: fonts.regular,
    size: 10,
    color: colors.primary.main
  },
  itemText: {
    font: fonts.regular,
    size: 10,
    color: colors.primary.main
  }
};

const inspectionGrid = {
  columnCount: 3,
  columnWidth: (grid.maxWidth - (grid.gutter * 2)) / 3,
  rowHeight: spacing.xl,
  headerHeight: spacing.xl,
  itemHeight: spacing.xl,
  itemPadding: spacing.md,
  iconSize: spacing.md
};

// Add back the category mapping
const categoryMapping = {
  'engine': 'MOTEUR',
  'interior': 'INTERIEUR',
  'rear': 'ARRIERE',
  'accessories': 'ACCESSOIRES',
  'front': 'AVANT',
  'work_completed': 'TRAVAUX RÉALISÉS',
  'other': 'AUTRES ÉLÉMENTS'
};

// Add back helper functions
const toSentenceCase = (text) => {
  if (!text) return '';
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
};

// Add back the parseInspectionResults function
const parseInspectionResults = (results) => {
  if (!results) {
    logger.info('No inspection results to parse');
    return {};
  }

  try {
    // Create separate categories for INTERIEUR and ARRIERE
    const organized = results.reduce((acc, result) => {
      if (!result.category) {
        logger.warn(`Found result without category: ${JSON.stringify(result)}`);
        return acc;
      }

      // Get the mapped category name
      const mappedCategory = categoryMapping[result.category] || 'AUTRES ÉLÉMENTS';

      // Initialize category if it doesn't exist
      if (!acc[mappedCategory]) {
        acc[mappedCategory] = [];
      }

      acc[mappedCategory].push({
        name: toSentenceCase(result.name),
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

// Update formatValue to remove true/false display
const formatValue = (item) => {
  if (!item || typeof item.value === 'undefined') return 'Non vérifié';

  try {
    switch (item.type) {
      case 'boolean':
        return ''; // Return empty string to hide true/false values
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

// Add back value evaluation function
const evaluateNumericValue = (value, type) => {
  let status;
  switch (type) {
    case 'percentage':
      status = value >= 75 ? 'good' : value >= 25 ? 'warning' : 'critical';
      return status;
    case 'pressure':
      status = value >= 2.0 && value <= 2.5 ? 'good' :
               value >= 1.8 && value <= 2.7 ? 'warning' : 'critical';
      return status;
    case 'thickness':
      status = value >= 5 ? 'good' : value >= 3 ? 'warning' : 'critical';
      return status;
    default:
      status = value > 0 ? 'good' : 'critical';
      return status;
  }
};

// Définir des constantes pour les hauteurs
const elementHeights = {
  headerHeight: 18,      // Augmenté de 16 à 18
  itemHeight: 16,        // Augmenté de 14 à 16
  padding: {
    vertical: 4,         // Augmenté de 3 à 4
    horizontal: 8        // Augmenté de 6 à 8
  }
};

// Mettre à jour optimizedGrid
const optimizedGrid = {
  columnCount: 3,
  columnWidth: Math.floor((grid.maxWidth - (spacing.lg * 2)) / 3),
  itemHeight: 16,        // Augmenté de 12 à 16 pour accommoder la plus grande taille de police
  headerHeight: 18,      // Augmenté de 14 à 18
  spacing: spacing.xs,   // Utiliser le plus petit espacement
  itemPadding: 6        // Augmenté de 4 à 6
};

// Add the drawInspectionGrid function before generatePDF
const drawInspectionGrid = (doc, currentX, currentY, category, items, optimizedGrid) => {
  // En-tête de catégorie
  doc.roundedRect(currentX, currentY, optimizedGrid.columnWidth, optimizedGrid.headerHeight, 2)
     .fillColor(colors.primary.header)
     .fill();

  // Centrer le texte verticalement et horizontalement
  const textY = currentY + (optimizedGrid.headerHeight - textStyles.categoryHeader.size) / 2;
  doc.font(textStyles.categoryHeader.font)
     .fontSize(textStyles.categoryHeader.size)
     .fillColor(colors.primary.contrast)
     .text(category,
          currentX,
          textY,
          { 
            width: optimizedGrid.columnWidth,
            align: 'center'
          });

  currentY += optimizedGrid.headerHeight + spacing.sm;

  // Items avec texte centré verticalement
  items.forEach((item, index) => {
    const bgColor = index % 2 === 0 ? colors.primary.light : colors.primary.medium;
    
    // Augmentation de la hauteur du rectangle de fond
    doc.roundedRect(currentX, currentY, optimizedGrid.columnWidth, optimizedGrid.itemHeight, 2)
       .fillColor(bgColor)
       .fill();

    // Calcul du centrage vertical avec la nouvelle taille de police
    const textVerticalOffset = (optimizedGrid.itemHeight - textStyles.itemText.size) / 2;
    const itemTextY = currentY + textVerticalOffset;
    
    // Texte de l'item
    doc.font(textStyles.itemText.font)
       .fontSize(textStyles.itemText.size)
       .fillColor(colors.primary.main)
       .text(item.name,
            currentX + elementHeights.padding.horizontal,
            itemTextY,
            { 
              width: optimizedGrid.columnWidth - (elementHeights.padding.horizontal * 2) - spacing.xl,
              align: 'left'
            });

    // Ajustement de la position de l'icône de statut
    drawStatusIcon(
      doc,
      currentX + optimizedGrid.columnWidth - elementHeights.padding.horizontal - spacing.md,
      currentY + (optimizedGrid.itemHeight / 2),
      item
    );

    // Augmentation de l'espacement vertical entre les items
    currentY += optimizedGrid.itemHeight + spacing.sm;
  });

  return currentY;
};

// 2. Helper Functions
const drawSectionHeader = (doc, x, y, width, title) => {
  const headerHeight = inspectionGrid.headerHeight;
  
  doc.save();
  doc.roundedRect(x, y, width, headerHeight, 4)
     .fillColor(colors.primary.main)
     .fill();

  doc.font(textStyles.sectionHeader.font)
     .fontSize(textStyles.sectionHeader.size)
     .fillColor(colors.primary.contrast)
     .text(title, 
           x + grid.gutter, 
           y + (headerHeight - textStyles.sectionHeader.size) / 2,
           { width: width - (grid.gutter * 2) });
  doc.restore();

  return y + headerHeight + grid.gutter;
};

// Update drawStatusIcon implementation
const drawStatusIcon = (doc, x, y, item) => {
  let status = 'neutral';
  
  if (item.type === 'boolean') {
    status = item.value === true ? 'good' : 'critical';
  } else if (item.value !== undefined && item.value !== null) {
    status = evaluateNumericValue(item.value, item.type);
  }

  const iconSize = 8;
  const strokeWidth = 1.5;

  if (status === 'good') {
    doc.strokeColor(colors.primary.accent)
       .lineWidth(strokeWidth)
       .moveTo(x - iconSize/2, y)
       .lineTo(x - iconSize/6, y + iconSize/3)
       .lineTo(x + iconSize/2, y - iconSize/3)
       .stroke();
  } else {
    doc.strokeColor(colors.primary.main)
       .lineWidth(strokeWidth)
       .moveTo(x - iconSize/2, y - iconSize/2)
       .lineTo(x + iconSize/2, y + iconSize/2)
       .moveTo(x + iconSize/2, y - iconSize/2)
       .lineTo(x - iconSize/2, y + iconSize/2)
       .stroke();
  }
};

// Update the header section
const drawHeader = (doc, report) => {
  const headerHeight = 80;  // Hauteur fixe pour toute la section header
  
  // Left side - Company info with larger logo
  doc.save();
  doc.roundedRect(25, 15, headerHeight * 0.75, headerHeight * 0.75, 4)
     .clip();
  doc.image('src/services/company_logo.png', 25, 15, { height: headerHeight * 0.75 });
  doc.restore();

  // Company name with more emphasis
  doc.font(textStyles.mainTitle.font)
     .fontSize(textStyles.mainTitle.size)
     .fillColor(colors.primary.main)
     .text('AUTO PRESTO', 97, 15);

  // Separator line
  doc.moveTo(95, 35)
     .lineTo(300, 35)
     .strokeColor(colors.primary.medium)
     .lineWidth(0.5)
     .stroke();

  // Company info - uniformized
  const companyInfo = [
    { label: 'Adresse', value: '123 Rue Principale, 75000 Paris' },
    { label: 'Téléphone', value: '01 23 45 67 89' },
    { label: 'Email', value: 'contact@autopresto.fr' }
  ];

  let infoY = 42;
  companyInfo.forEach(info => {
    doc.font(textStyles.headerInfo.font)
       .fontSize(textStyles.headerInfo.size)
       .fillColor(colors.primary.main)
       .text(`${info.label}`, 95, infoY);

    doc.font(textStyles.headerInfo.font)
       .text(info.value, 150, infoY);
    infoY += spacing.xl;  // Espacement uniforme
  });

  // Right side - Client info box
  doc.roundedRect(380, 15, 190, headerHeight - 15, 4)  // Ajusté pour correspondre à la hauteur totale
     .fillColor(colors.primary.light)
     .fill();

  // Date header with emphasis
  doc.font(textStyles.headerDate.font)
     .fontSize(textStyles.headerDate.size)
     .fillColor(colors.primary.main)
     .text(` ${new Date(report.date).toLocaleDateString('fr-FR')}`, 390, 20, {
       width: 170,
       align: 'center'
     });

  // Separator line
  doc.moveTo(390, 35)
     .lineTo(560, 35)
     .strokeColor(colors.primary.medium)
     .lineWidth(0.5)
     .stroke();

  // Client details uniformized
  const clientInfo = [
    { label: 'Nom', value: report.client_name || 'N/A' },
    { label: 'Téléphone', value: report.client_phone || 'N/A' },
    { label: 'Email', value: report.client_email || 'N/A' }
  ];

  let clientY = 42;  // Ajusté pour l'espacement après la ligne
  clientInfo.forEach(info => {
    doc.font(textStyles.headerInfo.font)
       .fontSize(textStyles.headerInfo.size)
       .fillColor(colors.primary.main)
       .text(info.label, 390, clientY);

    doc.font(textStyles.headerInfo.font)
       .text(info.value, 460, clientY);
    clientY += spacing.xl;  // Espacement uniforme
  });

  return headerHeight + 5;  // Retourne la hauteur totale + espacement pour la section suivante
};

// Update drawInfoSection with swapped fields
const drawInfoSection = (doc, report, startY) => {
  const sectionWidth = 545;
  const vehicleHeight = 120;
  const columnWidth = (sectionWidth - 60) / 2;
  
  // Définir les informations des colonnes avec positions interchangées
  const leftColumnInfo = [
    { label: 'Immatriculation', value: report.license_plate, bold: true },
    { label: 'Marque', value: report.brand || 'N/A' },
    { label: 'Modèle', value: report.model || 'N/A' },
    { label: 'Mise en circulation', value: report.first_registration_date ? 
      new Date(report.first_registration_date + '-01').toLocaleDateString('fr-FR', { month: 'numeric', year: 'numeric' }) : 'N/A' },
    { label: 'Kilométrage', value: report.mileage ? `${report.mileage} km` : 'N/A' }
  ];

  const rightColumnInfo = [
    { label: 'Code moteur', value: report.engine_code || 'LXLX31' },
    { label: 'Type d\'huile', value: report.revision_oil_type || '5W30' },
    { label: 'Quantité', value: report.revision_oil_volume ? `${report.revision_oil_volume} L` : '7.5 L' },  // "Capacité" remplacé par "Quantité"
    { label: 'Disque avant', value: report.brake_disc_thickness_front ? `${report.brake_disc_thickness_front} mm` : '10 mm' },
    { label: 'Disque arrière', value: report.brake_disc_thickness_rear ? `${report.brake_disc_thickness_rear} mm` : '25 mm' }
  ];

  // Section Véhicule
  doc.roundedRect(25, startY, sectionWidth, vehicleHeight, 4)
     .fillColor(colors.primary.light)
     .fill();

  // Titre VÉHICULE
  doc.roundedRect(25, startY, sectionWidth, 20, 4)
     .fillColor(colors.primary.main)
     .fill();

  doc.font(fonts.bold)
     .fontSize(10)
     .fillColor(colors.primary.contrast)
     .text('VÉHICULE', 25, startY + 5, {
       width: sectionWidth,
       align: 'center'
     });

  // Colonnes d'information véhicule
  let infoY = startY + 30; // Augmenté l'espacement après le titre
  
  // Colonne gauche
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
    infoY += 16; // Espacement entre les lignes
  });

  // Colonne droite
  infoY = startY + 30; // Réinitialiser pour la colonne droite
  rightColumnInfo.forEach(info => {
    doc.font(fonts.medium)
       .fontSize(9)
       .fillColor(colors.primary.main)
       .text(info.label, sectionWidth/2 + 15, infoY);

    doc.font(info.bold ? fonts.bold : fonts.regular)
       .text(info.value, sectionWidth/2 + 15, infoY, {
         width: columnWidth - 20,
         align: 'right'
       });
    infoY += 16;
  });

  // Section Observations - maintenant clairement séparée
  if (report.comments?.trim()) {
    const commentsY = startY + vehicleHeight + spacing.lg; // Ajout d'un espacement après la section véhicule
    const commentsHeight = 100;

    doc.roundedRect(25, commentsY, sectionWidth, commentsHeight, 4)
       .fillColor(colors.primary.light)
       .fill();

    doc.roundedRect(25, commentsY, sectionWidth, 20, 4)
       .fillColor(colors.primary.main)
       .fill();

    doc.font(fonts.bold)
       .fontSize(9)
       .fillColor(colors.primary.contrast)
       .text('OBSERVATIONS', 25, commentsY + 5, {
         width: sectionWidth,
         align: 'center'
       });

    const sanitizeText = (text) => {
        return report.comments.replace(/[^\x20-\x7E\n]/g, ""); // Retire les caractères non imprimables
      };

    doc.font(fonts.regular)
       .fontSize(8)
       .fillColor(colors.primary.main)
       .text(sanitizeText(report.comments), 
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

  return startY + vehicleHeight + spacing.lg;
};

// Add footer drawing function
const drawFooter = (doc, pageHeight) => {
  // Forcer le positionnement sur la première page
  doc.switchToPage(0);
  
  const footerMargin = 30; // Augmenter la marge pour être plus près du bas
  
  // Ligne de séparation
  doc.save()
     .moveTo(25, pageHeight - footerMargin)
     .lineTo(570, pageHeight - footerMargin)
     .strokeColor(colors.primary.medium)
     .lineWidth(0.5)
     .stroke();

  // Copyright
  doc.font(fonts.regular)
     .fontSize(10)
     .fillColor(colors.primary.main)
     .text(
       `© 2024 Auto Presto. Tous droits réservés.`, // Année fixe comme sur la capture
       0,
       pageHeight - footerMargin + 10, // Position plus basse
       {
         align: 'center',
         width: doc.page.width
       }
     );
};

// 3. Main Function
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

      const pdfPath = path.join(__dirname, '..', '..', 'generated_reports', `${report.license_plate}_${report.date}.pdf`);
      const writeStream = fs.createWriteStream(pdfPath);

      doc.pipe(writeStream);

      // Safe calculations with default values
      const pageHeight = doc.page.height || 842; // A4 height
      const pageWidth = doc.page.width || 595;  // A4 width
      const safeMargin = spacing.lg || 24;
      const footerHeight = 25;

      // Draw header and get actual height
      const headerHeight = Math.max(drawHeader(doc, report) || 70, 70);
      
      // Initialize position tracking variables
      let currentY = headerHeight + spacing.md;
      let currentColumn = 0;
      let startY = currentY;
      let maxY = startY;
      
      // Draw info section and get actual height
      const infoSectionHeight = drawInfoSection(doc, report, currentY);
      
      // Parse inspection results
      const inspectionResults = parseInspectionResults(report.inspection_results || []);
      
      // Define the order of categories
      const categoryOrder = [
        'INTERIEUR',
        'MOTEUR',
        'AVANT',
        'ARRIERE',
        'ACCESSOIRES',
        'TRAVAUX RÉALISÉS'
      ];

      // Update currentY for grid start position
      currentY = infoSectionHeight + spacing.lg;
      startY = currentY;
      maxY = startY;

      // Calculer la marge pour centrer les tableaux
      const totalWidth = (optimizedGrid.columnWidth * 3) + (spacing.md * 2); // Ajusté pour un meilleur centrage
      const leftMargin = (pageWidth - totalWidth) / 2;

      // Draw categories in specific order
      categoryOrder.forEach((category) => {
        const items = inspectionResults[category];
        if (!items) return;

        // Utiliser leftMargin au lieu de 25 pour le centrage
        const currentX = leftMargin + (currentColumn * (optimizedGrid.columnWidth + spacing.lg));

        // Draw category and items
        const newY = drawInspectionGrid(doc, currentX, currentY, category, items, optimizedGrid);
        maxY = Math.max(maxY, newY);

        // Update column position
        currentColumn++;
        if (currentColumn >= optimizedGrid.columnCount) {
          currentColumn = 0;
          startY = maxY + spacing.lg;
          currentY = startY;
          maxY = startY;
        } else {
          currentY = startY;
        }
      });

      // Ensure proper spacing before footer
      const finalY = Math.max(currentY, maxY) + spacing.xl;
      
      // Draw footer with safe positioning
      const footerY = Math.min(
        pageHeight - footerHeight + safeMargin,
        finalY + safeMargin
      );

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

// 4. Export
module.exports = { generatePDF };