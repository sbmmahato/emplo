'use client';

import * as React from 'react';

import { Button } from '@workspace/ui/components/button';
import { Input } from '@workspace/ui/components/input';
import { Label } from '@workspace/ui/components/label';
import { toast } from '@workspace/ui/components/sonner';

import { createGoclawChannelAction } from '~/actions/goclaw/channels';

export function GoclawCreateChannelForm(): React.JSX.Element {
  const [loading, setLoading] = React.useState(false);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const name = String(fd.get('name') ?? '').trim();
    const channel_type = String(fd.get('channel_type') ?? 'slack') as
      | 'slack'
      | 'discord';
    const agent_id = String(fd.get('agent_id') ?? '').trim();
    const bot_token = String(fd.get('bot_token') ?? '').trim();
    setLoading(true);
    try {
      const result = await createGoclawChannelAction({
        name,
        channel_type,
        agent_id,
        bot_token
      });
      if (result?.serverError || result?.validationErrors) {
        toast.error('Validation failed');
        return;
      }
      if (result?.data?.success) {
        toast.success('Channel registered');
        e.currentTarget.reset();
        window.location.reload();
        return;
      }
      toast.error(
        result?.data && 'error' in result.data
          ? String(result.data.error)
          : 'Failed to create channel'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="grid max-w-lg gap-3" onSubmit={(e) => void onSubmit(e)}>
      <div className="grid gap-1">
        <Label htmlFor="name">Name</Label>
        <Input id="name" name="name" required disabled={loading} />
      </div>
      <div className="grid gap-1">
        <Label htmlFor="channel_type">Channel type</Label>
        <select
          id="channel_type"
          name="channel_type"
          className="border-input bg-background h-9 rounded-md border px-2 text-sm"
          disabled={loading}
        >
          <option value="slack">slack</option>
          <option value="discord">discord</option>
        </select>
      </div>
      <div className="grid gap-1">
        <Label htmlFor="agent_id">Agent ID</Label>
        <Input id="agent_id" name="agent_id" required disabled={loading} />
      </div>
      <div className="grid gap-1">
        <Label htmlFor="bot_token">Bot token</Label>
        <Input
          id="bot_token"
          name="bot_token"
          type="password"
          required
          disabled={loading}
        />
      </div>
      <Button type="submit" disabled={loading}>
        {loading ? 'Saving…' : 'Register channel'}
      </Button>
    </form>
  );
}
