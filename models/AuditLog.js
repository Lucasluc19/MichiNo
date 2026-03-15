const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  action:   { type: String, required: true },   // ex: 'song.upload', 'song.delete', 'video.upload'
  target:   { type: String },                    // ex: title de la chanson
  targetId: { type: String },
  adminUser:{ type: String, default: 'admin' },
  details:  { type: String },
  ip:       { type: String },
  createdAt:{ type: Date, default: Date.now },
});

module.exports = mongoose.model('AuditLog', auditLogSchema);
