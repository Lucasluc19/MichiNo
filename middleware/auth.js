const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Accès refusé: token manquant' });
  }

  const token = authHeader.split(' ')[1];

  try {
    // Vérifie algorithme, expiration, signature
    const verified = jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: ['HS256'],   // Seulement HS256 (pas "none" !)
      maxAge: '7d',
    });
    req.admin = verified;
    next();
  } catch (err) {
    const msg = err.name === 'TokenExpiredError' ? 'Session expirée, reconnectez-vous'
              : err.name === 'JsonWebTokenError'  ? 'Token invalide'
              : 'Authentification échouée';
    return res.status(401).json({ message: msg });
  }
};
