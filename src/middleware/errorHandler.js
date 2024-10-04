function errorHandler(err, req, res, next) {
  console.error('Unhandled error:', err.stack);
  res.status(500).render('error', { message: 'Internal Server Error' });
}

module.exports = errorHandler;
