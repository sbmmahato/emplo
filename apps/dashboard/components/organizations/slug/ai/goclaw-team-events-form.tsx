'use client';

import * as React from 'react';

import { Button } from '@workspace/ui/components/button';
import { Input } from '@workspace/ui/components/input';
import { Label } from '@workspace/ui/components/label';
import { toast } from '@workspace/ui/components/sonner';

import { getGoclawTeamEventsAction } from '~/actions/goclaw/teams';

export function GoclawTeamEventsForm(): React.JSX.Element {
  const [loading, setLoading] = React.useState(false);
  const [eventsJson, setEventsJson] = React.useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const teamId = String(fd.get('teamId') ?? '').trim();
    setLoading(true);
    setEventsJson(null);
    try {
      const result = await getGoclawTeamEventsAction({ teamId });
      if (result?.serverError || result?.validationErrors) {
        toast.error('Request failed');
        return;
      }
      if (result?.data?.success) {
        setEventsJson(JSON.stringify(result.data.events, null, 2));
        return;
      }
      toast.error(
        result?.data && 'error' in result.data
          ? String(result.data.error)
          : 'Failed to load events'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid gap-3">
      <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => void onSubmit(e)}>
        <div className="grid gap-1">
          <Label htmlFor="teamId">Team ID</Label>
          <Input id="teamId" name="teamId" required disabled={loading} />
        </div>
        <Button type="submit" disabled={loading}>
          Load events
        </Button>
      </form>
      {eventsJson && (
        <pre className="bg-muted max-h-80 overflow-auto rounded-md p-3 text-xs wrap-break-word">
          {eventsJson}
        </pre>
      )}
      <p className="text-muted-foreground text-xs">
        Team creation may require GoClaw WebSocket or CLI; use Import in the GoClaw UI when
        HTTP list is unavailable. Export/import archives are supported via the GoClaw API.
      </p>
    </div>
  );
}
