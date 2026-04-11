'use server';

import { GoclawHttpError } from '@workspace/goclaw';

import { authOrganizationActionClient } from '~/actions/safe-action';
import { getGoclawClientForOrganization } from '~/lib/goclaw/get-org-client';
import { z } from 'zod';

export const getGoclawUsageBreakdownAction = authOrganizationActionClient
  .metadata({ actionName: 'getGoclawUsageBreakdownAction' })
  .inputSchema(z.object({}))
  .action(async ({ ctx }) => {
    const membership = ctx.session.user.memberships.find(
      (m) => m.organizationId === ctx.organization.id
    );
    if (!membership) {
      return { success: false as const, error: 'Forbidden' };
    }
    const resolved = await getGoclawClientForOrganization(
      ctx.organization.id,
      ctx.session.user.id
    );
    if (!resolved) {
      return {
        success: false as const,
        error: 'GoClaw tenant is not connected.'
      };
    }
    try {
      const usage = await resolved.client.getUsageBreakdown('');
      const edition = await resolved.client.getEdition();
      return { success: true as const, usage, edition };
    } catch (e) {
      const msg =
        e instanceof GoclawHttpError ? e.body : 'Failed to load usage.';
      return { success: false as const, error: msg };
    }
  });
