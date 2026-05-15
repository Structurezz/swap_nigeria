const { z } = require('zod');

const optStr = () => z.preprocess(v => (v === '' ? undefined : v), z.string().optional());
const optNum = () => z.preprocess(v => (v === '' || v == null ? undefined : Number(v)), z.number().min(0).optional());
const optEnum = (vals) => z.preprocess(v => (v === '' ? undefined : v), z.enum(vals).optional());

const createListingSchema = z.object({
  title: z.string().min(3).max(200),
  description: z.string().min(10),
  categoryId: optStr(),
  listingType: z.enum(['goods', 'services', 'both']).default('goods'),
  condition: optEnum(['new', 'like_new', 'good', 'fair', 'poor']),
  estimatedValue: optNum(),
  wantsTitle: optStr(),
  wantsDescription: optStr(),
  wantsCategoryId: optStr(),
  wantsValueMin: optNum(),
  wantsValueMax: optNum(),
  minSwapValue: optNum(),
  locationState: optStr(),
  locationLga: optStr(),
  locationArea: optStr(),
  packageWeight: optNum(),
  packageLength: optNum(),
  packageWidth:  optNum(),
  packageHeight: optNum(),
  fragile: z.boolean().optional(),
  handlingInstructions: optStr(),
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
