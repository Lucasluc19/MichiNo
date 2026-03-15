const mongoose = require('mongoose');

const subscriberSchema = new mongoose.Schema({
  email:     { type: String, required: true, unique: true, lowercase: true, trim: true },
  name:      { type: String, default: '', maxlength: 80 },
  active:    { type: Boolean, default: true },
  token:     { type: String },           // unsubscribe token
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Subscriber', subscriberSchema);
