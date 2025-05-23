const jwt = require('jsonwebtoken');

function authMiddleware(req, res, next) {
  const authHeader = req.header('Authorization');

  // Verifica si el encabezado Authorization está presente
  if (!authHeader) {
    return res.status(401).json({ error: 'No autorizado: falta el encabezado Authorization' });
  }

  const token = authHeader.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ error: 'No autorizado: token no proporcionado' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Token no válido' });
  }
}

module.exports = authMiddleware;
