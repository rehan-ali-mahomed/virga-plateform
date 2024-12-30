const isAuthenticated = (req, res, next) => {
  if (!req.session.user) {
    return res.redirect('/auth/login');
  }
  
  // Make user data available to all views AND to req.user
  res.locals.user = req.session.user;
  req.user = req.session.user;
  next();
};

const isAdmin = (req, res, next) => { 
  if (req.user && req.user.role.toLowerCase() === 'admin') {
    return next();
  }
  return res.status(403).render('error', {
    message: 'Accès interdit. Vous n\'êtes pas autorisé à accéder à cette section.',
    errors: [],
    user: req.session.user
  });
};

module.exports = {
  isAuthenticated,
  isAdmin
};
