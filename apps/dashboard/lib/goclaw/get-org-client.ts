import 'server-only';

import { createGoclawClient } from '@workspace/goclaw';
import { keys as goclawKeys } from '@workspace/goclaw/keys';
import { prisma } from '@workspace/database/client';

import { decryptTenantApiKey } from './tenant-crypto';

export type ResolvedGoclawClient = {
  client: ReturnType<typeof createGoclawClient>;
  tenant: { id: string; goclawTenantId: string };
};

/**
 * Returns a GoClaw HTTP client scoped to the organization tenant and dashboard user.
 */
export async function getGoclawClientForOrganization(
  organizationId: string,
  userId: string
): Promise<ResolvedGoclawClient | null> {
  const env = goclawKeys();
  if (!env.GOCLAW_BASE_URL || !env.GOCLAW_TENANT_KEY_SECRET) {
    return null;
  }

  const row = await prisma.goclawTenant.findFirst({
    where: {
      organizationId,
      status: 'ACTIVE'
    },
    select: {
      id: true,
      goclawTenantId: true,
      encryptedApiKey: true
    }
  });
  if (!row) {
    return null;
  }

  const apiKey = decryptTenantApiKey(
    row.encryptedApiKey,
    env.GOCLAW_TENANT_KEY_SECRET
  );
  const client = createGoclawClient({
    baseUrl: env.GOCLAW_BASE_URL,
    bearerToken: apiKey,
    userId
  });

  return {
    client,
    tenant: { id: row.id, goclawTenantId: row.goclawTenantId }
  };
}
