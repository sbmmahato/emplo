'use client';

import * as React from 'react';

import { Button } from '@workspace/ui/components/button';
import { Label } from '@workspace/ui/components/label';
import { toast } from '@workspace/ui/components/sonner';

import { updateGoclawAgentToolsAction } from '~/actions/goclaw/agents';
import {
  parseGoclawAgentsList,
  type GoclawAgentListItem
} from '~/lib/goclaw/parse-agents-list';

const PROFILES = ['full', 'coding', 'messaging', 'minimal'] as const;

function currentProfile(agent: GoclawAgentListItem): (typeof PROFILES)[number] {
  const p = agent.tools_config?.profile;
  if (p && PROFILES.includes(p as (typeof PROFILES)[number])) {
    return p as (typeof PROFILES)[number];
  }
  return 'coding';
}

export type GoclawAgentToolsEditorProps = {
  agentsPayload: unknown;
};

/**
 * Per-agent tool profile editor (GoClaw `tools_config.profile`).
 */
export function GoclawAgentToolsEditor({
  agentsPayload
}: GoclawAgentToolsEditorProps): React.JSX.Element {
  const agents = React.useMemo(
    () => parseGoclawAgentsList(agentsPayload),
    [agentsPayload]
  );
  const [loadingId, setLoadingId] = React.useState<string | null>(null);

  const onSave = async (
    agentId: string,
    tools_profile: (typeof PROFILES)[number]
  ): Promise<void> => {
    setLoadingId(agentId);
    try {
      const result = await updateGoclawAgentToolsAction({
        agent_id: agentId,
        tools_profile
      });
      if (result?.serverError || result?.validationErrors) {
        toast.error('Validation failed');
        return;
      }
      if (result?.data?.success) {
        toast.success('Tool profile updated');
        window.location.reload();
        return;
      }
      toast.error(
        result?.data && 'error' in result.data
          ? String(result.data.error)
          : 'Update failed'
      );
    } finally {
      setLoadingId(null);
    }
  };

  if (agents.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        No agents returned from GoClaw yet.
      </p>
    );
  }

  return (
    <div className="grid max-w-2xl gap-4">
      {agents.map((agent) => (
        <div
          key={agent.id}
          className="flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-end sm:justify-between"
        >
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">
              {agent.display_name ?? agent.agent_key ?? agent.id}
            </p>
            <p className="text-muted-foreground truncate font-mono text-xs">
              {agent.agent_key ?? agent.id}
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <div className="grid gap-1">
              <Label className="sr-only" htmlFor={`profile-${agent.id}`}>
                Tool profile
              </Label>
              <select
                id={`profile-${agent.id}`}
                className="border-input bg-background h-9 min-w-[200px] rounded-md border px-2 text-sm"
                defaultValue={currentProfile(agent)}
                disabled={loadingId === agent.id}
              >
                <option value="coding">coding</option>
                <option value="full">full</option>
                <option value="messaging">messaging</option>
                <option value="minimal">minimal</option>
              </select>
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={loadingId === agent.id}
              onClick={() => {
                const sel = document.getElementById(
                  `profile-${agent.id}`
                ) as HTMLSelectElement | null;
                const v = (sel?.value ?? 'coding') as (typeof PROFILES)[number];
                void onSave(agent.id, v);
              }}
            >
              {loadingId === agent.id ? 'Saving…' : 'Apply'}
            </Button>
          </div>
        </div>
      ))}
      <p className="text-muted-foreground text-xs">
        Changing profile updates GoClaw <code className="text-xs">tools_config</code>.
        Gateway must expose optional runtimes (sandbox, browser) for some tools.
      </p>
    </div>
  );
}
