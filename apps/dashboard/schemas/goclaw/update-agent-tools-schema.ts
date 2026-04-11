import { z } from 'zod';

export const updateGoclawAgentToolsSchema = z.object({
  /** GoClaw agent UUID (v7 in current gateway). */
  agent_id: z.string().min(1).max(64),
  tools_profile: z.enum(['full', 'coding', 'messaging', 'minimal'])
});

export type UpdateGoclawAgentToolsSchema = z.infer<
  typeof updateGoclawAgentToolsSchema
>;
