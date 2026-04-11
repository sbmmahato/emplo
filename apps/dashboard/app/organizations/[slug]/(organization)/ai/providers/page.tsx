import * as React from 'react';

import { Role } from '@prisma/client';

import { getAuthOrganizationContext } from '@workspace/auth/context';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from '@workspace/ui/components/card';

import { GoclawCreateProviderForm } from '~/components/organizations/slug/ai/goclaw-create-provider-form';
import { fetchGoclawProviders } from '~/data/goclaw/fetch-goclaw-data';

export default async function AiProvidersPage(): Promise<React.JSX.Element> {
  const ctx = await getAuthOrganizationContext();
  const membership = ctx.session.user.memberships.find(
    (m) => m.organizationId === ctx.organization.id
  );
  const canMutate =
    membership &&
    (membership.role === Role.ADMIN || membership.isOwner);

  const providers = await fetchGoclawProviders(
    ctx.organization.id,
    ctx.session.user.id
  );

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>LLM providers</CardTitle>
        </CardHeader>
        <CardContent>
          {providers.ok ? (
            <pre className="bg-muted max-h-[480px] overflow-auto rounded-md p-4 text-xs wrap-break-word">
              {JSON.stringify(providers.data, null, 2)}
            </pre>
          ) : (
            <p className="text-muted-foreground text-sm">
              {providers.error === 'not_connected'
                ? 'Provision the GoClaw tenant from the Overview tab.'
                : String(providers.error)}
            </p>
          )}
        </CardContent>
      </Card>
      {canMutate && providers.ok && (
        <Card>
          <CardHeader>
            <CardTitle>Add provider</CardTitle>
          </CardHeader>
          <CardContent>
            <GoclawCreateProviderForm />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
