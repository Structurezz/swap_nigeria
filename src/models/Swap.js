const mongoose = require('mongoose');

const swapSchema = new mongoose.Schema(
  {
    initiatorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    receiverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    initiatorListing: { type: mongoose.Schema.Types.ObjectId, ref: 'Listing' },
    receiverListing: { type: mongoose.Schema.Types.ObjectId, ref: 'Listing' },
    proposalNote: String,
    agreedValue: Number,
    swapType: {
      type: String,
      enum: ['goods_for_goods', 'goods_for_service', 'service_for_goods', 'service_for_service'],
      default: 'goods_for_goods',
    },
    meetupLocation: String,
    meetupScheduled: Date,
    escrowActive: { type: Boolean, default: false },
    escrowDepositKobo: { type: Number, default: 100000 }, // ₦1,000 per party
    initiatorDepositPaid: { type: Boolean, default: false },
    receiverDepositPaid: { type: Boolean, default: false },
    escrowInitiatedAt: Date,
    escrowReleasedAt: Date,
    escrowFeeNgn: Number,
    status: {
      type: String,
      enum: ['proposed', 'accepted', 'meetup_set', 'in_escrow', 'completed', 'cancelled', 'disputed'],
      default: 'proposed',
    },
    initiatorConfirmed: { type: Boolean, default: false },
    receiverConfirmed: { type: Boolean, default: false },
    platformFeeNgn: Number,
    platformFeePaid: { type: Boolean, default: false },
    disputeReason: String,
    disputeRaisedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    disputeResolvedAt: Date,
    disputeAdminNote: String,
    disputeResolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
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

swapSchema.index({ initiatorId: 1, status: 1 });
swapSchema.index({ receiverId: 1, status: 1 });
swapSchema.index({ initiatorListing: 1 });
swapSchema.index({ receiverListing: 1 });

module.exports = mongoose.model('Swap', swapSchema);
