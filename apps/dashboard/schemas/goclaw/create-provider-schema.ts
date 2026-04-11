import { z } from 'zod';

export const createGoclawProviderSchema = z.object({
  name: z.string().min(1).max(128),
  type: z.string().min(1).max(64),
  api_key: z.string().min(1).max(2048).optional(),
  base_url: z.string().url().optional()
});

export type CreateGoclawProviderSchema = z.infer<
  typeof createGoclawProviderSchema
>;
