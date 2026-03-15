const mongoose = require('mongoose');

const pushSubSchema = new mongoose.Schema({
  endpoint:  { type: String, required: true, unique: true },
  keys:      { p256dh: String, auth: String },
  lang:      { type: String, default: 'fr' },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('PushSub', pushSubSchema);
