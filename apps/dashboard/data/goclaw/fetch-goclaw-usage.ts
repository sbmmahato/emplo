import 'server-only';

import { GoclawHttpError } from '@workspace/goclaw';

import { getGoclawClientForOrganization } from '~/lib/goclaw/get-org-client';

export async function fetchGoclawUsageAndEdition(
  organizationId: string,
  userId: string
) {
  const resolved = await getGoclawClientForOrganization(organizationId, userId);
  if (!resolved) {
    return { ok: false as const, error: 'not_connected' as const };
  }
  try {
    const [usage, edition] = await Promise.all([
      resolved.client.getUsageBreakdown(''),
      resolved.client.getEdition()
    ]);
    return { ok: true as const, usage, edition };
  } catch (e) {
    const msg = e instanceof GoclawHttpError ? e.body : 'request_failed';
    return { ok: false as const, error: msg };
  }
}
