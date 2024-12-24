const { addInspectionReport, updateInspectionReports } = require('../config/database');
const logger = require('../utils/logger');

const submitForm = async (req, res, userId, returnReportId = false) => {
  try {
    logger.debug('Submitting form:', req.body);

    if (req.body.is_company === 'on') {
      req.body.is_company = true;
    } else {
      req.body.is_company = false;
    }

    const reportId = await addInspectionReport(req.body, userId);
    
    if (!reportId) {
      throw new Error('Report ID not returned after save');
    }

    logger.info(`Report saved successfully with ID: ${reportId} by user: ${userId}`);
    if (returnReportId) {
      logger.debug('Returning report ID:', reportId);
      return reportId;
    } else {
      res.redirect(`/report/${reportId}`);
    }

  } catch (error) {
    logger.error('Error submitting form:', error);
    return res.render('form', {
      data: req.body,
      errors: [{ msg: 'Une erreur est survenue lors de l\'enregistrement.' }],
      inspectionItems: req.inspectionItems || []
    });
  }
};

const updateForm = async (req, res, userId) => {
  try {
    const reportId = await updateInspectionReports(req.params.id, req.body, userId);
    return res.redirect(`/report/${reportId}`);
  } catch (error) {
    logger.error('Error updating form:', error);
    return res.render('form', {
      data: req.body,
      errors: [{ msg: 'Une erreur est survenue lors de la mise à jour.' }],
      inspectionItems: req.inspectionItems || []
    });
  }
}

module.exports = {
  submitForm,
  updateForm
}; 