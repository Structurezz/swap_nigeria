const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    phone: { type: String, unique: true, sparse: true, index: true },
    email: { type: String, unique: true, sparse: true, lowercase: true, index: true },
    passwordHash: { type: String },
    fullName: { type: String, maxlength: 120 },
    username: { type: String, unique: true, sparse: true, maxlength: 60 },
    bio: String,
    avatarUrl: String,
    locationState: String,
    locationLga: String,
    locationArea: String,
    lat: Number,
    lng: Number,
    status: {
      type: String,
      enum: ['active', 'suspended', 'pending'],
      default: 'pending',
    },
    verification: {
      type: String,
      enum: ['basic', 'verified', 'premium'],
      default: 'basic',
    },
    verifiedAt: Date,
    badgeExpires: Date,
    swapCount: { type: Number, default: 0 },
    ratingAvg: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },
    isAdmin: { type: Boolean, default: false },
    walletBalance: { type: Number, default: 0 }, // stored in kobo
    referralCode: { type: String, unique: true, sparse: true, index: true },
    referredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    referralCount: { type: Number, default: 0 },
    swapCredits: { type: Number, default: 0 },
    emailPrefs: {
      swapUpdates: { type: Boolean, default: true },  // transactional: proposed, accepted, etc.
      dailyDigest: { type: Boolean, default: true },  // morning / afternoon / night digest
      marketing:   { type: Boolean, default: false }, // promotions / news
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
    toObject: { virtuals: true },
  }
);

userSchema.index({ locationState: 1, locationLga: 1 });
userSchema.index({ ratingAvg: -1 });

module.exports = mongoose.model('User', userSchema);
