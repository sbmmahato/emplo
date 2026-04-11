'use server';

import { revalidatePath } from 'next/cache';

import { Role } from '@prisma/client';

import { GoclawHttpError } from '@workspace/goclaw';
import { routes, replaceOrgSlug } from '@workspace/routes';

import { authOrganizationActionClient } from '~/actions/safe-action';
import { createGoclawProviderSchema } from '~/schemas/goclaw/create-provider-schema';
import { getGoclawClientForOrganization } from '~/lib/goclaw/get-org-client';
import { z } from 'zod';

export const listGoclawProvidersAction = authOrganizationActionClient
  .metadata({ actionName: 'listGoclawProvidersAction' })
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
      const providers = await resolved.client.listProviders();
      return { success: true as const, providers };
    } catch (e) {
      const msg =
        e instanceof GoclawHttpError ? e.body : 'Failed to list providers.';
      return { success: false as const, error: msg };
    }
  });

export const createGoclawProviderAction = authOrganizationActionClient
  .metadata({ actionName: 'createGoclawProviderAction' })
  .inputSchema(createGoclawProviderSchema)
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
    // GoClaw API uses provider_type + api_base (see /v1/openapi.json).
    const body: Record<string, unknown> = {
      name: parsedInput.name,
      provider_type: parsedInput.type,
      enabled: true
    };
    if (parsedInput.api_key) {
      body.api_key = parsedInput.api_key;
    }
    if (parsedInput.base_url) {
      body.api_base = parsedInput.base_url;
    }
    try {
      const created = await resolved.client.createProvider(body);
      revalidatePath(
        replaceOrgSlug(
          routes.dashboard.organizations.slug.ai.Providers,
          ctx.organization.slug
        )
      );
      return { success: true as const, provider: created };
    } catch (e) {
      const msg =
        e instanceof GoclawHttpError ? e.body : 'Failed to create provider.';
      return { success: false as const, error: msg };
    }
  });

const deleteProviderSchema = z.object({ id: z.string().min(1) });

export const deleteGoclawProviderAction = authOrganizationActionClient
  .metadata({ actionName: 'deleteGoclawProviderAction' })
  .inputSchema(deleteProviderSchema)
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
      await resolved.client.deleteProvider(parsedInput.id);
      revalidatePath(
        replaceOrgSlug(
          routes.dashboard.organizations.slug.ai.Providers,
          ctx.organization.slug
        )
      );
      return { success: true as const };
    } catch (e) {
      const msg =
        e instanceof GoclawHttpError ? e.body : 'Failed to delete provider.';
      return { success: false as const, error: msg };
    }
  });
