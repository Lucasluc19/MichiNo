const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
  songId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Song', required: true, index: true },
  name:      { type: String, required: true, maxlength: 60 },
  text:      { type: String, required: true, maxlength: 500 },
  likes:     { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Comment', commentSchema);
