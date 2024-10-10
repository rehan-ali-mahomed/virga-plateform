const { body, validationResult } = require('express-validator');

const validateForm = [
  body('license_plate').trim().isLength({ min: 1, max: 20 }).withMessage('License plate is required and must be between 1 and 20 characters.'),
  body('owner_name').trim().isLength({ min: 1, max: 100 }).withMessage('Owner name is required and must be between 1 and 100 characters.'),
  body('contact_info').trim().isLength({ min: 1, max: 100 }).withMessage('Contact info is required and must be between 1 and 100 characters.'),
  body('status_type').isIn(['entry_diagnostic', 'exit_repair']).withMessage('Invalid status type.'),
  body('details').trim().isLength({ max: 1000 }).withMessage('Details must not exceed 1000 characters.'),
  body('severity_level').isInt({ min: 1, max: 5 }).withMessage('Severity level must be between 1 and 5.'),
  body('repair_status').trim().isLength({ max: 100 }).withMessage('Repair status must not exceed 100 characters.'),
  body('cost').isFloat({ min: 0 }).withMessage('Cost must be a positive number.'),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).render('form', {
        errors: errors.array(),
        data: req.body,
      });
    }
    next();
  }
];

module.exports = { validateForm };