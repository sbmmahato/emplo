import 'server-only';

import { prisma } from '@workspace/database/client';

export async function getGoclawTenantRecord(organizationId: string) {
  return prisma.goclawTenant.findFirst({
    where: { organizationId },
    select: {
      status: true,
      goclawTenantId: true,
      apiKeyPrefix: true,
      lastError: true,
      provisionedAt: true
    }
  });
}

export async function getOrganizationAiQuota(organizationId: string) {
  return prisma.organizationAiQuota.findFirst({
    where: { organizationId }
  });
}
