/**
 * SwapNaija — Email Digest Scheduler
 * Uses node-cron to send morning / afternoon / night digests
 * in West Africa Time (WAT = UTC+1 = Africa/Lagos).
 *
 *  07:00 WAT → morning digest
 *  13:00 WAT → afternoon digest
 *  21:00 WAT → night digest
 */
const cron = require('node-cron');
const { sendBatchDigest, notifyEscrowReminder } = require('./notifications.service');
const Swap = require('../../models/Swap');

let schedulerStarted = false;

const startScheduler = () => {
  if (schedulerStarted) return;
  schedulerStarted = true;

  // Morning — 07:00 WAT (06:00 UTC)
  cron.schedule('0 6 * * *', async () => {
    console.log('[SCHEDULER] 🌅 Morning digest triggered');
    try { await sendBatchDigest('morning'); }
    catch (e) { console.error('[SCHEDULER] Morning digest error:', e.message); }
  }, { timezone: 'Africa/Lagos' });

  // Afternoon — 13:00 WAT (12:00 UTC)
  cron.schedule('0 12 * * *', async () => {
    console.log('[SCHEDULER] 🌤️  Afternoon digest triggered');
    try { await sendBatchDigest('afternoon'); }
    catch (e) { console.error('[SCHEDULER] Afternoon digest error:', e.message); }
  }, { timezone: 'Africa/Lagos' });

  // Night — 21:00 WAT (20:00 UTC)
  cron.schedule('0 20 * * *', async () => {
    console.log('[SCHEDULER] 🌙 Night digest triggered');
    try { await sendBatchDigest('night'); }
    catch (e) { console.error('[SCHEDULER] Night digest error:', e.message); }
  }, { timezone: 'Africa/Lagos' });

  // Escrow reminder — every day at 10:00 WAT (09:00 UTC)
  // Finds swaps stuck in `accepted` with at least ONE deposit paid and sends a nudge
  cron.schedule('0 9 * * *', async () => {
    console.log('[SCHEDULER] 🔒 Escrow reminder triggered');
    try {
      // Swaps accepted > 12h ago where only one party has paid
      const cutoff = new Date(Date.now() - 12 * 60 * 60 * 1000);
      const stuckSwaps = await Swap.find({
        status: 'accepted',
        updatedAt: { $lte: cutoff },
        $or: [
          { initiatorDepositPaid: true, receiverDepositPaid: false },
          { initiatorDepositPaid: false, receiverDepositPaid: true },
        ],
      })
        .populate('initiatorId', 'fullName email emailPrefs')
        .populate('receiverId',  'fullName email emailPrefs')
        .populate('initiatorListing', 'title estimatedValue condition')
        .populate('receiverListing',  'title estimatedValue condition');

      console.log(`[SCHEDULER] Found ${stuckSwaps.length} swaps awaiting escrow`);
      for (const swap of stuckSwaps) {
        try { await notifyEscrowReminder(swap.toJSON()); }
        catch (e) { console.warn(`[SCHEDULER] Escrow reminder failed for ${swap._id}: ${e.message}`); }
        await new Promise(r => setTimeout(r, 100));
      }
    } catch (e) { console.error('[SCHEDULER] Escrow reminder error:', e.message); }
  }, { timezone: 'Africa/Lagos' });

  console.log('[SCHEDULER] Email digest scheduler started (WAT: 07:00 / 10:00 / 13:00 / 21:00)');
};

module.exports = { startScheduler };
