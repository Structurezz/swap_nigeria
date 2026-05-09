const { z } = require('zod');

const proposeSwapSchema = z.object({
  receiverId: z.string().min(1),
  initiatorListing: z.string().optional(),
  receiverListing: z.string().optional(),
  proposalNote: z.string().max(500).optional(),
  agreedValue: z.number().min(0).optional(),
});

const respondSwapSchema = z.object({
  action: z.enum(['accept', 'cancel']),
});

const setMeetupSchema = z.object({
  meetupLocation: z.string().min(3),
  meetupScheduled: z.string().datetime(),
});

const disputeSchema = z.object({
  reason: z.string().min(10).max(1000),
});

module.exports = { proposeSwapSchema, respondSwapSchema, setMeetupSchema, disputeSchema };
