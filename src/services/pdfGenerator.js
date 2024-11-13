const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

// Define inspection points structure at the top of the file
const defaultInspections = {
  'PNEUMATIQUES': [
    { id: 'pneu_av', name: 'Pneus avant', description: 'État et profondeur' },
    { id: 'pneu_ar', name: 'Pneus arrière', description: 'État et profondeur' },
    { id: 'pression', name: 'Pression des pneus', description: 'Conforme préconisation' }
  ],
  'FREINAGE': [
    { id: 'plaq_av', name: 'Plaquettes avant', description: 'Épaisseur min 3mm' },
    { id: 'plaq_ar', name: 'Plaquettes arrière', description: 'Épaisseur min 3mm' },
    { id: 'disq_av', name: 'Disques avant', description: 'État et usure' },
    { id: 'disq_ar', name: 'Disques arrière', description: 'État et usure' },
    { id: 'liq_frein', name: 'Liquide de frein', description: 'Niveau et qualité' }
  ],
  'VISIBILITÉ': [
    { id: 'essuie_av', name: 'Essuie-glaces avant', description: 'État et efficacité' },
    { id: 'essuie_ar', name: 'Essuie-glace arrière', description: 'État et efficacité' },
    { id: 'lave_glace', name: 'Lave-glace', description: 'Niveau et fonctionnement' },
    { id: 'phares', name: 'Éclairage avant', description: 'Fonctionnement' },
    { id: 'feux_ar', name: 'Feux arrière', description: 'Fonctionnement' }
  ],
  'MOTEUR': [
    { id: 'huile', name: 'Niveau huile', description: 'Niveau et qualité' },
    { id: 'refroid', name: 'Liquide refroidissement', description: 'Niveau et qualité' },
    { id: 'courroie', name: 'Courroie accessoires', description: 'État et tension' },
    { id: 'echap', name: 'Ligne échappement', description: 'État et fixation' },
    { id: 'durites', name: 'Durites/flexibles', description: 'État et étanchéité' }
  ],
  'SUSPENSION': [
    { id: 'amort_av', name: 'Amortisseurs avant', description: 'État et efficacité' },
    { id: 'amort_ar', name: 'Amortisseurs arrière', description: 'État et efficacité' },
    { id: 'rotules', name: 'Rotules/triangles', description: 'Jeu et état' },
    { id: 'silent', name: 'Silentblocs', description: 'État et fixation' }
  ]
};

function generatePDF(report) {
  return new Promise((resolve, reject) => {
    // Initialize document with better margins and layout
    const doc = new PDFDocument({ 
      size: 'A4', 
      margin: 30,
      bufferPages: true // Enable page buffering for headers/footers
    });
    const pdfPath = path.join(__dirname, '..', '..', 'generated_reports', `${report.license_plate}_${report.date}.pdf`);
    const writeStream = fs.createWriteStream(pdfPath);

    doc.pipe(writeStream);

    // Enhanced color palette
    const colors = {
      primary: '#1a73e8',      // Modern blue
      secondary: '#5f6368',    // Dark gray
      accent: '#34a853',       // Success green
      border: '#e8eaed',       // Light gray
      background: '#f8f9fa',   // Very light gray
      white: '#ffffff',
      black: '#202124'
    };

    // Helper function for creating modern section headers
    const createSectionHeader = (title, y) => {
      const gradient = doc.linearGradient(25, y, 570, y + 20);
      gradient.stop(0, colors.primary)
             .stop(1, '#4285f4');

      doc.save();
      doc.rect(25, y, 545, 20);
      doc.fill(gradient);

      doc.font('Helvetica-Bold')
         .fontSize(10)
         .fillColor(colors.white)
         .text(title, 35, y + 5);

      doc.restore();
      return y + 25;
    };

    // Optimize header to take less space
    doc.image('src/services/company_logo.png', 30, 25, { width: 45 });

    doc.font('Helvetica-Bold')
       .fontSize(18)
       .fillColor(colors.primary)
       .text('AUTO PRESTO', 85, 30);

    doc.font('Helvetica')
       .fontSize(8)
       .fillColor(colors.secondary)
       .text('123 Rue Principale, Ville, Pays', 85, 50)
       .text('Téléphone : 0123456789', 85, 60);

    // Report info in top right
    doc.font('Helvetica')
       .fontSize(8)
       .text(`Rapport N° ${report.id}`, 430, 30)
       .text(`Date: ${new Date(report.date).toLocaleDateString('fr-FR')}`, 430, 40);

    let yPosition = 90;

    // Create side-by-side sections for vehicle and client info
    const sectionWidth = 260;
    const spacing = 25;

    // Left section - Vehicle Information
    doc.rect(25, yPosition, sectionWidth, 100)
       .fill(colors.background);

    doc.font('Helvetica-Bold')
       .fontSize(10)
       .fillColor(colors.primary)
       .text('INFORMATIONS VÉHICULE', 35, yPosition + 10);

    const vehicleInfo = [
      { label: 'Immatriculation:', value: report.license_plate },
      { label: 'Type d\'huile:', value: report.revision_oil_type },
      { label: 'Capacité:', value: `${report.revision_oil_volume} L` },
      { label: 'Disque avant:', value: `${report.brake_disc_thickness_front} mm` },
      { label: 'Disque arrière:', value: `${report.brake_disc_thickness_rear} mm` }
    ];

    vehicleInfo.forEach((info, index) => {
      doc.font('Helvetica-Bold')
         .fontSize(8)
         .fillColor(colors.secondary)
         .text(info.label, 35, yPosition + 30 + (index * 14));
         
      doc.font('Helvetica')
         .fontSize(8)
         .fillColor(colors.black)
         .text(info.value || 'N/A', 120, yPosition + 30 + (index * 14));
    });

    // Right section - Client Information
    doc.rect(25 + sectionWidth + spacing, yPosition, sectionWidth, 100)
       .fill(colors.background);

    doc.font('Helvetica-Bold')
       .fontSize(10)
       .fillColor(colors.primary)
       .text('INFORMATIONS CLIENT', 35 + sectionWidth + spacing, yPosition + 10);

    const clientInfo = [
      { label: 'Nom:', value: report.client_name },
      { label: 'Téléphone:', value: report.client_phone },
      { label: 'Email:', value: report.client_email }
    ];

    clientInfo.forEach((info, index) => {
      doc.font('Helvetica-Bold')
         .fontSize(8)
         .fillColor(colors.secondary)
         .text(info.label, 35 + sectionWidth + spacing, yPosition + 30 + (index * 14));
         
      doc.font('Helvetica')
         .fontSize(8)
         .fillColor(colors.black)
         .text(info.value || 'N/A', 120 + sectionWidth + spacing, yPosition + 30 + (index * 14));
    });

    yPosition += 120; // Move to inspection points section

    // Inspection Points Section
    yPosition = createSectionHeader('POINTS DE CONTRÔLE', yPosition);

    // Optimize inspection points layout
    const columnWidth = 165;
    const margin = 35;
    const columns = 3;
    const itemHeight = 20; // Reduced height

    let currentColumn = 0;
    let startY = yPosition + 10;
    let currentY = startY;
    let maxY = startY;

    // Update the inspection points rendering to use report data
    Object.entries(defaultInspections).forEach(([category, items]) => {
      const currentX = margin + (currentColumn * (columnWidth + 10));
      
      // Category header
      doc.font('Helvetica-Bold')
         .fontSize(8)
         .fillColor(colors.primary)
         .text(category, currentX, currentY);
      
      currentY += 12;

      // Render items with actual status from report
      items.forEach((item) => {
        // Get status from report data
        const inspectionResult = report.inspection_results?.find(r => r.id === item.id);
        const isChecked = inspectionResult?.status || false;

        // Checkbox
        if (isChecked) {
          doc.circle(currentX, currentY + 3, 2.5)
             .fill(colors.accent);
        } else {
          doc.circle(currentX, currentY + 3, 2.5)
             .strokeColor(colors.secondary)
             .stroke();
        }

        // Item name and description
        doc.font('Helvetica-Bold')
           .fontSize(7)
           .fillColor(colors.black)
           .text(item.name, currentX + 7, currentY);
        
        doc.font('Helvetica')
           .fontSize(6)
           .fillColor(colors.secondary)
           .text(item.description, currentX + 7, currentY + 8);
        
        currentY += itemHeight;
        maxY = Math.max(maxY, currentY);
      });

      // Move to next column
      currentColumn++;
      if (currentColumn >= columns) {
        currentColumn = 0;
        startY = maxY + 10;
      }
      currentY = startY;
    });

    yPosition = maxY + 20;

    // Comments section
    yPosition = createSectionHeader('COMMENTAIRES', yPosition);

    doc.rect(35, yPosition, 525, 50)
       .fill(colors.background);
       
    doc.font('Helvetica')
       .fontSize(8)
       .fillColor(colors.black)
       .text(report.comments || 'Aucun commentaire.', 45, yPosition + 10, {
         width: 505,
         align: 'justify'
       });

    // Footer (simplified)
    const footerY = 780;
    doc.font('Helvetica')
       .fontSize(7)
       .fillColor(colors.secondary)
       .text('© 2024 Auto Presto. Tous droits réservés.', 30, footerY, { align: 'center', width: 535 });

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