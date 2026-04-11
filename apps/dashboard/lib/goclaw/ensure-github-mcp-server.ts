import 'server-only';

import type { GoclawClient } from '@workspace/goclaw';
import { prisma } from '@workspace/database/client';

/** Stable MCP server name per org (one server; per-user tokens via user-credentials). */
export const GITHUB_MCP_SERVER_NAME = 'github';

const GITHUB_MCP_IMAGE = 'ghcr.io/github/github-mcp-server';

/**
 * Reads a server id from `GET /v1/mcp/servers` payloads (array or `{ servers: [] }`).
 */
function readGithubServerIdFromList(payload: unknown): string | null {
  const rows = Array.isArray(payload)
    ? payload
    : payload &&
        typeof payload === 'object' &&
        'servers' in payload &&
        Array.isArray((payload as { servers: unknown }).servers)
      ? (payload as { servers: unknown[] }).servers
      : null;
  if (!rows) {
    return null;
  }
  for (const row of rows) {
    if (
      row &&
      typeof row === 'object' &&
      'name' in row &&
      (row as { name: string }).name === GITHUB_MCP_SERVER_NAME &&
      'id' in row &&
      typeof (row as { id: unknown }).id === 'string'
    ) {
      return (row as { id: string }).id;
    }
  }
  return null;
}

/**
 * Reads `id` from `POST /v1/mcp/servers` response.
 */
function readServerIdFromCreate(payload: unknown): string | null {
  if (
    payload &&
    typeof payload === 'object' &&
    'id' in payload &&
    typeof (payload as { id: unknown }).id === 'string'
  ) {
    return (payload as { id: string }).id;
  }
  return null;
}

/**
 * Ensures the org has a GoClaw MCP server for the official GitHub MCP image (Docker stdio).
 * Persists `githubMcpServerId` on `GoclawTenant`.
 *
 * @param organizationId Dashboard organization UUID
 * @param client Tenant-scoped GoClaw client
 */
export async function ensureGithubMcpServer(
  organizationId: string,
  client: GoclawClient
): Promise<string> {
  const tenant = await prisma.goclawTenant.findFirst({
    where: { organizationId, status: 'ACTIVE' },
    select: { githubMcpServerId: true }
  });
  if (tenant?.githubMcpServerId) {
    return tenant.githubMcpServerId;
  }

  const listed = await client.listMcpServers();
  const fromList = readGithubServerIdFromList(listed);
  if (fromList) {
    await prisma.goclawTenant.update({
      where: { organizationId },
      data: { githubMcpServerId: fromList }
    });
    return fromList;
  }

  const createBody: Record<string, unknown> = {
    name: GITHUB_MCP_SERVER_NAME,
    transport: 'stdio',
    command: 'docker',
    args: [
      'run',
      '-i',
      '--rm',
      '-e',
      'GITHUB_PERSONAL_ACCESS_TOKEN',
      GITHUB_MCP_IMAGE
    ],
    require_user_credentials: true,
    tool_prefix: 'github_',
    enabled: true
  };

  const created = await client.createMcpServer(createBody);
  const id = readServerIdFromCreate(created);
  if (!id) {
    throw new Error('GoClaw did not return an MCP server id for GitHub.');
  }

  await prisma.goclawTenant.update({
    where: { organizationId },
    data: { githubMcpServerId: id }
  });
  return id;
}
