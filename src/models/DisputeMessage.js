const mongoose = require('mongoose');

const disputeMessageSchema = new mongoose.Schema({
  roomId:      { type: mongoose.Schema.Types.ObjectId, ref: 'DisputeRoom', required: true, index: true },
  senderId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  senderRole:  { type: String, enum: ['initiator', 'receiver', 'admin', 'bot', 'system'], required: true },
  senderName:  { type: String, required: true },
  content:     { type: String, required: true },
  messageType: { type: String, enum: ['text', 'evidence', 'question', 'system', 'ruling', 'decision'], default: 'text' },
  metadata:    { type: mongoose.Schema.Types.Mixed, default: {} },
}, {
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform(doc, ret) {
      ret.id = ret._id.toString();
      delete ret._id;
      delete ret.__v;
      return ret;
    },
  },
});

disputeMessageSchema.index({ roomId: 1, createdAt: 1 });

module.exports = mongoose.model('DisputeMessage', disputeMessageSchema);
