'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { Role } from '@prisma/client';

import { authOrganizationActionClient } from '~/actions/safe-action';
import { provisionGoclawTenantForOrganization } from '~/data/goclaw/provision-goclaw-tenant';
import { routes, replaceOrgSlug } from '@workspace/routes';

const provisionGoclawTenantSchema = z.object({});

export const provisionGoclawTenantAction = authOrganizationActionClient
  .metadata({ actionName: 'provisionGoclawTenantAction' })
  .inputSchema(provisionGoclawTenantSchema)
  .action(async ({ ctx }) => {
    const membership = await ctx.session.user.memberships.find(
      (m) => m.organizationId === ctx.organization.id
    );
    if (
      !membership ||
      (membership.role !== Role.ADMIN && !membership.isOwner)
    ) {
      return { success: false as const, error: 'Forbidden' };
    }

    const result = await provisionGoclawTenantForOrganization({
      organizationId: ctx.organization.id,
      ownerUserId: ctx.session.user.id
    });

    if (!result.ok) {
      return { success: false as const, error: result.message };
    }

    revalidatePath(
      replaceOrgSlug(routes.dashboard.organizations.slug.ai.Index, ctx.organization.slug)
    );
    return { success: true as const };
  });
