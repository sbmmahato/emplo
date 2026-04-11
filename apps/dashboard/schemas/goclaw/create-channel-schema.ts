import { z } from 'zod';

export const createGoclawChannelSchema = z.object({
  name: z.string().min(1).max(128),
  channel_type: z.enum(['slack', 'discord']),
  agent_id: z.string().min(1).max(64),
  bot_token: z.string().min(1).max(2048)
});

export type CreateGoclawChannelSchema = z.infer<
  typeof createGoclawChannelSchema
>;
