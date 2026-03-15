const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  visitorName: { type: String, required: true },
  visitorEmail: { type: String, default: '' },
  sessionId: { type: String, required: true },
  messages: [{
    from: { type: String, enum: ['visitor', 'admin'], required: true },
    text: { type: String, required: true },
    time: { type: Date, default: Date.now }
  }],
  status: { type: String, enum: ['open', 'answered', 'closed'], default: 'open' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Message', messageSchema);
