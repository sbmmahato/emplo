import * as React from 'react';

import { getAuthOrganizationContext } from '@workspace/auth/context';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from '@workspace/ui/components/card';

import { GoclawTeamEventsForm } from '~/components/organizations/slug/ai/goclaw-team-events-form';
import { fetchGoclawTeams } from '~/data/goclaw/fetch-goclaw-data';

export default async function AiTeamsPage(): Promise<React.JSX.Element> {
  const ctx = await getAuthOrganizationContext();
  const membership = ctx.session.user.memberships.find(
    (m) => m.organizationId === ctx.organization.id
  );
  const canView = Boolean(membership);

  const teams = await fetchGoclawTeams(
    ctx.organization.id,
    ctx.session.user.id
  );

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Teams</CardTitle>
        </CardHeader>
        <CardContent>
          {teams.ok ? (
            <pre className="bg-muted max-h-[480px] overflow-auto rounded-md p-4 text-xs wrap-break-word">
              {JSON.stringify(teams.data, null, 2)}
            </pre>
          ) : (
            <p className="text-muted-foreground text-sm">
              {teams.error === 'not_connected'
                ? 'Provision the GoClaw tenant from the Overview tab.'
                : String(teams.error)}
            </p>
          )}
        </CardContent>
      </Card>
      {canView && teams.ok && (
        <Card>
          <CardHeader>
            <CardTitle>Team events</CardTitle>
          </CardHeader>
          <CardContent>
            <GoclawTeamEventsForm />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
