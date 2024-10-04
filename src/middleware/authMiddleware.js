function authMiddleware(req, res, next) {
  // List of paths that don't require authentication
  const publicPaths = ['/login', '/register', '/forgot-password'];

  if (!req.session.user && !publicPaths.includes(req.path)) {
    return res.redirect('/login');
  }

  next();
}

module.exports = authMiddleware;