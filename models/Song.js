const mongoose = require('mongoose');

/**
 * Modèle Song — MichiNo- v16
 * Ajouts 2026 :
 *  - moodTags : tags pour recommandations IA
 *  - skipCount : signaux comportementaux (skip < 30s = signal négatif)
 *  - totalCompletions : taux de complétion (écoute >80% = signal positif)
 */
const songSchema = new mongoose.Schema({
  title:         { type: String, required: true },
  artist:        { type: String, required: true },
  genre:         { type: String, default: 'Afrobeat' },
  coverImage:    { type: String },
  audioUrl:      { type: String, required: true },
  streamingLink: { type: String },
  lyrics:        { type: String, default: '' },
  downloads:     { type: Number, default: 0 },
  plays:         { type: Number, default: 0 },
  featured:      { type: Boolean, default: false },
  order:         { type: Number, default: 0 },
  publishAt:     { type: Date, default: null },
  waveform:      { type: [Number], default: [] },

  // 🆕 v16 — Tags mood pour recommandations IA
  moodTags: { type: [String], default: [] },

  // 🆕 v16 — Signaux comportementaux
  skipCount:        { type: Number, default: 0 },
  totalCompletions: { type: Number, default: 0 },

  dailyStats: [{
    date:        { type: Date },
    downloads:   { type: Number, default: 0 },
    plays:       { type: Number, default: 0 },
    completions: { type: Number, default: 0 },
  }],

  createdAt: { type: Date, default: Date.now },
}, { toJSON: { virtuals: true }, toObject: { virtuals: true } });

songSchema.index({ order: 1, createdAt: -1 });
songSchema.index({ artist: 1 });
songSchema.index({ genre: 1 });
songSchema.index({ publishAt: 1 });
songSchema.index({ plays: -1 });
songSchema.index({ downloads: -1 });

// Score de popularité pour tri intelligent
songSchema.virtual('popularityScore').get(function() {
  return (this.plays || 0) + (this.downloads || 0) * 2 + (this.totalCompletions || 0) * 3 - (this.skipCount || 0) * 0.5;
});

module.exports = mongoose.model('Song', songSchema);
