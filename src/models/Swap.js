const mongoose = require('mongoose');

const addressSchema = new mongoose.Schema({
  fullName:     String,
  phone:        String,
  addressLine1: String,
  addressLine2: String,
  city:         String,
  state:        String,
  landmark:     String,
}, { _id: false });

const shipmentSchema = new mongoose.Schema({
  provider:         String, // gig | kwik | sendbox | dhl | fedex | nipost | red_star | chisco | abc | other
  providerLabel:    String, // display name
  trackingNumber:   String,
  trackingUrl:      String,
  shippedAt:        Date,
  estimatedDelivery: Date,
  proofImages:      [String], // photo URLs
  notes:            String,
  deliveredAt:      Date,
}, { _id: false });

const swapSchema = new mongoose.Schema(
  {
    initiatorId:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    receiverId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    initiatorListing:{ type: mongoose.Schema.Types.ObjectId, ref: 'Listing' },
    receiverListing: { type: mongoose.Schema.Types.ObjectId, ref: 'Listing' },
    proposalNote:    String,
    agreedValue:     Number,
    swapType: {
      type: String,
      enum: ['goods_for_goods', 'goods_for_service', 'service_for_goods', 'service_for_service'],
      default: 'goods_for_goods',
    },

    // ── Delivery addresses ─────────────────────────────────────────────────────
    initiatorAddress:    { type: addressSchema, default: null },
    receiverAddress:     { type: addressSchema, default: null },
    initiatorAddressSet: { type: Boolean, default: false },
    receiverAddressSet:  { type: Boolean, default: false },

    // ── Shipment tracking ──────────────────────────────────────────────────────
    initiatorShipment:   { type: shipmentSchema, default: null },
    receiverShipment:    { type: shipmentSchema, default: null },
    initiatorShipped:    { type: Boolean, default: false },
    receiverShipped:     { type: Boolean, default: false },

    // ── Delivery instructions (e.g. fragile, keep upright) ────────────────────
    deliveryInstructions: String,

    // ── Escrow ────────────────────────────────────────────────────────────────
    collateralPercent:      { type: Number, default: 10, min: 1, max: 100 },
    escrowActive:           { type: Boolean, default: false },
    escrowDepositKobo:      { type: Number, default: 100000 },
    initiatorDepositPaid:   { type: Boolean, default: false },
    receiverDepositPaid:    { type: Boolean, default: false },
    escrowInitiatedAt:      Date,
    escrowReleasedAt:       Date,
    escrowFeeNgn:           Number,
    platformFeeNgn:         Number,
    platformFeePaid:        { type: Boolean, default: false },

    // ── Status ────────────────────────────────────────────────────────────────
    // proposed → accepted → in_escrow → shipped → completed
    status: {
      type: String,
      enum: ['proposed', 'accepted', 'in_escrow', 'shipped', 'completed', 'cancelled', 'disputed'],
      default: 'proposed',
    },

    // ── Confirmations (both must confirm receipt to complete) ─────────────────
    initiatorConfirmed: { type: Boolean, default: false },
    receiverConfirmed:  { type: Boolean, default: false },

    // ── Dispute ───────────────────────────────────────────────────────────────
    disputeReason:     String,
    disputeRaisedBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    disputeResolvedAt: Date,
    disputeAdminNote:  String,
    disputeResolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    disputeDecision: {
      type: String,
      enum: ['compensate_initiator', 'compensate_receiver', 'split', 'mutual_release', 'penalty_initiator', 'penalty_receiver'],
    },

    // ── Value-gap top-up (Barter Credits) ────────────────────────────────────
    topUpAmountKobo: { type: Number, default: 0 },
    topUpPayerRole:  { type: String, enum: ['initiator', 'receiver', 'none'], default: 'none' },
    topUpPaid:       { type: Boolean, default: false },
    topUpPaidAt:     Date,
    topUpReleasedAt: Date,
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
swapSchema.index({ receiverId:  1, status: 1 });
swapSchema.index({ initiatorListing: 1 });
swapSchema.index({ receiverListing:  1 });

module.exports = mongoose.model('Swap', swapSchema);
