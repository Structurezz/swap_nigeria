const { z } = require('zod');

const updateProfileSchema = z.object({
  fullName: z.string().min(2).max(120).optional(),
  username: z.string().min(3).max(60).regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, underscores').optional(),
  bio: z.string().max(500).optional(),
  locationState: z.string().optional(),
  locationLga: z.string().optional(),
  locationArea: z.string().optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
});

module.exports = { updateProfileSchema };
