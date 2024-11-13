const isAuthenticated = (req, res, next) => {
  if (!req.session.user) {
    return res.redirect('/login');
  }
  
  // Make user data available to all views AND to req.user
  res.locals.user = req.session.user;
  req.user = req.session.user;
  next();
};

module.exports = {
  isAuthenticated
};
