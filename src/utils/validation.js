const { body, validationResult } = require('express-validator');

const validateForm = [
  body('date').isDate().withMessage('Please enter a valid date.'),
  body('client_name').trim().isLength({ min: 1, max: 50 }).withMessage('Client name must be between 1 and 50 characters.'),
  body('client_phone').trim().isLength({ min: 1, max: 15 }).withMessage('Phone number must be between 1 and 15 characters.'),
  body('vehicle_registration').trim().isLength({ min: 1, max: 20 }).withMessage('Vehicle registration must be between 1 and 20 characters.'),
  body('vehicle_make').trim().isLength({ min: 1, max: 50 }).withMessage('Vehicle make must be between 1 and 50 characters.'),
  body('vehicle_model').trim().isLength({ min: 1, max: 50 }).withMessage('Vehicle model must be between 1 and 50 characters.'),
  body('mileage').isInt({ min: 0, max: 9999999 }).withMessage('Mileage must be a number between 0 and 9,999,999.'),
  body('next_inspection_date').optional({ checkFalsy: true }).isDate().withMessage('Please enter a valid date for the next inspection.'),
  // Add more validations for other fields as needed
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
