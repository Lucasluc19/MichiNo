const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');

// Créer le premier admin (à utiliser une seule fois)
router.post('/setup', async (req, res) => {
  try {
    const count = await Admin.countDocuments();
    if (count > 0) return res.status(400).json({ message: 'Admin déjà créé' });
    
    const admin = new Admin({ username: 'admin', password: 'michino2024' });
    await admin.save();
    res.json({ message: '✅ Admin créé avec succès' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Connexion admin
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const admin = await Admin.findOne({ username });
    if (!admin) return res.status(400).json({ message: 'Identifiants incorrects' });
    
    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) return res.status(400).json({ message: 'Identifiants incorrects' });
    
    const token = jwt.sign({ id: admin._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, message: '✅ Connexion réussie' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
