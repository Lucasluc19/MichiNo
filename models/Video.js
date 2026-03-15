const mongoose = require('mongoose');

const videoSchema = new mongoose.Schema({
  title: { type: String, required: true },
  artist: { type: String, required: true },
  thumbnail: { type: String },
  videoUrl: { type: String, required: true },
  youtubeLink: { type: String },
  views: { type: Number, default: 0 },
  downloads: { type: Number, default: 0 },
  featured: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Video', videoSchema);
