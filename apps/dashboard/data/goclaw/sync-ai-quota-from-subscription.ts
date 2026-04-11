import 'server-only';

import { prisma } from '@workspace/database/client';

/**
 * Maps active subscription products to AI agent quotas (best-effort).
 * Extend when billing product IDs are stable in your Dodo dashboard.
 */
export async function syncOrganizationAiQuotaFromSubscription(
  organizationId: string
): Promise<void> {
  const org = await prisma.organization.findFirst({
    where: { id: organizationId },
    select: {
      subscriptions: {
        where: { active: true },
        select: { items: true }
      }
    }
  });
  if (!org) {
    return;
  }

  let tier = 'free';
  let maxAgents = 5;

  for (const sub of org.subscriptions) {
    for (const item of sub.items) {
      const pid = item.productId?.toLowerCase() ?? '';
      if (pid.includes('enterprise')) {
        tier = 'enterprise';
        maxAgents = 500;
      } else if (pid.includes('lifetime')) {
        tier = 'lifetime';
        maxAgents = 100;
      } else if (pid.includes('pro')) {
        tier = 'pro';
        maxAgents = 25;
      }
    }
  }

  await prisma.organizationAiQuota.upsert({
    where: { organizationId },
    create: {
      organizationId,
      tier,
      maxAgents
    },
    update: {
      tier,
      maxAgents
    }
  });
}
