const mongoose = require('mongoose');

/**
 * Modèle Artist — MichiNo- v16
 * Profil artiste enrichi : bio, réseaux sociaux, mood tags, stats
 */
const artistSchema = new mongoose.Schema({
  name:        { type: String, required: true, unique: true, trim: true },
  slug:        { type: String, required: true, unique: true, lowercase: true, trim: true },
  bio:         { type: String, default: '', maxlength: 2000 },
  country:     { type: String, default: '' },
  coverImage:  { type: String, default: '' },
  bannerImage: { type: String, default: '' },
  verified:    { type: Boolean, default: false },

  // Réseaux sociaux
  socials: {
    instagram: { type: String, default: '' },
    twitter:   { type: String, default: '' },
    youtube:   { type: String, default: '' },
    spotify:   { type: String, default: '' },
    tiktok:    { type: String, default: '' },
  },

  // Tags musicaux pour recommandations IA
  moodTags:  { type: [String], default: [] }, // ex: ['energetic','feel-good','party']
  genres:    { type: [String], default: ['Afrobeat'] },

  // Stats cumulées (mis à jour par aggregation)
  stats: {
    totalPlays:     { type: Number, default: 0 },
    totalDownloads: { type: Number, default: 0 },
    totalSongs:     { type: Number, default: 0 },
    totalVideos:    { type: Number, default: 0 },
  },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
}, {
  timestamps: true,
});

// Index pour recherche rapide par slug
artistSchema.index({ slug: 1 });
artistSchema.index({ 'stats.totalPlays': -1 });

// Génère automatiquement le slug depuis le nom
artistSchema.pre('save', function(next) {
  if (this.isModified('name')) {
    this.slug = this.name
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }
  next();
});

module.exports = mongoose.model('Artist', artistSchema);
