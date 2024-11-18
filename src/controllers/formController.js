const { saveInspectionReport } = require('../config/database');
const logger = require('../utils/logger');

const submitForm = async (req, res) => {
  try {
    if (!req.body.date) {
      req.body.date = new Date().toISOString().split('T')[0];
    }

    const reportId = await saveInspectionReport(req.body, req.user.user_id);
    
    if (!reportId) {
      throw new Error('Report ID not returned after save');
    }

    logger.info(`Report saved successfully with ID: ${reportId}`);
    return res.redirect(`/report/${reportId}`);

  } catch (error) {
    logger.error('Error submitting form:', error);
    return res.render('form', {
      data: req.body,
      errors: [{ msg: 'Une erreur est survenue lors de l\'enregistrement.' }],
      inspectionItems: req.inspectionItems || []
    });
  }
};

module.exports = {
  submitForm
}; 