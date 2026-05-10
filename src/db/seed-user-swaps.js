/**
 * seed-user-swaps.js — seeds 50 realistic swap deals for a specific user.
 * Includes scenarios where the user is waiting on the other party AND
 * scenarios where the user still has an action to complete.
 * SAFE: appends only, never deletes existing data.
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

function ago(days, hours = 0) {
  return new Date(Date.now() - (days * 86400 + hours * 3600) * 1000);
}
function future(days) { return new Date(Date.now() + days * 86400 * 1000); }
function pick(arr)     { return arr[Math.floor(Math.random() * arr.length)]; }
function rand(min,max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

const LOCATIONS = [
  'Shoprite Lekki, Lagos', 'Computer Village, Ikeja, Lagos',
  'Ikeja City Mall, Lagos', 'Banex Plaza, Wuse 2, Abuja',
  'Wuse Market, Abuja', 'Maitama Mall, Abuja',
  'Kano City Mall, Kano', 'CBD Plaza, Kano',
  'Balogun Market, Lagos Island', 'Area 11 Shoprite, Abuja',
];

const NOTES = [
  'Looking forward to this swap!',
  'Great condition, you\'ll love it.',
  'Let\'s make this happen fast.',
  'Open to slight negotiation.',
  'Item is clean and ready.',
  'Quick swap preferred.',
  'Both items are top quality.',
  'Available on weekends.',
  'Packaging included.',
  'Trusted SwapNaija member.',
];

const SWAP_TYPES = ['goods_for_goods','goods_for_goods','goods_for_goods','goods_for_service','service_for_service'];

async function seedUserSwaps() {
  const TARGET_ID = process.env.TARGET_USER_ID || '69ffd094b098fffb00cb84ea';

  console.log('Connecting...');
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected!\n');

  const target = await User.findById(TARGET_ID).lean();
  if (!target) { console.error(`❌ User ${TARGET_ID} not found`); process.exit(1); }
  console.log(`Target: ${target.fullName || TARGET_ID}\n`);

  const peers = await User.find({ phone: { $in: ['+2348000000001','+2348000000002','+2348000000003'] } }).lean();
  if (!peers.length) { console.error('❌ No test users found'); process.exit(1); }

  // ── Wipe stale swaps for this user so listing references stay fresh ──────
  const peerIds = peers.map(p => p._id);
  const deleted = await Swap.deleteMany({
    $or: [
      { initiatorId: TARGET_ID },
      { receiverId:  TARGET_ID },
    ],
  });
  await Payment.deleteMany({ userId: TARGET_ID });
  console.log(`🗑  Cleared ${deleted.deletedCount} old swaps for target\n`);

  // ── Fetch CURRENT listings from DB ───────────────────────────────────────
  let myListings = await Listing.find({ userId: TARGET_ID }).limit(80).lean();
  const peerListings = {};
  for (const p of peers) {
    peerListings[p._id.toString()] = await Listing.find({ userId: p._id }).limit(80).lean();
  }
  const fallback = Object.values(peerListings).flat();
  if (!myListings.length) {
    console.warn('⚠️  No listings for target — using peer listings as initiator listings');
    myListings = fallback.slice(0, 80);
  }

  if (!fallback.length) { console.error('❌ No peer listings found — run npm run seed first'); process.exit(1); }
  console.log(`📦  Using ${myListings.length} initiator listings, ${fallback.length} peer listings\n`);

  let idx = 0;
  function ML(i) { return myListings[i % myListings.length]; }
  function PL(peer, i) {
    const arr = peerListings[peer._id.toString()] || fallback;
    return arr[i % arr.length];
  }
  function nextPeer(i) { return peers[i % peers.length]; }

  const swaps = [];

  // ═══════════════════════════════════════════════════════════════════════════
  // PROPOSED — 10 swaps
  // ═══════════════════════════════════════════════════════════════════════════

  // 1. I proposed, waiting for them to accept
  for (let i = 0; i < 3; i++) {
    const peer = nextPeer(i);
    swaps.push({
      initiatorId: target._id, receiverId: peer._id,
      initiatorListing: ML(idx)._id, receiverListing: PL(peer,idx+1)._id,
      proposalNote: pick(NOTES), swapType: pick(SWAP_TYPES), status: 'proposed',
      createdAt: ago(rand(1,4)), updatedAt: ago(rand(0,1)),
    }); idx += 2;
  }

  // 2. They proposed to me — I need to accept or decline
  for (let i = 0; i < 4; i++) {
    const peer = nextPeer(i+1);
    swaps.push({
      initiatorId: peer._id, receiverId: target._id,
      initiatorListing: PL(peer,idx)._id, receiverListing: ML(idx+1)._id,
      proposalNote: pick(NOTES), swapType: pick(SWAP_TYPES), status: 'proposed',
      createdAt: ago(rand(1,3)), updatedAt: ago(rand(0,1)),
    }); idx += 2;
  }

  // 3. I proposed with a top-up gap — they need to accept AND then pay the gap
  for (let i = 0; i < 3; i++) {
    const peer = nextPeer(i+2);
    swaps.push({
      initiatorId: target._id, receiverId: peer._id,
      initiatorListing: ML(idx)._id, receiverListing: PL(peer,idx+1)._id,
      proposalNote: pick(NOTES), swapType: pick(SWAP_TYPES), status: 'proposed',
      topUpAmountKobo: rand(5,30)*1000, topUpPayerRole: 'receiver',
      createdAt: ago(rand(1,5)), updatedAt: ago(rand(0,2)),
    }); idx += 2;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ACCEPTED — 10 swaps
  // ═══════════════════════════════════════════════════════════════════════════

  // 4. They accepted, BOTH need to pay escrow — neither paid yet, I go first
  for (let i = 0; i < 2; i++) {
    const peer = nextPeer(i);
    swaps.push({
      initiatorId: target._id, receiverId: peer._id,
      initiatorListing: ML(idx)._id, receiverListing: PL(peer,idx+1)._id,
      proposalNote: pick(NOTES), swapType: pick(SWAP_TYPES), status: 'accepted',
      initiatorDepositPaid: false, receiverDepositPaid: false,
      createdAt: ago(rand(3,6)), updatedAt: ago(rand(1,3)),
    }); idx += 2;
  }

  // 5. I already paid escrow — WAITING for them to pay theirs
  for (let i = 0; i < 2; i++) {
    const peer = nextPeer(i+1);
    swaps.push({
      initiatorId: target._id, receiverId: peer._id,
      initiatorListing: ML(idx)._id, receiverListing: PL(peer,idx+1)._id,
      proposalNote: pick(NOTES), swapType: pick(SWAP_TYPES), status: 'accepted',
      initiatorDepositPaid: true, receiverDepositPaid: false,
      createdAt: ago(rand(3,7)), updatedAt: ago(rand(1,3)),
    }); idx += 2;
  }

  // 6. They already paid escrow — I am LAST to pay mine
  for (let i = 0; i < 2; i++) {
    const peer = nextPeer(i+2);
    swaps.push({
      initiatorId: peer._id, receiverId: target._id,
      initiatorListing: PL(peer,idx)._id, receiverListing: ML(idx+1)._id,
      proposalNote: pick(NOTES), swapType: pick(SWAP_TYPES), status: 'accepted',
      initiatorDepositPaid: true, receiverDepositPaid: false,
      createdAt: ago(rand(3,7)), updatedAt: ago(rand(1,3)),
    }); idx += 2;
  }

  // 7. I need to pay the top-up (value gap) — swap accepted, top-up pending
  for (let i = 0; i < 2; i++) {
    const peer = nextPeer(i);
    // I am the initiator and I owe the gap
    swaps.push({
      initiatorId: target._id, receiverId: peer._id,
      initiatorListing: ML(idx)._id, receiverListing: PL(peer,idx+1)._id,
      proposalNote: pick(NOTES), swapType: pick(SWAP_TYPES), status: 'accepted',
      topUpAmountKobo: rand(8,25)*1000, topUpPayerRole: 'initiator', topUpPaid: false,
      createdAt: ago(rand(2,5)), updatedAt: ago(rand(0,2)),
    }); idx += 2;
  }

  // 8. They need to pay the top-up — I'm waiting on them
  for (let i = 0; i < 2; i++) {
    const peer = nextPeer(i+1);
    swaps.push({
      initiatorId: peer._id, receiverId: target._id,
      initiatorListing: PL(peer,idx)._id, receiverListing: ML(idx+1)._id,
      proposalNote: pick(NOTES), swapType: pick(SWAP_TYPES), status: 'accepted',
      topUpAmountKobo: rand(8,25)*1000, topUpPayerRole: 'initiator', topUpPaid: false,
      createdAt: ago(rand(2,5)), updatedAt: ago(rand(0,2)),
    }); idx += 2;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MEETUP SET — 6 swaps
  // ═══════════════════════════════════════════════════════════════════════════

  // 9. Meetup set, neither confirmed yet — I need to show up and confirm
  for (let i = 0; i < 2; i++) {
    const peer = nextPeer(i);
    swaps.push({
      initiatorId: target._id, receiverId: peer._id,
      initiatorListing: ML(idx)._id, receiverListing: PL(peer,idx+1)._id,
      proposalNote: pick(NOTES), swapType: pick(SWAP_TYPES), status: 'meetup_set',
      meetupLocation: pick(LOCATIONS), meetupScheduled: future(rand(1,4)),
      initiatorConfirmed: false, receiverConfirmed: false,
      createdAt: ago(rand(5,10)), updatedAt: ago(rand(1,3)),
    }); idx += 2;
  }

  // 10. They already confirmed receipt — I am LAST to confirm
  for (let i = 0; i < 2; i++) {
    const peer = nextPeer(i+1);
    swaps.push({
      initiatorId: peer._id, receiverId: target._id,
      initiatorListing: PL(peer,idx)._id, receiverListing: ML(idx+1)._id,
      proposalNote: pick(NOTES), swapType: pick(SWAP_TYPES), status: 'meetup_set',
      meetupLocation: pick(LOCATIONS), meetupScheduled: ago(rand(1,2)),
      initiatorConfirmed: true, receiverConfirmed: false,
      createdAt: ago(rand(7,12)), updatedAt: ago(rand(1,2)),
    }); idx += 2;
  }

  // 11. I already confirmed — WAITING for them to confirm
  for (let i = 0; i < 2; i++) {
    const peer = nextPeer(i+2);
    swaps.push({
      initiatorId: target._id, receiverId: peer._id,
      initiatorListing: ML(idx)._id, receiverListing: PL(peer,idx+1)._id,
      proposalNote: pick(NOTES), swapType: pick(SWAP_TYPES), status: 'meetup_set',
      meetupLocation: pick(LOCATIONS), meetupScheduled: ago(rand(1,2)),
      initiatorConfirmed: true, receiverConfirmed: false,
      createdAt: ago(rand(7,12)), updatedAt: ago(rand(1,2)),
    }); idx += 2;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // IN ESCROW — 8 swaps
  // ═══════════════════════════════════════════════════════════════════════════

  function calcDeposit(iListing, rListing, pct = 10) {
    const maxVal = Math.max(iListing?.estimatedValue || 0, rListing?.estimatedValue || 0);
    if (maxVal <= 0) return 50000;
    return Math.max(50000, Math.round(maxVal * (pct / 100)) * 100);
  }
  const escrowBase = (iL, rL) => ({
    escrowActive: true,
    escrowDepositKobo: calcDeposit(iL, rL, pick([5,10,15,20])),
    collateralPercent: pick([5,10,15,20]),
    initiatorDepositPaid: true,
    receiverDepositPaid: true,
  });

  // 12. Escrow active, meetup set — neither confirmed yet, I need to confirm
  for (let i = 0; i < 2; i++) {
    const peer = nextPeer(i); const escrowAt = ago(rand(2,5));
    const iL = ML(idx), rL = PL(peer,idx+1);
    swaps.push({
      initiatorId: target._id, receiverId: peer._id,
      initiatorListing: iL._id, receiverListing: rL._id,
      proposalNote: pick(NOTES), swapType: pick(SWAP_TYPES), status: 'in_escrow',
      ...escrowBase(iL, rL), escrowInitiatedAt: escrowAt,
      meetupLocation: pick(LOCATIONS), meetupScheduled: future(rand(1,3)),
      initiatorConfirmed: false, receiverConfirmed: false,
      createdAt: ago(rand(6,12)), updatedAt: escrowAt,
    }); idx += 2;
  }

  // 13. Escrow active — they confirmed, I am LAST to confirm (releases escrow)
  for (let i = 0; i < 2; i++) {
    const peer = nextPeer(i+1); const escrowAt = ago(rand(3,6));
    const iL = PL(peer,idx), rL = ML(idx+1);
    swaps.push({
      initiatorId: peer._id, receiverId: target._id,
      initiatorListing: iL._id, receiverListing: rL._id,
      proposalNote: pick(NOTES), swapType: pick(SWAP_TYPES), status: 'in_escrow',
      ...escrowBase(iL, rL), escrowInitiatedAt: escrowAt,
      meetupLocation: pick(LOCATIONS), meetupScheduled: ago(rand(1,2)),
      initiatorConfirmed: true, receiverConfirmed: false,
      createdAt: ago(rand(8,14)), updatedAt: escrowAt,
    }); idx += 2;
  }

  // 14. Escrow active — I confirmed, waiting for them
  for (let i = 0; i < 2; i++) {
    const peer = nextPeer(i+2); const escrowAt = ago(rand(3,6));
    const iL = ML(idx), rL = PL(peer,idx+1);
    swaps.push({
      initiatorId: target._id, receiverId: peer._id,
      initiatorListing: iL._id, receiverListing: rL._id,
      proposalNote: pick(NOTES), swapType: pick(SWAP_TYPES), status: 'in_escrow',
      ...escrowBase(iL, rL), escrowInitiatedAt: escrowAt,
      meetupLocation: pick(LOCATIONS), meetupScheduled: ago(rand(1,2)),
      initiatorConfirmed: true, receiverConfirmed: false,
      createdAt: ago(rand(8,14)), updatedAt: escrowAt,
    }); idx += 2;
  }

  // 15. Escrow active + top-up — I still need to pay the top-up gap
  for (let i = 0; i < 1; i++) {
    const peer = nextPeer(i); const escrowAt = ago(rand(2,4));
    const iL = ML(idx), rL = PL(peer,idx+1);
    swaps.push({
      initiatorId: target._id, receiverId: peer._id,
      initiatorListing: iL._id, receiverListing: rL._id,
      proposalNote: pick(NOTES), swapType: pick(SWAP_TYPES), status: 'in_escrow',
      ...escrowBase(iL, rL), escrowInitiatedAt: escrowAt,
      topUpAmountKobo: rand(8,25)*1000, topUpPayerRole: 'initiator', topUpPaid: false,
      meetupLocation: pick(LOCATIONS), meetupScheduled: future(rand(1,3)),
      initiatorConfirmed: false, receiverConfirmed: false,
      createdAt: ago(rand(5,10)), updatedAt: escrowAt,
    }); idx += 2;
  }

  // 16. Escrow active + top-up — they owe the gap, I'm waiting on them
  for (let i = 0; i < 1; i++) {
    const peer = nextPeer(i+1); const escrowAt = ago(rand(2,4));
    const iL = PL(peer,idx), rL = ML(idx+1);
    swaps.push({
      initiatorId: peer._id, receiverId: target._id,
      initiatorListing: iL._id, receiverListing: rL._id,
      proposalNote: pick(NOTES), swapType: pick(SWAP_TYPES), status: 'in_escrow',
      ...escrowBase(iL, rL), escrowInitiatedAt: escrowAt,
      topUpAmountKobo: rand(8,25)*1000, topUpPayerRole: 'initiator', topUpPaid: false,
      meetupLocation: pick(LOCATIONS), meetupScheduled: future(rand(1,3)),
      initiatorConfirmed: false, receiverConfirmed: false,
      createdAt: ago(rand(5,10)), updatedAt: escrowAt,
    }); idx += 2;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // COMPLETED — 10 swaps
  // ═══════════════════════════════════════════════════════════════════════════

  for (let i = 0; i < 10; i++) {
    const peer      = nextPeer(i);
    const asIni     = i % 2 === 0;
    const useEscrow = i % 2 === 0;
    const hasTopUp  = i % 3 === 0 && useEscrow;
    const doneAt    = ago(rand(5,30));
    const iL = asIni ? ML(idx) : PL(peer,idx);
    const rL = asIni ? PL(peer,idx+1) : ML(idx+1);
    swaps.push({
      initiatorId:      asIni ? target._id : peer._id,
      receiverId:       asIni ? peer._id   : target._id,
      initiatorListing: iL._id,
      receiverListing:  rL._id,
      proposalNote: pick(NOTES), swapType: pick(SWAP_TYPES), status: 'completed',
      escrowActive: useEscrow,
      ...(useEscrow ? {
        escrowDepositKobo: calcDeposit(iL, rL, pick([5,10,15,20])),
        collateralPercent: pick([5,10,15,20]),
        initiatorDepositPaid: true, receiverDepositPaid: true,
        escrowInitiatedAt: ago(rand(30,45)), escrowReleasedAt: doneAt,
      } : {}),
      initiatorConfirmed: true, receiverConfirmed: true,
      meetupLocation: pick(LOCATIONS), meetupScheduled: ago(rand(5,30)),
      ...(hasTopUp ? {
        topUpAmountKobo: rand(5,20)*1000, topUpPayerRole: pick(['initiator','receiver']),
        topUpPaid: true, topUpPaidAt: ago(rand(30,40)), topUpReleasedAt: doneAt,
      } : {}),
      createdAt: ago(rand(40,70)), updatedAt: doneAt,
    }); idx += 2;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CANCELLED — 4 swaps
  // ═══════════════════════════════════════════════════════════════════════════

  for (let i = 0; i < 4; i++) {
    const peer  = nextPeer(i);
    const asIni = i % 2 === 0;
    swaps.push({
      initiatorId:      asIni ? target._id : peer._id,
      receiverId:       asIni ? peer._id   : target._id,
      initiatorListing: asIni ? ML(idx)._id : PL(peer,idx)._id,
      receiverListing:  asIni ? PL(peer,idx+1)._id : ML(idx+1)._id,
      proposalNote: pick(NOTES), swapType: pick(SWAP_TYPES), status: 'cancelled',
      createdAt: ago(rand(8,20)), updatedAt: ago(rand(5,15)),
    }); idx += 2;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DISPUTED — 2 swaps
  // ═══════════════════════════════════════════════════════════════════════════

  for (let i = 0; i < 2; i++) {
    const peer    = nextPeer(i);
    const asIni   = i % 2 === 0;
    const escrowAt = ago(rand(4,10));
    const iL = asIni ? ML(idx) : PL(peer,idx);
    const rL = asIni ? PL(peer,idx+1) : ML(idx+1);
    swaps.push({
      initiatorId:      asIni ? target._id : peer._id,
      receiverId:       asIni ? peer._id   : target._id,
      initiatorListing: iL._id,
      receiverListing:  rL._id,
      proposalNote: pick(NOTES), swapType: pick(SWAP_TYPES), status: 'disputed',
      ...escrowBase(iL, rL), escrowInitiatedAt: escrowAt,
      disputeReason: pick([
        'Item was not as described in the photos.',
        'Other party did not show up for the meetup.',
        'Item had hidden damage not shown in photos.',
        'Received different item from what was agreed.',
      ]),
      disputeRaisedBy: asIni ? target._id : peer._id,
      meetupLocation: pick(LOCATIONS), meetupScheduled: ago(rand(1,5)),
      createdAt: ago(rand(10,20)), updatedAt: ago(rand(1,5)),
    }); idx += 2;
  }

  // ─── Insert (no deletions) ────────────────────────────────────────────────
  const inserted = await Swap.insertMany(swaps, { timestamps: false });
  console.log(`✓ Inserted ${inserted.length} swaps for ${target.fullName || TARGET_ID}\n`);

  // ─── Swap count for completed ─────────────────────────────────────────────
  const completedCount = inserted.filter(s => s.status === 'completed').length;
  await User.findByIdAndUpdate(TARGET_ID, { $inc: { swapCount: completedCount } });

  // ─── Payment records ──────────────────────────────────────────────────────
  const payments = [];
  for (const s of inserted) {
    const depositKobo = s.escrowDepositKobo || 100000;
    const escrowStatus = s.status === 'completed' ? 'refunded' : 'success';
    if (s.initiatorDepositPaid) payments.push({ userId: s.initiatorId, swapId: s._id, amountKobo: depositKobo, paymentType: 'escrow', status: escrowStatus, meta: { role: 'initiator' }, createdAt: s.escrowInitiatedAt || s.createdAt });
    if (s.receiverDepositPaid)  payments.push({ userId: s.receiverId,  swapId: s._id, amountKobo: depositKobo, paymentType: 'escrow', status: escrowStatus, meta: { role: 'receiver' },  createdAt: s.escrowInitiatedAt || s.createdAt });
    if (s.topUpPaid && s.topUpAmountKobo > 0) {
      const payerId = s.topUpPayerRole === 'initiator' ? s.initiatorId : s.receiverId;
      payments.push({ userId: payerId, swapId: s._id, amountKobo: s.topUpAmountKobo, paymentType: 'escrow', status: s.status === 'completed' ? 'refunded' : 'success', meta: { type: 'topup_paid', role: s.topUpPayerRole }, createdAt: s.topUpPaidAt || s.createdAt });
    }
  }
  if (payments.length) {
    await Payment.insertMany(payments, { timestamps: false });
    console.log(`✓ Created ${payments.length} payment records`);
  }

  // ─── Summary ──────────────────────────────────────────────────────────────
  const counts = {};
  inserted.forEach(s => { counts[s.status] = (counts[s.status] || 0) + 1; });
  console.log('\nStatus breakdown:');
  Object.entries(counts).forEach(([s,n]) => console.log(`  ${s.padEnd(14)} ${n}`));

  console.log('\nAction-required scenarios seeded:');
  console.log('  proposed    — 4 where they proposed to ME (I need to accept/decline)');
  console.log('  accepted    — 2 where they paid escrow, I am LAST to pay mine');
  console.log('  accepted    — 2 where I need to pay the top-up gap');
  console.log('  meetup_set  — 2 where they confirmed, I am LAST to confirm');
  console.log('  in_escrow   — 2 where they confirmed, I am LAST to confirm (releases escrow)');
  console.log('  in_escrow   — 1 where I still owe the top-up');

  await mongoose.disconnect();
  console.log('\n✅ Done!');
}

seedUserSwaps().catch(err => { console.error('Failed:', err); process.exit(1); });
