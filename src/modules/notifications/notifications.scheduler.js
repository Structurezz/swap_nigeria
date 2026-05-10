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
const { sendBatchDigest } = require('./notifications.service');

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

  console.log('[SCHEDULER] Email digest scheduler started (WAT: 07:00 / 13:00 / 21:00)');
};

module.exports = { startScheduler };
