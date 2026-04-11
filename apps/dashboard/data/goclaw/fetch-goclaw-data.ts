import 'server-only';

import { GoclawHttpError } from '@workspace/goclaw';

import { getGoclawClientForOrganization } from '~/lib/goclaw/get-org-client';

export async function fetchGoclawAgents(organizationId: string, userId: string) {
  const resolved = await getGoclawClientForOrganization(organizationId, userId);
  if (!resolved) {
    return { ok: false as const, error: 'not_connected' as const };
  }
  try {
    const agents = await resolved.client.listAgents();
    return { ok: true as const, data: agents };
  } catch (e) {
    const msg = e instanceof GoclawHttpError ? e.body : 'request_failed';
    return { ok: false as const, error: msg };
  }
}

export async function fetchGoclawProviders(organizationId: string, userId: string) {
  const resolved = await getGoclawClientForOrganization(organizationId, userId);
  if (!resolved) {
    return { ok: false as const, error: 'not_connected' as const };
  }
  try {
    const providers = await resolved.client.listProviders();
    return { ok: true as const, data: providers };
  } catch (e) {
    const msg = e instanceof GoclawHttpError ? e.body : 'request_failed';
    return { ok: false as const, error: msg };
  }
}

export async function fetchGoclawChannels(organizationId: string, userId: string) {
  const resolved = await getGoclawClientForOrganization(organizationId, userId);
  if (!resolved) {
    return { ok: false as const, error: 'not_connected' as const };
  }
  try {
    const channels = await resolved.client.listChannelInstances();
    return { ok: true as const, data: channels };
  } catch (e) {
    const msg = e instanceof GoclawHttpError ? e.body : 'request_failed';
    return { ok: false as const, error: msg };
  }
}

export async function fetchGoclawTeams(organizationId: string, userId: string) {
  const resolved = await getGoclawClientForOrganization(organizationId, userId);
  if (!resolved) {
    return { ok: false as const, error: 'not_connected' as const };
  }
  try {
    const teams = await resolved.client.listTeams();
    return { ok: true as const, data: teams };
  } catch (e) {
    const msg = e instanceof GoclawHttpError ? e.body : 'request_failed';
    return { ok: false as const, error: msg };
  }
}
