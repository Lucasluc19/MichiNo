const mongoose = require('mongoose');

/**
 * Modèle Playlist — MichiNo- v16
 * Playlists générées par IA (prompt textuel) ou manuelles
 */
const playlistSchema = new mongoose.Schema({
  // Identification
  sessionId:   { type: String, required: true, index: true }, // identifiant visiteur (cookie/uuid)
  name:        { type: String, required: true, maxlength: 120 },
  description: { type: String, default: '', maxlength: 300 },
  prompt:      { type: String, default: '' }, // prompt utilisateur si généré par IA
  isAI:        { type: Boolean, default: false },

  // Contenu
  songs: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Song' }],

  // Contexte de génération IA
  context: {
    mood:    { type: String, default: '' },   // energetic, chill, romantic...
    time:    { type: String, default: '' },   // morning, evening, night...
    activity:{ type: String, default: '' },   // party, workout, travel...
    lang:    { type: String, default: 'fr' },
  },

  coverImage: { type: String, default: '' },
  plays:      { type: Number, default: 0 },
  createdAt:  { type: Date, default: Date.now },
}, {
  timestamps: true,
});

playlistSchema.index({ sessionId: 1, createdAt: -1 });

module.exports = mongoose.model('Playlist', playlistSchema);
