import 'server-only';

import { prisma } from '@workspace/database/client';

import { getGoclawClientForOrganization } from './get-org-client';

/**
 * Enforces OrganizationAiQuota.maxAgents against the GoClaw agent list length.
 */
export async function assertAgentQuotaAllowsCreate(
  organizationId: string,
  userId: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const quota = await prisma.organizationAiQuota.findFirst({
    where: { organizationId }
  });
  const maxAgents = quota?.maxAgents ?? 5;

  const resolved = await getGoclawClientForOrganization(organizationId, userId);
  if (!resolved) {
    return { ok: false, message: 'GoClaw is not connected for this organization.' };
  }

  const list = await resolved.client.listAgents();
  const count = Array.isArray(list)
    ? list.length
    : typeof list === 'object' &&
        list !== null &&
        'items' in list &&
        Array.isArray((list as { items: unknown }).items)
      ? (list as { items: unknown[] }).items.length
      : 0;

  if (count >= maxAgents) {
    return {
      ok: false,
      message: `Agent limit reached (${maxAgents}). Upgrade your plan or raise the limit.`
    };
  }

  return { ok: true };
}
