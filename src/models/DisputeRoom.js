const mongoose = require('mongoose');

const rulingSchema = new mongoose.Schema({
  decision: {
    type: String,
    enum: ['compensate_initiator', 'compensate_receiver', 'split', 'mutual_release', 'penalty_initiator', 'penalty_receiver'],
  },
  penaltyAmountKobo:       { type: Number, default: 0 },
  compensationAmountKobo:  { type: Number, default: 0 },
  compensationRecipient:   { type: String, enum: ['initiator', 'receiver', 'both', 'none'], default: 'none' },
  adminNote:               String,
  issuedBy:                { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  issuedAt:                Date,
  ariaFormattedDecision:   String,
}, { _id: false });

const counselRequestSchema = new mongoose.Schema({
  requesterId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  counselId:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  side:          { type: String, enum: ['claimant', 'respondent'], required: true },
  status:        { type: String, enum: ['pending', 'accepted', 'declined'], default: 'pending' },
  agreedFeeKobo: { type: Number, default: 0 },
  requestedAt:   { type: Date, default: Date.now },
  respondedAt:   Date,
}, { _id: true });

const disputeRoomSchema = new mongoose.Schema({
  swapId:        { type: mongoose.Schema.Types.ObjectId, ref: 'Swap', required: true, unique: true },
  initiatorId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  receiverId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  claimantId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  respondentId:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  adminId:       { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  swapSnapshot:  { type: mongoose.Schema.Types.Mixed },

  // ── Legal counsel ────────────────────────────────────────────────────────────
  tier:                    { type: String, enum: ['standard', 'legal'], default: 'standard' },
  claimantCounselId:       { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  respondentCounselId:     { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  claimantCounselFeeKobo:  { type: Number, default: 0 },
  respondentCounselFeeKobo:{ type: Number, default: 0 },
  counselRequests:         [counselRequestSchema],

  stage: {
    type: String,
    enum: ['opening', 'evidence', 'deliberation', 'ruling', 'closed'],
    default: 'opening',
  },
  ruling:  { type: rulingSchema, default: null },
  status:  { type: String, enum: ['active', 'resolved', 'closed'], default: 'active' },
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

module.exports = mongoose.model('DisputeRoom', disputeRoomSchema);
