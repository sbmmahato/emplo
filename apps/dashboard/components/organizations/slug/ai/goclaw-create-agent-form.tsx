'use client';

import * as React from 'react';

import { Button } from '@workspace/ui/components/button';
import { Input } from '@workspace/ui/components/input';
import { Label } from '@workspace/ui/components/label';
import { toast } from '@workspace/ui/components/sonner';

import { createGoclawAgentAction } from '~/actions/goclaw/agents';

export function GoclawCreateAgentForm(): React.JSX.Element {
  const [loading, setLoading] = React.useState(false);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const agent_key = String(fd.get('agent_key') ?? '').trim();
    const display_name = String(fd.get('display_name') ?? '').trim();
    const provider = String(fd.get('provider') ?? '').trim();
    const model = String(fd.get('model') ?? '').trim();
    setLoading(true);
    try {
      const tools_profile = String(
        fd.get('tools_profile') ?? 'coding'
      ) as 'full' | 'coding' | 'messaging' | 'minimal';

      const result = await createGoclawAgentAction({
        agent_key,
        display_name,
        provider,
        model,
        tools_profile
      });
      if (result?.serverError || result?.validationErrors) {
        toast.error('Validation failed');
        return;
      }
      if (result?.data?.success) {
        toast.success('Agent created');
        e.currentTarget.reset();
        window.location.reload();
        return;
      }
      toast.error(
        result?.data && 'error' in result.data
          ? String(result.data.error)
          : 'Failed to create agent'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="grid max-w-lg gap-3" onSubmit={(e) => void onSubmit(e)}>
      <div className="grid gap-1">
        <Label htmlFor="agent_key">Agent key (slug)</Label>
        <Input
          id="agent_key"
          name="agent_key"
          placeholder="e.g. support-bot"
          required
          disabled={loading}
        />
      </div>
      <div className="grid gap-1">
        <Label htmlFor="display_name">Display name</Label>
        <Input
          id="display_name"
          name="display_name"
          required
          disabled={loading}
        />
      </div>
      <div className="grid gap-1">
        <Label htmlFor="provider">Provider</Label>
        <Input
          id="provider"
          name="provider"
          placeholder="anthropic, openai, openrouter, …"
          required
          disabled={loading}
        />
      </div>
      <div className="grid gap-1">
        <Label htmlFor="model">Model</Label>
        <Input id="model" name="model" required disabled={loading} />
      </div>
      <div className="grid gap-1">
        <Label htmlFor="tools_profile">Tool profile</Label>
        <select
          id="tools_profile"
          name="tools_profile"
          className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
          defaultValue="coding"
          disabled={loading}
        >
          <option value="coding">coding (web, files, shell, memory, …)</option>
          <option value="full">full (all tools, including browser)</option>
          <option value="messaging">messaging (lighter)</option>
          <option value="minimal">minimal</option>
        </select>
        <p className="text-muted-foreground text-xs">
          Controls GoClaw built-in tools (see GoClaw docs: tools overview). Sandbox,
          browser, and web search still need gateway configuration.
        </p>
      </div>
      <Button type="submit" disabled={loading}>
        {loading ? 'Creating…' : 'Create agent'}
      </Button>
    </form>
  );
}
