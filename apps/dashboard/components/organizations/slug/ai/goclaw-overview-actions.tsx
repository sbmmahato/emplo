'use client';

import * as React from 'react';

import { Button } from '@workspace/ui/components/button';
import { toast } from '@workspace/ui/components/sonner';

import { provisionGoclawTenantAction } from '~/actions/goclaw/provision-tenant';

export type GoclawOverviewActionsProps = {
  canProvision: boolean;
};

export function GoclawOverviewActions({
  canProvision
}: GoclawOverviewActionsProps): React.JSX.Element {
  const [loading, setLoading] = React.useState(false);

  const onProvision = async (): Promise<void> => {
    setLoading(true);
    try {
      const result = await provisionGoclawTenantAction({});
      if (result?.serverError || result?.validationErrors) {
        toast.error("Couldn't provision tenant");
        return;
      }
      const data = result?.data;
      if (data?.success) {
        toast.success('GoClaw tenant provisioned');
        window.location.reload();
        return;
      }
      const err =
        data && 'error' in data ? String(data.error) : "Couldn't provision tenant";
      toast.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (!canProvision) {
    return (
      <p className="text-muted-foreground text-sm">
        Only organization admins can provision the AI runtime.
      </p>
    );
  }

  return (
    <Button
      type="button"
      disabled={loading}
      onClick={() => void onProvision()}
    >
      {loading ? 'Provisioning…' : 'Provision GoClaw tenant'}
    </Button>
  );
}
