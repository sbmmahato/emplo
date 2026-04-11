/**
 * Normalizes GET /v1/agents responses (array vs `{ agents }` vs `{ items }`).
 */
export type GoclawAgentListItem = {
  id: string;
  agent_key?: string;
  display_name?: string;
  tools_config?: { profile?: string } | null;
};

export function parseGoclawAgentsList(data: unknown): GoclawAgentListItem[] {
  if (Array.isArray(data)) {
    return data as GoclawAgentListItem[];
  }
  if (data && typeof data === 'object') {
    const o = data as Record<string, unknown>;
    if (Array.isArray(o.agents)) {
      return o.agents as GoclawAgentListItem[];
    }
    if (Array.isArray(o.items)) {
      return o.items as GoclawAgentListItem[];
    }
  }
  return [];
}
