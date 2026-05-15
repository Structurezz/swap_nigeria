/**
 * SwapNaija — Email Digest Scheduler
 * -----------------------------------
 * Uses node-cron to send scheduled digests
 * and escrow reminders in West Africa Time.
 *
 * Timezone: Africa/Lagos (WAT / UTC+1)
 *
 * Schedules:
 * - 07:00 → Morning digest
 * - 10:00 → Escrow reminder
 * - 13:00 → Afternoon digest
 * - 21:00 → Night digest
 */

const cron = require('node-cron');
const Swap = require('../../models/Swap');

const {
  sendBatchDigest,
  notifyEscrowReminder,
} = require('./notifications.service');

let schedulerStarted = false;

const startScheduler = () => {
  if (schedulerStarted) {
    console.log('[SCHEDULER] Already running');
    return;
  }

  schedulerStarted = true;

  console.log('[SCHEDULER] Initializing email digest scheduler...');

  /**
   * ---------------------------------------------------
   * TEST JOB (Optional)
   * Runs every minute so you can confirm cron works.
   * Remove after testing.
   * ---------------------------------------------------
   */
  cron.schedule(
    '* * * * *',
    async () => {
      console.log(
        `[SCHEDULER TEST] Running at ${new Date().toLocaleString('en-NG', {
          timeZone: 'Africa/Lagos',
        })}`
      );
    },
    {
      timezone: 'Africa/Lagos',
    }
  );

  /**
   * ---------------------------------------------------
   * MORNING DIGEST — 07:00 WAT
   * ---------------------------------------------------
   */
  cron.schedule(
    '0 7 * * *',
    async () => {
      console.log('[SCHEDULER] 🌅 Morning digest triggered');

      try {
        await sendBatchDigest('morning');

        console.log(
          '[SCHEDULER] ✅ Morning digest completed successfully'
        );
      } catch (error) {
        console.error(
          '[SCHEDULER] ❌ Morning digest error:',
          error.message
        );
      }
    },
    {
      timezone: 'Africa/Lagos',
    }
  );

  /**
   * ---------------------------------------------------
   * AFTERNOON DIGEST — 13:00 WAT
   * ---------------------------------------------------
   */
  cron.schedule(
    '0 13 * * *',
    async () => {
      console.log('[SCHEDULER] 🌤️ Afternoon digest triggered');

      try {
        await sendBatchDigest('afternoon');

        console.log(
          '[SCHEDULER] ✅ Afternoon digest completed successfully'
        );
      } catch (error) {
        console.error(
          '[SCHEDULER] ❌ Afternoon digest error:',
          error.message
        );
      }
    },
    {
      timezone: 'Africa/Lagos',
    }
  );

  /**
   * ---------------------------------------------------
   * NIGHT DIGEST — 21:00 WAT
   * ---------------------------------------------------
   */
  cron.schedule(
    '0 21 * * *',
    async () => {
      console.log('[SCHEDULER] 🌙 Night digest triggered');

      try {
        await sendBatchDigest('night');

        console.log(
          '[SCHEDULER] ✅ Night digest completed successfully'
        );
      } catch (error) {
        console.error(
          '[SCHEDULER] ❌ Night digest error:',
          error.message
        );
      }
    },
    {
      timezone: 'Africa/Lagos',
    }
  );

  /**
   * ---------------------------------------------------
   * ESCROW REMINDER — 10:00 WAT
   * ---------------------------------------------------
   */
  cron.schedule(
    '0 10 * * *',
    async () => {
      console.log('[SCHEDULER] 🔒 Escrow reminder triggered');

      try {
        /**
         * Swaps accepted more than 12 hours ago
         * where only ONE party has paid.
         */
        const cutoff = new Date(
          Date.now() - 12 * 60 * 60 * 1000
        );

        const stuckSwaps = await Swap.find({
          status: 'accepted',

          updatedAt: {
            $lte: cutoff,
          },

          $or: [
            {
              initiatorDepositPaid: true,
              receiverDepositPaid: false,
            },
            {
              initiatorDepositPaid: false,
              receiverDepositPaid: true,
            },
          ],
        })
          .populate(
            'initiatorId',
            'fullName email emailPrefs'
          )
          .populate(
            'receiverId',
            'fullName email emailPrefs'
          )
          .populate(
            'initiatorListing',
            'title estimatedValue condition'
          )
          .populate(
            'receiverListing',
            'title estimatedValue condition'
          );

        console.log(
          `[SCHEDULER] Found ${stuckSwaps.length} swaps awaiting escrow`
        );

        for (const swap of stuckSwaps) {
          try {
            await notifyEscrowReminder(
              swap.toJSON()
            );

            console.log(
              `[SCHEDULER] ✅ Reminder sent for swap ${swap._id}`
            );
          } catch (error) {
            console.warn(
              `[SCHEDULER] ❌ Reminder failed for ${swap._id}:`,
              error.message
            );
          }

          /**
           * Small delay to avoid
           * hammering mail provider.
           */
          await new Promise((resolve) =>
            setTimeout(resolve, 100)
          );
        }

        console.log(
          '[SCHEDULER] ✅ Escrow reminder job completed'
        );
      } catch (error) {
        console.error(
          '[SCHEDULER] ❌ Escrow reminder error:',
          error.message
        );
      }
    },
    {
      timezone: 'Africa/Lagos',
    }
  );

  console.log(`
==================================================
[SCHEDULER] ✅ Email digest scheduler started

Timezone: Africa/Lagos

Schedules:
- Morning Digest:    07:00 WAT
- Escrow Reminder:   10:00 WAT
- Afternoon Digest:  13:00 WAT
- Night Digest:      21:00 WAT
==================================================
`);
};

module.exports = {
  startScheduler,
};