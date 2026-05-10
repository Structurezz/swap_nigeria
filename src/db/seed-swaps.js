/**
 * seed-swaps.js — seeds 50 swap deals across all statuses for the three test users.
 * Safe to re-run: clears only Swap / escrow Payment records first.
 */
require('dotenv').config();
const mongoose = require('mongoose');

require('../models/User');
require('../models/Listing');
require('../models/Swap');
require('../models/Payment');
require('../models/Conversation');
require('../models/Message');
require('../models/Review');

const User    = require('../models/User');
const Listing = require('../models/Listing');
const Swap    = require('../models/Swap');
const Payment = require('../models/Payment');

// ─── Helpers ──────────────────────────────────────────────────────────────────
function ago(days, hours = 0) {
  return new Date(Date.now() - (days * 86400 + hours * 3600) * 1000);
}
function future(days) {
  return new Date(Date.now() + days * 86400 * 1000);
}
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

const MEETUP_LOCATIONS = [
  'Shoprite Lekki, Lagos', 'Computer Village, Ikeja, Lagos',
  'Ikeja City Mall, Lagos', 'Balogun Market, Lagos Island',
  'Surulere Bus Stop, Lagos', 'Banex Plaza, Wuse 2, Abuja',
  'Wuse Market, Abuja', 'Garki Market, Abuja',
  'Maitama Mall, Abuja', 'Area 11 Shoprite, Abuja',
  'Kano City Mall, Kano', 'CBD Plaza, Kano',
  'Sabon Gari Market, Kano', 'Fagge Market, Kano',
];

const NOTES = [
  'Looking forward to this swap!',
  'Great condition, you\'ll love it.',
  'Let\'s make this happen fast.',
  'Verified seller, very reliable.',
  'Open to slight negotiation.',
  'Item is clean and ready.',
  'Quick swap preferred, I\'m nearby.',
  'Message me to arrange meetup.',
  'Both items are top quality.',
  'Swapped on SwapNaija before, smooth experience.',
  'Let\'s do this at a public place.',
  'Available on weekends.',
  'I can deliver within Lagos.',
  'Packaging included.',
  'Flexible on meetup location.',
];

const DISPUTE_REASONS = [
  'Item was not as described in the photos.',
  'The other party did not show up for the meetup.',
  'Item had hidden damage not mentioned.',
  'Received completely different item from what was agreed.',
  'Seller became unresponsive after escrow was paid.',
];

// ─── Main ─────────────────────────────────────────────────────────────────────
async function seedSwaps() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected!\n');

  // Load test users
  const phones = ['+2348000000001', '+2348000000002', '+2348000000003'];
  const users  = await User.find({ phone: { $in: phones } }).lean();
  if (users.length < 3) {
    console.error('❌  Need all 3 test users. Run `npm run seed` first.');
    process.exit(1);
  }

  const byPhone = {};
  users.forEach(u => { byPhone[u.phone] = u; });
  const amaka  = byPhone['+2348000000001'];
  const chidi  = byPhone['+2348000000002'];
  const fatima = byPhone['+2348000000003'];

  // Load listings (up to 50 per user)
  const [aL, cL, fL] = await Promise.all([
    Listing.find({ userId: amaka._id  }).limit(50).lean(),
    Listing.find({ userId: chidi._id  }).limit(50).lean(),
    Listing.find({ userId: fatima._id }).limit(50).lean(),
  ]);

  function L(arr, idx) { return arr[idx % arr.length]; }

  // Clear existing swap / escrow data only
  await Swap.deleteMany({});
  await Payment.deleteMany({ paymentType: 'escrow' });
  console.log('Cleared existing swaps & escrow payments.\n');

  // ── Pair combinations ─────────────────────────────────────────────────────
  // [initiator, initiatorListings, receiver, receiverListings]
  const PAIRS = [
    [amaka, aL, chidi,  cL],
    [amaka, aL, fatima, fL],
    [chidi, cL, amaka,  aL],
    [chidi, cL, fatima, fL],
    [fatima,fL, amaka,  aL],
    [fatima,fL, chidi,  cL],
  ];

  const SWAP_TYPES = [
    'goods_for_goods', 'goods_for_goods', 'goods_for_goods',
    'goods_for_service', 'service_for_goods', 'service_for_service',
  ];

  const swaps = [];
  let li = 0; // rolling listing index

  // ── Status distribution across 50 swaps ──────────────────────────────────
  // proposed: 10 | accepted: 10 | meetup_set: 6 | in_escrow: 8 | completed: 10 | cancelled: 4 | disputed: 2

  // PROPOSED (10)
  for (let i = 0; i < 10; i++) {
    const [ini, iL, rec, rL] = PAIRS[i % PAIRS.length];
    const hasTopUp = i % 3 === 0;
    swaps.push({
      initiatorId: ini._id, receiverId: rec._id,
      initiatorListing: L(iL, li)._id,
      receiverListing:  L(rL, li + 1)._id,
      proposalNote: pick(NOTES),
      swapType: pick(SWAP_TYPES),
      status: 'proposed',
      ...(hasTopUp ? { topUpAmountKobo: rand(5, 30) * 1000, topUpPayerRole: pick(['initiator', 'receiver']) } : {}),
      createdAt: ago(rand(1, 5)), updatedAt: ago(rand(0, 2)),
    });
    li += 2;
  }

  // ACCEPTED (10)
  for (let i = 0; i < 10; i++) {
    const [ini, iL, rec, rL] = PAIRS[i % PAIRS.length];
    const depositI  = i % 3 === 0;
    const depositR  = i % 4 === 0;
    const hasTopUp  = i % 4 === 1;
    const topUpPaid = hasTopUp && i % 2 === 1;
    swaps.push({
      initiatorId: ini._id, receiverId: rec._id,
      initiatorListing: L(iL, li)._id,
      receiverListing:  L(rL, li + 1)._id,
      proposalNote: pick(NOTES),
      swapType: pick(SWAP_TYPES),
      status: 'accepted',
      initiatorDepositPaid: depositI,
      receiverDepositPaid:  depositR,
      ...(hasTopUp ? {
        topUpAmountKobo: rand(5, 25) * 1000,
        topUpPayerRole:  pick(['initiator', 'receiver']),
        topUpPaid,
        ...(topUpPaid ? { topUpPaidAt: ago(rand(1, 3)) } : {}),
      } : {}),
      createdAt: ago(rand(3, 8)), updatedAt: ago(rand(0, 3)),
    });
    li += 2;
  }

  // MEETUP SET (6)
  for (let i = 0; i < 6; i++) {
    const [ini, iL, rec, rL] = PAIRS[i % PAIRS.length];
    swaps.push({
      initiatorId: ini._id, receiverId: rec._id,
      initiatorListing: L(iL, li)._id,
      receiverListing:  L(rL, li + 1)._id,
      proposalNote: pick(NOTES),
      swapType: pick(SWAP_TYPES),
      status: 'meetup_set',
      meetupLocation: pick(MEETUP_LOCATIONS),
      meetupScheduled: future(rand(1, 7)),
      createdAt: ago(rand(5, 12)), updatedAt: ago(rand(0, 2)),
    });
    li += 2;
  }

  // IN ESCROW (8)
  for (let i = 0; i < 8; i++) {
    const [ini, iL, rec, rL] = PAIRS[i % PAIRS.length];
    const iniConf   = i % 3 === 0;
    const recConf   = i % 5 === 0;
    const hasTopUp  = i % 3 === 1;
    const topUpPaid = hasTopUp;
    const escrowAt  = ago(rand(2, 6));
    swaps.push({
      initiatorId: ini._id, receiverId: rec._id,
      initiatorListing: L(iL, li)._id,
      receiverListing:  L(rL, li + 1)._id,
      proposalNote: pick(NOTES),
      swapType: pick(SWAP_TYPES),
      status: 'in_escrow',
      escrowActive: true,
      escrowDepositKobo: 100000,
      initiatorDepositPaid: true,
      receiverDepositPaid:  true,
      escrowInitiatedAt: escrowAt,
      initiatorConfirmed: iniConf,
      receiverConfirmed:  recConf,
      meetupLocation: i % 2 === 0 ? pick(MEETUP_LOCATIONS) : undefined,
      meetupScheduled: i % 2 === 0 ? future(rand(1, 5)) : undefined,
      ...(hasTopUp ? {
        topUpAmountKobo: rand(5, 30) * 1000,
        topUpPayerRole: pick(['initiator', 'receiver']),
        topUpPaid,
        ...(topUpPaid ? { topUpPaidAt: ago(rand(1, 4)) } : {}),
      } : {}),
      createdAt: ago(rand(6, 14)), updatedAt: escrowAt,
    });
    li += 2;
  }

  // COMPLETED (10)
  for (let i = 0; i < 10; i++) {
    const [ini, iL, rec, rL] = PAIRS[i % PAIRS.length];
    const useEscrow = i % 2 === 0;
    const hasTopUp  = i % 3 === 0 && useEscrow;
    const completedAt = ago(rand(5, 25));
    swaps.push({
      initiatorId: ini._id, receiverId: rec._id,
      initiatorListing: L(iL, li)._id,
      receiverListing:  L(rL, li + 1)._id,
      proposalNote: pick(NOTES),
      swapType: pick(SWAP_TYPES),
      status: 'completed',
      escrowActive: useEscrow,
      ...(useEscrow ? {
        escrowDepositKobo: 100000,
        initiatorDepositPaid: true,
        receiverDepositPaid:  true,
        escrowInitiatedAt:    ago(rand(30, 40)),
        escrowReleasedAt:     completedAt,
      } : {}),
      initiatorConfirmed: true,
      receiverConfirmed:  true,
      meetupLocation: pick(MEETUP_LOCATIONS),
      meetupScheduled: ago(rand(5, 25)),
      ...(hasTopUp ? {
        topUpAmountKobo: rand(5, 20) * 1000,
        topUpPayerRole: pick(['initiator', 'receiver']),
        topUpPaid: true,
        topUpPaidAt: ago(rand(25, 35)),
        topUpReleasedAt: completedAt,
      } : {}),
      createdAt: ago(rand(35, 60)), updatedAt: completedAt,
    });
    li += 2;
  }

  // CANCELLED (4)
  for (let i = 0; i < 4; i++) {
    const [ini, iL, rec, rL] = PAIRS[i % PAIRS.length];
    swaps.push({
      initiatorId: ini._id, receiverId: rec._id,
      initiatorListing: L(iL, li)._id,
      receiverListing:  L(rL, li + 1)._id,
      proposalNote: pick(NOTES),
      swapType: pick(SWAP_TYPES),
      status: 'cancelled',
      createdAt: ago(rand(8, 20)), updatedAt: ago(rand(5, 15)),
    });
    li += 2;
  }

  // DISPUTED (2)
  for (let i = 0; i < 2; i++) {
    const [ini, iL, rec, rL] = PAIRS[i % PAIRS.length];
    const escrowAt = ago(rand(4, 10));
    swaps.push({
      initiatorId: ini._id, receiverId: rec._id,
      initiatorListing: L(iL, li)._id,
      receiverListing:  L(rL, li + 1)._id,
      proposalNote: pick(NOTES),
      swapType: pick(SWAP_TYPES),
      status: 'disputed',
      escrowActive: true,
      escrowDepositKobo: 100000,
      initiatorDepositPaid: true,
      receiverDepositPaid:  true,
      escrowInitiatedAt: escrowAt,
      disputeReason: pick(DISPUTE_REASONS),
      disputeRaisedBy: i % 2 === 0 ? ini._id : rec._id,
      meetupLocation: pick(MEETUP_LOCATIONS),
      meetupScheduled: ago(rand(1, 5)),
      createdAt: ago(rand(10, 20)), updatedAt: ago(rand(1, 5)),
    });
    li += 2;
  }

  // ─── Insert ───────────────────────────────────────────────────────────────
  const inserted = await Swap.insertMany(swaps, { timestamps: false });
  console.log(`✓ Created ${inserted.length} swaps\n`);

  // ─── Update swap counts for completed swaps ───────────────────────────────
  const completed = inserted.filter(s => s.status === 'completed');
  for (const s of completed) {
    await User.findByIdAndUpdate(s.initiatorId, { $inc: { swapCount: 1 } });
    await User.findByIdAndUpdate(s.receiverId,  { $inc: { swapCount: 1 } });
  }

  // ─── Create escrow payment records ────────────────────────────────────────
  const payments = [];
  for (const s of inserted) {
    if (s.initiatorDepositPaid) {
      payments.push({
        userId: s.initiatorId, swapId: s._id,
        amountKobo: 100000, paymentType: 'escrow',
        status: s.status === 'completed' ? 'refunded' : 'success',
        meta: { role: 'initiator' },
        createdAt: s.escrowInitiatedAt || s.createdAt,
      });
    }
    if (s.receiverDepositPaid) {
      payments.push({
        userId: s.receiverId, swapId: s._id,
        amountKobo: 100000, paymentType: 'escrow',
        status: s.status === 'completed' ? 'refunded' : 'success',
        meta: { role: 'receiver' },
        createdAt: s.escrowInitiatedAt || s.createdAt,
      });
    }
    if (s.topUpPaid && s.topUpAmountKobo > 0) {
      const payerId = s.topUpPayerRole === 'initiator' ? s.initiatorId : s.receiverId;
      payments.push({
        userId: payerId, swapId: s._id,
        amountKobo: s.topUpAmountKobo, paymentType: 'escrow',
        status: s.status === 'completed' ? 'refunded' : 'success',
        meta: { type: 'topup_paid', role: s.topUpPayerRole },
        createdAt: s.topUpPaidAt || s.createdAt,
      });
    }
  }
  if (payments.length) {
    await Payment.insertMany(payments, { timestamps: false });
    console.log(`✓ Created ${payments.length} escrow payment records`);
  }

  // ─── Summary ──────────────────────────────────────────────────────────────
  const counts = {};
  inserted.forEach(s => { counts[s.status] = (counts[s.status] || 0) + 1; });
  console.log('\nSwap status breakdown:');
  Object.entries(counts).forEach(([status, n]) =>
    console.log(`  ${status.padEnd(14)} ${n}`)
  );

  const updatedUsers = await User.find({ phone: { $in: phones } })
    .select('fullName swapCount').lean();
  console.log('\nUser swap counts:');
  updatedUsers.forEach(u => console.log(`  ${u.fullName}: ${u.swapCount} completed swaps`));

  await mongoose.disconnect();
  console.log('\n✅ Swap seed complete!');
}

seedSwaps().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
