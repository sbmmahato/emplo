import { z } from 'zod';

export const createGoclawAgentSchema = z.object({
  agent_key: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9-]+$/),
  display_name: z.string().min(1).max(128),
  provider: z.string().min(1).max(64),
  model: z.string().min(1).max(128),
  /** Maps to GoClaw `tools_config.profile` (built-in tool allowlists). */
  tools_profile: z
    .enum(['full', 'coding', 'messaging', 'minimal'])
    .default('coding')
});

export type CreateGoclawAgentSchema = z.infer<typeof createGoclawAgentSchema>;
