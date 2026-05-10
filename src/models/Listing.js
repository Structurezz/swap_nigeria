const mongoose = require('mongoose');

const listingSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, maxlength: 200 },
    description: { type: String, required: true },
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
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
    images: [String],
    wantsTitle: String,
    wantsDescription: String,
    wantsCategoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
    wantsValueMin: Number,
    wantsValueMax: Number,
    locationState: String,
    locationLga: String,
    locationArea: String,
    lat: Number,
    lng: Number,
    meetupOption: { type: Boolean, default: true },
    deliveryOption: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ['active', 'paused', 'swapped', 'expired', 'deleted'],
      default: 'active',
    },
    minSwapValue: { type: Number, default: 0 }, // min estimatedValue (₦) a proposer's listing must have
    isBoosted: { type: Boolean, default: false },
    boostExpires: Date,
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

// Full-text search index
listingSchema.index({ title: 'text', description: 'text', wantsTitle: 'text' });
listingSchema.index({ isBoosted: -1, createdAt: -1 });
listingSchema.index({ categoryId: 1, status: 1 });
listingSchema.index({ locationState: 1, locationLga: 1 });
listingSchema.index({ status: 1, expiresAt: 1 });

module.exports = mongoose.model('Listing', listingSchema);
