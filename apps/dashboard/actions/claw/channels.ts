'use server';

import { revalidatePath } from 'next/cache';

import { Role } from '@prisma/client';

import { GoclawHttpError } from '@workspace/goclaw';
import { routes, replaceOrgSlug } from '@workspace/routes';

import { authOrganizationActionClient } from '~/actions/safe-action';
import { createGoclawChannelSchema } from '~/schemas/goclaw/create-channel-schema';
import { getGoclawClientForOrganization } from '~/lib/goclaw/get-org-client';
import { z } from 'zod';

export const listGoclawChannelsAction = authOrganizationActionClient
  .metadata({ actionName: 'listGoclawChannelsAction' })
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
      const channels = await resolved.client.listChannelInstances();
      return { success: true as const, channels };
    } catch (e) {
      const msg =
        e instanceof GoclawHttpError ? e.body : 'Failed to list channels.';
      return { success: false as const, error: msg };
    }
  });

export const createGoclawChannelAction = authOrganizationActionClient
  .metadata({ actionName: 'createGoclawChannelAction' })
  .inputSchema(createGoclawChannelSchema)
  .action(async ({ parsedInput, ctx }) => {
    const membership = ctx.session.user.memberships.find(
      (m) => m.organizationId === ctx.organization.id
    );
    if (
      !membership ||
      (membership.role !== Role.ADMIN && !membership.isOwner)
    ) {
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
      const created = await resolved.client.createChannelInstance({
        name: parsedInput.name,
        channel_type: parsedInput.channel_type,
        agent_id: parsedInput.agent_id,
        credentials: { token: parsedInput.bot_token },
        enabled: true
      });
      revalidatePath(
        replaceOrgSlug(
          routes.dashboard.organizations.slug.ai.Channels,
          ctx.organization.slug
        )
      );
      return { success: true as const, channel: created };
    } catch (e) {
      const msg =
        e instanceof GoclawHttpError ? e.body : 'Failed to create channel.';
      return { success: false as const, error: msg };
    }
  });

const deleteChannelSchema = z.object({ id: z.string().min(1) });

export const deleteGoclawChannelAction = authOrganizationActionClient
  .metadata({ actionName: 'deleteGoclawChannelAction' })
  .inputSchema(deleteChannelSchema)
  .action(async ({ parsedInput, ctx }) => {
    const membership = ctx.session.user.memberships.find(
      (m) => m.organizationId === ctx.organization.id
    );
    if (
      !membership ||
      (membership.role !== Role.ADMIN && !membership.isOwner)
    ) {
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
      await resolved.client.deleteChannelInstance(parsedInput.id);
      revalidatePath(
        replaceOrgSlug(
          routes.dashboard.organizations.slug.ai.Channels,
          ctx.organization.slug
        )
      );
      return { success: true as const };
    } catch (e) {
      const msg =
        e instanceof GoclawHttpError ? e.body : 'Failed to delete channel.';
      return { success: false as const, error: msg };
    }
  });
