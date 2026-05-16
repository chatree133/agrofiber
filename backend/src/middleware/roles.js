export function allowRoles(...roles) {
  return (req, res, next) => {
    const userRoles = req.user?.roles || [];
    const allowed = roles.some((role) => userRoles.includes(role));

    if (!allowed) {
      res.status(403).json({ message: 'Forbidden: insufficient role' });
      return;
    }

    next();
  };
}
