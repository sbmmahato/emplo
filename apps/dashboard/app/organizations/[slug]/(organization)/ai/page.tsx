import * as React from 'react';

import { Role } from '@prisma/client';

import { getAuthOrganizationContext } from '@workspace/auth/context';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from '@workspace/ui/components/card';

import { GoclawOverviewActions } from '~/components/organizations/slug/ai/goclaw-overview-actions';
import {
  getGoclawTenantRecord,
  getOrganizationAiQuota
} from '~/data/goclaw/get-goclaw-tenant';
import { fetchGoclawUsageAndEdition } from '~/data/goclaw/fetch-goclaw-usage';

export default async function AiOverviewPage(): Promise<React.JSX.Element> {
  const ctx = await getAuthOrganizationContext();
  const membership = ctx.session.user.memberships.find(
    (m) => m.organizationId === ctx.organization.id
  );
  const canProvisionRuntime =
    membership &&
    (membership.role === Role.ADMIN || membership.isOwner);

  const [tenant, quota] = await Promise.all([
    getGoclawTenantRecord(ctx.organization.id),
    getOrganizationAiQuota(ctx.organization.id)
  ]);

  const usage =
    tenant?.status === 'ACTIVE'
      ? await fetchGoclawUsageAndEdition(
          ctx.organization.id,
          ctx.session.user.id
        )
      : ({ ok: false as const, error: 'not_connected' as const });

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>GoClaw tenant</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>
            <span className="text-muted-foreground">Status: </span>
            {tenant?.status ?? 'not provisioned'}
          </p>
          {tenant?.apiKeyPrefix && (
            <p>
              <span className="text-muted-foreground">API key prefix: </span>
              {tenant.apiKeyPrefix}
            </p>
          )}
          {tenant?.lastError && (
            <p className="text-destructive wrap-break-word">{tenant.lastError}</p>
          )}
          <GoclawOverviewActions
            canProvision={Boolean(
              canProvisionRuntime && tenant?.status !== 'ACTIVE'
            )}
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Quotas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            <span className="text-muted-foreground">Tier: </span>
            {quota?.tier ?? 'free (default)'}
          </p>
          <p>
            <span className="text-muted-foreground">Max agents: </span>
            {quota?.maxAgents ?? 5}
          </p>
          <p className="text-muted-foreground">
            Quotas sync from your active subscription when the GoClaw tenant is
            provisioned.
          </p>
        </CardContent>
      </Card>
      {usage.ok && (
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>GoClaw usage / edition (API)</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="bg-muted max-h-64 overflow-auto rounded-md p-4 text-xs wrap-break-word">
              {JSON.stringify(
                { usage: usage.usage, edition: usage.edition },
                null,
                2
              )}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
