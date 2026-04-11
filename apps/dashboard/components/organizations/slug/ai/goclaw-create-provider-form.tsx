'use client';

import * as React from 'react';

import { Button } from '@workspace/ui/components/button';
import { Input } from '@workspace/ui/components/input';
import { Label } from '@workspace/ui/components/label';
import { toast } from '@workspace/ui/components/sonner';

import { createGoclawProviderAction } from '~/actions/goclaw/providers';

export function GoclawCreateProviderForm(): React.JSX.Element {
  const [loading, setLoading] = React.useState(false);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const name = String(fd.get('name') ?? '').trim();
    const type = String(fd.get('type') ?? '').trim();
    const api_key = String(fd.get('api_key') ?? '').trim();
    const base_url = String(fd.get('base_url') ?? '').trim();
    setLoading(true);
    try {
      const result = await createGoclawProviderAction({
        name,
        type,
        api_key: api_key || undefined,
        base_url: base_url || undefined
      });
      if (result?.serverError || result?.validationErrors) {
        toast.error('Validation failed');
        return;
      }
      if (result?.data?.success) {
        toast.success('Provider created');
        e.currentTarget.reset();
        window.location.reload();
        return;
      }
      toast.error(
        result?.data && 'error' in result.data
          ? String(result.data.error)
          : 'Failed to create provider'
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
        <Label htmlFor="type">Type (provider_type)</Label>
        <Input
          id="type"
          name="type"
          placeholder="e.g. openai_compat or anthropic_native"
          required
          disabled={loading}
        />
      </div>
      <div className="grid gap-1">
        <Label htmlFor="api_key">API key (optional)</Label>
        <Input id="api_key" name="api_key" type="password" disabled={loading} />
      </div>
      <div className="grid gap-1">
        <Label htmlFor="base_url">Base URL (api_base, optional)</Label>
        <Input
          id="base_url"
          name="base_url"
          type="url"
          placeholder="Required for most openai_compat; omit for native APIs"
          disabled={loading}
        />
      </div>
      <Button type="submit" disabled={loading}>
        {loading ? 'Creating…' : 'Create provider'}
      </Button>
    </form>
  );
}
