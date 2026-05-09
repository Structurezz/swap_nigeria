const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    swapId: { type: mongoose.Schema.Types.ObjectId, ref: 'Swap' },
    listingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Listing' },
    paymentType: {
      type: String,
      enum: ['topup', 'boost', 'verification', 'escrow', 'fee'],
      required: true,
    },
    amountKobo: { type: Number, required: true },
    paystackRef: { type: String, unique: true, sparse: true },
    paystackStatus: String,
    status: {
      type: String,
      enum: ['pending', 'success', 'failed', 'refunded'],
      default: 'pending',
    },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
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

paymentSchema.index({ userId: 1, createdAt: -1 });
paymentSchema.index({ paystackRef: 1 });

module.exports = mongoose.model('Payment', paymentSchema);
