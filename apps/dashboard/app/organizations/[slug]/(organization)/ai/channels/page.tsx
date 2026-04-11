import * as React from 'react';

import { Role } from '@prisma/client';

import { getAuthOrganizationContext } from '@workspace/auth/context';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from '@workspace/ui/components/card';

import { GoclawChannelOauth } from '~/components/organizations/slug/ai/goclaw-channel-oauth';
import { GoclawCreateChannelForm } from '~/components/organizations/slug/ai/goclaw-create-channel-form';
import { fetchGoclawChannels } from '~/data/goclaw/fetch-goclaw-data';

export default async function AiChannelsPage(): Promise<React.JSX.Element> {
  const ctx = await getAuthOrganizationContext();
  const membership = ctx.session.user.memberships.find(
    (m) => m.organizationId === ctx.organization.id
  );
  const canMutate =
    membership &&
    (membership.role === Role.ADMIN || membership.isOwner);

  const channels = await fetchGoclawChannels(
    ctx.organization.id,
    ctx.session.user.id
  );

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Channel instances</CardTitle>
        </CardHeader>
        <CardContent>
          {channels.ok ? (
            <pre className="bg-muted max-h-[480px] overflow-auto rounded-md p-4 text-xs wrap-break-word">
              {JSON.stringify(channels.data, null, 2)}
            </pre>
          ) : (
            <p className="text-muted-foreground text-sm">
              {channels.error === 'not_connected'
                ? 'Provision the GoClaw tenant from the Overview tab.'
                : String(channels.error)}
            </p>
          )}
        </CardContent>
      </Card>
      {canMutate && channels.ok && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>OAuth (Slack / Discord / GitHub)</CardTitle>
            </CardHeader>
            <CardContent>
              <GoclawChannelOauth organizationId={ctx.organization.id} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Manual token</CardTitle>
            </CardHeader>
            <CardContent>
              <GoclawCreateChannelForm />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
