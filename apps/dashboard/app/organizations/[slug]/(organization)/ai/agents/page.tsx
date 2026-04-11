import * as React from 'react';

import { Role } from '@prisma/client';

import { getAuthOrganizationContext } from '@workspace/auth/context';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from '@workspace/ui/components/card';

import { GoclawAgentToolsEditor } from '~/components/organizations/slug/ai/goclaw-agent-tools-editor';
import { GoclawCreateAgentForm } from '~/components/organizations/slug/ai/goclaw-create-agent-form';
import { fetchGoclawAgents } from '~/data/goclaw/fetch-goclaw-data';

export default async function AiAgentsPage(): Promise<React.JSX.Element> {
  const ctx = await getAuthOrganizationContext();
  const membership = ctx.session.user.memberships.find(
    (m) => m.organizationId === ctx.organization.id
  );
  const canMutate =
    membership &&
    (membership.role === Role.ADMIN || membership.isOwner);

  const agents = await fetchGoclawAgents(
    ctx.organization.id,
    ctx.session.user.id
  );

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Agents</CardTitle>
        </CardHeader>
        <CardContent>
          {agents.ok ? (
            <pre className="bg-muted max-h-[480px] overflow-auto rounded-md p-4 text-xs wrap-break-word">
              {JSON.stringify(agents.data, null, 2)}
            </pre>
          ) : (
            <p className="text-muted-foreground text-sm">
              {agents.error === 'not_connected'
                ? 'Provision the GoClaw tenant from the Overview tab.'
                : String(agents.error)}
            </p>
          )}
        </CardContent>
      </Card>
      {canMutate && agents.ok && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Tool profiles</CardTitle>
            </CardHeader>
            <CardContent>
              <GoclawAgentToolsEditor agentsPayload={agents.data} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Create agent</CardTitle>
            </CardHeader>
            <CardContent>
              <GoclawCreateAgentForm />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
