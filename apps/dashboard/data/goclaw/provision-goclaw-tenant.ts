import 'server-only';

import { createGoclawClient } from '@workspace/goclaw';
import { keys as goclawKeys } from '@workspace/goclaw/keys';
import { prisma } from '@workspace/database/client';

import { encryptTenantApiKey } from '~/lib/goclaw/tenant-crypto';

import { syncOrganizationAiQuotaFromSubscription } from './sync-ai-quota-from-subscription';

/**
 * Provisions a GoClaw tenant, tenant-bound API key, and persists encrypted credentials.
 */
export async function provisionGoclawTenantForOrganization(params: {
  organizationId: string;
  ownerUserId: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const env = goclawKeys();
  if (!env.GOCLAW_BASE_URL || !env.GOCLAW_GATEWAY_TOKEN || !env.GOCLAW_TENANT_KEY_SECRET) {
    return {
      ok: false,
      message:
        'GoClaw is not configured (GOCLAW_BASE_URL, GOCLAW_GATEWAY_TOKEN, GOCLAW_TENANT_KEY_SECRET).'
    };
  }

  const org = await prisma.organization.findFirst({
    where: { id: params.organizationId },
    select: { id: true, name: true, slug: true }
  });
  if (!org) {
    return { ok: false, message: 'Organization not found.' };
  }

  const existing = await prisma.goclawTenant.findFirst({
    where: { organizationId: org.id }
  });
  if (existing?.status === 'ACTIVE') {
    return { ok: false, message: 'GoClaw tenant is already active.' };
  }

  await prisma.goclawProvisioningJob.create({
    data: {
      organizationId: org.id,
      kind: 'PROVISION_TENANT',
      status: 'PROCESSING',
      attemptCount: 1
    }
  });

  await prisma.goclawTenant.upsert({
    where: { organizationId: org.id },
    create: {
      organizationId: org.id,
      goclawTenantId: 'pending',
      encryptedApiKey: encryptTenantApiKey('pending', env.GOCLAW_TENANT_KEY_SECRET),
      status: 'PENDING'
    },
    update: {
      status: 'PENDING',
      lastError: null
    }
  });

  const admin = createGoclawClient({
    baseUrl: env.GOCLAW_BASE_URL,
    bearerToken: env.GOCLAW_GATEWAY_TOKEN,
    userId: 'system'
  });

  try {
    const tenant = (await admin.createTenant({
      name: org.name,
      slug: org.slug
    })) as { id?: string; slug?: string };

    const tenantId = tenant.id;
    if (!tenantId || typeof tenantId !== 'string') {
      throw new Error('GoClaw did not return a tenant id.');
    }

    await admin.addTenantUser(tenantId, {
      user_id: params.ownerUserId,
      role: 'admin'
    });

    const keyResponse = (await admin.createApiKey({
      name: `dashboard-org-${org.slug}`,
      scopes: ['operator.admin', 'operator.write', 'operator.read'],
      tenant_id: tenantId
    })) as { key?: string; prefix?: string };

    const rawKey = keyResponse.key;
    if (!rawKey || typeof rawKey !== 'string') {
      throw new Error('GoClaw did not return an API key secret.');
    }

    const encrypted = encryptTenantApiKey(rawKey, env.GOCLAW_TENANT_KEY_SECRET);

    await prisma.goclawTenant.update({
      where: { organizationId: org.id },
      data: {
        goclawTenantId: tenantId,
        goclawSlug: typeof tenant.slug === 'string' ? tenant.slug : org.slug,
        encryptedApiKey: encrypted,
        apiKeyPrefix: typeof keyResponse.prefix === 'string' ? keyResponse.prefix : null,
        status: 'ACTIVE',
        provisionedAt: new Date(),
        lastError: null
      }
    });

    await prisma.goclawProvisioningJob.updateMany({
      where: {
        organizationId: org.id,
        kind: 'PROVISION_TENANT',
        status: 'PROCESSING'
      },
      data: { status: 'COMPLETED', lastError: null }
    });

    await syncOrganizationAiQuotaFromSubscription(org.id);

    return { ok: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    await prisma.goclawTenant.update({
      where: { organizationId: org.id },
      data: {
        status: 'FAILED',
        lastError: message
      }
    });
    await prisma.goclawProvisioningJob.updateMany({
      where: {
        organizationId: org.id,
        kind: 'PROVISION_TENANT'
      },
      data: { status: 'FAILED', lastError: message }
    });
    return { ok: false, message };
  }
}
