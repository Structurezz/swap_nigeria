const mongoose = require('mongoose');

const listingSchema = new mongoose.Schema(
  {
    userId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title:       { type: String, required: true, maxlength: 200 },
    description: { type: String, required: true },
    categoryId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
    listingType: {
      type: String,
      enum: ['goods', 'services', 'both'],
      default: 'goods',
    },
    condition: {
      type: String,
      enum: ['new', 'like_new', 'good', 'fair', 'poor'],
    },
    estimatedValue: Number,
    images:         [String],

    // What the lister wants in return
    wantsTitle:       String,
    wantsDescription: String,
    wantsCategoryId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
    wantsValueMin:    Number,
    wantsValueMax:    Number,

    // Location — used for delivery routing and regional search only
    locationState: String, // Nigerian state
    locationLga:   String,
    locationArea:  String,

    // ── Delivery (all swaps use delivery — no in-person meetup) ───────────────
    deliveryOption: { type: Boolean, default: true }, // always true; kept for API compatibility

    // Package info for delivery estimation
    packageWeight: Number,       // kg
    packageLength: Number,       // cm
    packageWidth:  Number,       // cm
    packageHeight: Number,       // cm
    fragile:       { type: Boolean, default: false },
    handlingInstructions: String,

    // Swap eligibility
    minSwapValue: { type: Number, default: 0 },

    // Boost / visibility
    isBoosted:  { type: Boolean, default: false },
    boostExpires: Date,

    // Status
    status: {
      type: String,
      enum: ['active', 'paused', 'swapped', 'expired', 'deleted'],
      default: 'active',
    },
    viewCount: { type: Number, default: 0 },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
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

listingSchema.index({ title: 'text', description: 'text', wantsTitle: 'text' });
listingSchema.index({ isBoosted: -1, createdAt: -1 });
listingSchema.index({ categoryId: 1, status: 1 });
listingSchema.index({ locationState: 1, locationLga: 1 });
listingSchema.index({ status: 1, expiresAt: 1 });

module.exports = mongoose.model('Listing', listingSchema);
