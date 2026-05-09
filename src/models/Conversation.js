const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema(
  {
    swapId: { type: mongoose.Schema.Types.ObjectId, ref: 'Swap', unique: true },
    participantA: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    participantB: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    lastMessage: String,
    lastMsgAt: Date,
    unreadA: { type: Number, default: 0 },
    unreadB: { type: Number, default: 0 },
  },
  {
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
  }
);

conversationSchema.index({ participantA: 1, lastMsgAt: -1 });
conversationSchema.index({ participantB: 1, lastMsgAt: -1 });

module.exports = mongoose.model('Conversation', conversationSchema);
