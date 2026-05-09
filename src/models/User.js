const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    phone: { type: String, unique: true, required: true, index: true },
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
