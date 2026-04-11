'use server';

import { revalidatePath } from 'next/cache';

import { Role } from '@prisma/client';

import { GoclawHttpError } from '@workspace/goclaw';
import { routes, replaceOrgSlug } from '@workspace/routes';

import { authOrganizationActionClient } from '~/actions/safe-action';
import { createGoclawAgentSchema } from '~/schemas/goclaw/create-agent-schema';
import { updateGoclawAgentToolsSchema } from '~/schemas/goclaw/update-agent-tools-schema';
import { getGoclawClientForOrganization } from '~/lib/goclaw/get-org-client';
import { assertAgentQuotaAllowsCreate } from '~/lib/goclaw/quotas';
import { buildToolsConfigFromProfile } from '~/lib/goclaw/tools-profile';
import { z } from 'zod';

export const listGoclawAgentsAction = authOrganizationActionClient
  .metadata({ actionName: 'listGoclawAgentsAction' })
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
        error: 'GoClaw tenant is not connected. Provision AI runtime first.'
      };
    }
    try {
      const agents = await resolved.client.listAgents();
      return { success: true as const, agents };
    } catch (e) {
      const msg =
        e instanceof GoclawHttpError ? e.body : 'Failed to list agents.';
      return { success: false as const, error: msg };
    }
  });

export const createGoclawAgentAction = authOrganizationActionClient
  .metadata({ actionName: 'createGoclawAgentAction' })
  .inputSchema(createGoclawAgentSchema)
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
    const quota = await assertAgentQuotaAllowsCreate(
      ctx.organization.id,
      ctx.session.user.id
    );
    if (!quota.ok) {
      return { success: false as const, error: quota.message };
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
      const created = await resolved.client.createAgent({
        agent_key: parsedInput.agent_key,
        display_name: parsedInput.display_name,
        provider: parsedInput.provider,
        model: parsedInput.model,
        agent_type: 'open',
        tools_config: buildToolsConfigFromProfile(parsedInput.tools_profile)
      });
      revalidatePath(
        replaceOrgSlug(
          routes.dashboard.organizations.slug.ai.Agents,
          ctx.organization.slug
        )
      );
      return { success: true as const, agent: created };
    } catch (e) {
      const msg =
        e instanceof GoclawHttpError ? e.body : 'Failed to create agent.';
      return { success: false as const, error: msg };
    }
  });

export const updateGoclawAgentToolsAction = authOrganizationActionClient
  .metadata({ actionName: 'updateGoclawAgentToolsAction' })
  .inputSchema(updateGoclawAgentToolsSchema)
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
      return {
        success: false as const,
        error: 'GoClaw tenant is not connected.'
      };
    }
    try {
      await resolved.client.updateAgent(parsedInput.agent_id, {
        tools_config: buildToolsConfigFromProfile(parsedInput.tools_profile)
      });
      revalidatePath(
        replaceOrgSlug(
          routes.dashboard.organizations.slug.ai.Agents,
          ctx.organization.slug
        )
      );
      return { success: true as const };
    } catch (e) {
      const msg =
        e instanceof GoclawHttpError ? e.body : 'Failed to update agent tools.';
      return { success: false as const, error: msg };
    }
  });

const deleteAgentSchema = z.object({ id: z.string().min(1) });

export const deleteGoclawAgentAction = authOrganizationActionClient
  .metadata({ actionName: 'deleteGoclawAgentAction' })
  .inputSchema(deleteAgentSchema)
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
      await resolved.client.deleteAgent(parsedInput.id);
      revalidatePath(
        replaceOrgSlug(
          routes.dashboard.organizations.slug.ai.Agents,
          ctx.organization.slug
        )
      );
      return { success: true as const };
    } catch (e) {
      const msg =
        e instanceof GoclawHttpError ? e.body : 'Failed to delete agent.';
      return { success: false as const, error: msg };
    }
  });
