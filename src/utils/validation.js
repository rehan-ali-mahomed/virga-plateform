const { body, validationResult } = require('express-validator');

const validateForm = [
  body('client_name').trim().escape().isLength({ max: 50 }),
  body('client_phone').trim().escape().isLength({ max: 15 }),
  body('vehicle_registration').trim().escape().isLength({ max: 20 }),
  body('vehicle_make').trim().escape().isLength({ max: 50 }),
  body('vehicle_model').trim().escape().isLength({ max: 50 }),
  body('mileage').isInt({ max: 9999999 }),
  body('next_inspection_date').optional({ checkFalsy: true }).isISO8601(),
  body('comments').trim().escape().isLength({ max: 255 }),
  body('front_tires').notEmpty().withMessage('Please select the condition of the front tires.'),
  body('rear_tires').notEmpty().withMessage('Please select the condition of the rear tires.'),
  body('front_lights').notEmpty().withMessage('Please select the condition of the front lights.'),
  body('rear_lights').notEmpty().withMessage('Please select the condition of the rear lights.'),
  body('front_brake_pads').notEmpty().withMessage('Please select the condition of the front brake pads.'),
  body('rear_brake_pads').notEmpty().withMessage('Please select the condition of the rear brake pads.'),
  body('front_shock_absorbers').notEmpty().withMessage('Please select the condition of the front shock absorbers.'),
  body('rear_shock_absorbers').notEmpty().withMessage('Please select the condition of the rear shock absorbers.'),
  // Add validation for other fields...
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
