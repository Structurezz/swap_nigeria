const { z } = require('zod');

const createListingSchema = z.object({
  title: z.string().min(3).max(200),
  description: z.string().min(10),
  categoryId: z.string().optional(),
  listingType: z.enum(['goods', 'services', 'both']).default('goods'),
  condition: z.enum(['new', 'like_new', 'good', 'fair', 'poor']).optional(),
  estimatedValue: z.number().min(0).optional(),
  wantsTitle: z.string().max(200).optional(),
  wantsDescription: z.string().optional(),
  wantsCategoryId: z.string().optional(),
  wantsValueMin: z.number().min(0).optional(),
  wantsValueMax: z.number().min(0).optional(),
  locationState: z.string().optional(),
  locationLga: z.string().optional(),
  locationArea: z.string().optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
  meetupOption: z.boolean().default(true),
  deliveryOption: z.boolean().default(false),
});

const updateListingSchema = createListingSchema.partial().extend({
  status: z.enum(['active', 'paused', 'deleted']).optional(),
});

const searchListingSchema = z.object({
  q: z.string().optional(),
  categoryId: z.string().optional(),
  locationState: z.string().optional(),
  locationLga: z.string().optional(),
  listingType: z.enum(['goods', 'services', 'both']).optional(),
  condition: z.enum(['new', 'like_new', 'good', 'fair', 'poor']).optional(),
  minValue: z.coerce.number().optional(),
  maxValue: z.coerce.number().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(50).default(20),
  sort: z.enum(['newest', 'oldest', 'value_asc', 'value_desc', 'popular']).default('newest'),
});

module.exports = { createListingSchema, updateListingSchema, searchListingSchema };
