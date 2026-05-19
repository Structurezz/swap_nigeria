const { z } = require('zod');

const proposeSwapSchema = z.object({
  receiverId: z.string().min(1),
  initiatorListing: z.string().optional(),
  receiverListing: z.string().optional(),
  proposalNote: z.string().max(500).optional(),
  agreedValue: z.number().min(0).optional(),
  topUpAmountKobo: z.number().int().min(0).optional(),
  topUpPayerRole: z.enum(['initiator', 'receiver', 'none']).optional(),
  collateralPercent: z.number().int().min(1).max(100).optional(),
});

const respondSwapSchema = z.object({
  action: z.enum(['accept', 'cancel']),
});

const setAddressSchema = z.object({
  fullName:     z.string().min(2).max(100),
  phone:        z.string().min(7).max(20),
  addressLine1: z.string().min(3).max(200),
  addressLine2: z.string().max(200).optional(),
  city:         z.string().min(2).max(100),
  state:        z.string().min(2).max(100),
  landmark:     z.string().max(200).optional(),
});

const DELIVERY_PROVIDERS = [
  'gig', 'kwik', 'sendbox', 'dhl', 'fedex',
  'nipost', 'red_star', 'chisco', 'abc', 'other',
];

const submitShipmentSchema = z.object({
  provider:          z.enum(DELIVERY_PROVIDERS),
  providerLabel:     z.string().min(2).max(100),
  trackingNumber:    z.string().min(3).max(100),
  trackingUrl:       z.string().max(500).optional(),
  estimatedDelivery: z.string().datetime().optional(),
  proofImages:       z.array(z.string().url()).max(5).optional(),
  notes:             z.string().max(500).optional(),
});

const disputeSchema = z.object({
  reason: z.string().min(10).max(1000),
});

module.exports = {
  proposeSwapSchema, respondSwapSchema,
  setAddressSchema, submitShipmentSchema,
  disputeSchema,
};
