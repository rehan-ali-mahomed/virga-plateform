const logger = require('../utils/logger');

function errorHandler(err, req, res, next) {
  logger.error('Unhandled error:', err);
  
  // Log additional details
  logger.error('Request URL:', req.originalUrl);
  logger.error('Request Method:', req.method);
  logger.error('Request Body:', req.body);

  res.status(500).render('error', { 
    message: 'An unexpected error occurred. Please try again later.',
    error: process.env.NODE_ENV === 'development' ? err : {}
  });
}

module.exports = errorHandler;
