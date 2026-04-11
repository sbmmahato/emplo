'use server';

import { GoclawHttpError } from '@workspace/goclaw';

import { authOrganizationActionClient } from '~/actions/safe-action';
import { getGoclawClientForOrganization } from '~/lib/goclaw/get-org-client';
import { z } from 'zod';

export const listGoclawTeamsAction = authOrganizationActionClient
  .metadata({ actionName: 'listGoclawTeamsAction' })
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
      const teams = await resolved.client.listTeams();
      return { success: true as const, teams };
    } catch (e) {
      const msg =
        e instanceof GoclawHttpError
          ? e.body
          : 'Failed to list teams (your gateway may expose teams only over WebSocket).';
      return { success: false as const, error: msg };
    }
  });

const teamEventsSchema = z.object({ teamId: z.string().min(1) });

export const getGoclawTeamEventsAction = authOrganizationActionClient
  .metadata({ actionName: 'getGoclawTeamEventsAction' })
  .inputSchema(teamEventsSchema)
  .action(async ({ parsedInput, ctx }) => {
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
      return { success: false as const, error: 'GoClaw tenant is not connected.' };
    }
    try {
      const events = await resolved.client.getTeamEvents(parsedInput.teamId);
      return { success: true as const, events };
    } catch (e) {
      const msg =
        e instanceof GoclawHttpError ? e.body : 'Failed to load team events.';
      return { success: false as const, error: msg };
    }
  });
