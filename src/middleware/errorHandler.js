const logger = require('../utils/logger');

module.exports = (err, req, res) => {
  logger.error('Unhandled error:', err);
  
  const errorMessage = err.message || 'Internal Server Error';
  
  if (req.xhr || req.headers.accept.indexOf('json') > -1) {
    return res.status(err.status || 500).json({ error: errorMessage });
  }

  if (req.flash) {
    req.flash('error', errorMessage);
  }
  
  res.status(err.status || 500);
  res.render('error', {
    message: errorMessage,
    user: req.session.user,
    success: req.flash('success'),
    error: req.flash('error')
  });
};
