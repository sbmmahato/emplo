import * as React from 'react';

import { getAuthOrganizationContext } from '@workspace/auth/context';
import { routes } from '@workspace/routes';

import { GoclawSubnav } from '~/components/organizations/slug/ai/goclaw-subnav';
import { OrganizationPageTitle } from '~/components/organizations/slug/organization-page-title';
import { createTitle } from '~/lib/formatters';

export const metadata = {
  title: createTitle('AI')
};

export default async function AiLayout(
  props: React.PropsWithChildren
): Promise<React.JSX.Element> {
  const ctx = await getAuthOrganizationContext();
  const slug = ctx.organization.slug;

  return (
    <div className="flex flex-col gap-6">
      <OrganizationPageTitle
        index={{
          route: routes.dashboard.organizations.slug.settings.organization.Index,
          title: 'Organization'
        }}
        title="AI employees (GoClaw)"
        info="Manage agents, providers, channels, and teams backed by your GoClaw runtime."
      />
      <GoclawSubnav slug={slug} />
      {props.children}
    </div>
  );
}
