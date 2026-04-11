import { NextResponse } from 'next/server';

import { Role } from '@prisma/client';

import { dedupedAuth } from '@workspace/auth';
import { checkSession } from '@workspace/auth/session';
import { GoclawHttpError } from '@workspace/goclaw';
import { keys as goclawKeys } from '@workspace/goclaw/keys';
import { prisma } from '@workspace/database/client';

import { getGoclawClientForOrganization } from '~/lib/goclaw/get-org-client';
import {
  ensureGithubMcpServer,
  GITHUB_MCP_SERVER_NAME
} from '~/lib/goclaw/ensure-github-mcp-server';
import { getOAuthPublicOrigin } from '~/lib/goclaw/oauth-public-origin';

type GitHubTokenResponse = {
  access_token?: string;
  token_type?: string;
  scope?: string;
  error?: string;
  error_description?: string;
};

function parseAgentIdsFromMetadata(metadata: unknown): string[] {
  if (!metadata || typeof metadata !== 'object') {
    return [];
  }
  const raw = (metadata as { agentIds?: unknown }).agentIds;
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.filter((x): x is string => typeof x === 'string' && x.length > 0);
}

function parseGoclawErrorMessage(body: string): string {
  try {
    const j = JSON.parse(body) as { error?: string; message?: string };
    return j.message ?? j.error ?? body;
  } catch {
    return body.slice(0, 200);
  }
}

/**
 * GitHub OAuth callback: stores user token as GoClaw MCP user-credentials and grants agents.
 */
export async function GET(request: Request): Promise<Response> {
  const session = await dedupedAuth();
  const publicOrigin = getOAuthPublicOrigin(request.url);
  const base = new URL('/', `${publicOrigin}/`);

  if (!checkSession(session)) {
    return NextResponse.redirect(
      new URL(`/?goclaw_oauth=error&message=${encodeURIComponent('sign_in_required')}`, base)
    );
  }

  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const err = searchParams.get('error');

  if (err || !code || !state) {
    return NextResponse.redirect(
      new URL(`/?goclaw_oauth=error&message=${encodeURIComponent(err ?? 'missing')}`, base)
    );
  }

  const row = await prisma.goclawOAuthState.findFirst({
    where: { state, provider: 'GITHUB' },
    select: {
      organizationId: true,
      redirectPath: true,
      expiresAt: true,
      metadata: true
    }
  });
  if (!row || row.expiresAt < new Date()) {
    return NextResponse.redirect(
      new URL('/?goclaw_oauth=error&message=invalid_state', base)
    );
  }

  await prisma.goclawOAuthState.deleteMany({ where: { state } });

  const membership = await prisma.membership.findFirst({
    where: { organizationId: row.organizationId, userId: session.user.id },
    select: { role: true }
  });
  if (!membership || membership.role !== Role.ADMIN) {
    return NextResponse.redirect(
      new URL('/?goclaw_oauth=error&message=forbidden', base)
    );
  }

  const env = goclawKeys();
  if (!env.GOCLAW_OAUTH_GITHUB_CLIENT_ID || !env.GOCLAW_OAUTH_GITHUB_CLIENT_SECRET) {
    return NextResponse.redirect(
      new URL('/?goclaw_oauth=error&message=not_configured', base)
    );
  }

  const callbackUrl = new URL(
    '/api/goclaw/oauth/github/callback',
    `${publicOrigin}/`
  );
  const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      client_id: env.GOCLAW_OAUTH_GITHUB_CLIENT_ID,
      client_secret: env.GOCLAW_OAUTH_GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: callbackUrl.toString()
    })
  });
  const tokenJson = (await tokenRes.json()) as GitHubTokenResponse;
  const accessToken = tokenJson.access_token;
  if (!accessToken) {
    const msg =
      tokenJson.error_description ??
      tokenJson.error ??
      'token_exchange_failed';
    return NextResponse.redirect(
      new URL(
        `/?goclaw_oauth=error&message=${encodeURIComponent(msg)}`,
        base
      )
    );
  }

  const gc = await getGoclawClientForOrganization(
    row.organizationId,
    session.user.id
  );
  if (!gc) {
    return NextResponse.redirect(
      new URL('/?goclaw_oauth=error&message=no_goclaw_tenant', base)
    );
  }

  let serverId: string;
  try {
    serverId = await ensureGithubMcpServer(row.organizationId, gc.client);
  } catch (e) {
    const detail =
      e instanceof GoclawHttpError
        ? parseGoclawErrorMessage(e.body)
        : e instanceof Error
          ? e.message
          : 'mcp_server_ensure_failed';
    return NextResponse.redirect(
      new URL(
        `/?goclaw_oauth=error&message=${encodeURIComponent(detail)}`,
        base
      )
    );
  }

  try {
    await gc.client.putMcpUserCredentials(serverId, {
      credentials: {
        GITHUB_PERSONAL_ACCESS_TOKEN: accessToken
      }
    });
  } catch (e) {
    if (e instanceof GoclawHttpError) {
      try {
        await gc.client.putMcpUserCredentials(serverId, {
          env: { GITHUB_PERSONAL_ACCESS_TOKEN: accessToken }
        });
      } catch {
        const detail = parseGoclawErrorMessage(e.body);
        return NextResponse.redirect(
          new URL(
            `/?goclaw_oauth=error&message=${encodeURIComponent(detail)}`,
            base
          )
        );
      }
    } else {
      throw e;
    }
  }

  const agentIds = parseAgentIdsFromMetadata(row.metadata);
  for (const agentId of agentIds) {
    try {
      await gc.client.postMcpServerAgentGrant(serverId, { agent_id: agentId });
    } catch (first) {
      try {
        await gc.client.createMcpGrant({
          agent_id: agentId,
          server_id: serverId
        });
      } catch {
        const detail =
          first instanceof GoclawHttpError
            ? parseGoclawErrorMessage(first.body)
            : 'mcp_grant_failed';
        return NextResponse.redirect(
          new URL(
            `/?goclaw_oauth=error&message=${encodeURIComponent(`${GITHUB_MCP_SERVER_NAME}:${detail}`)}`,
            base
          )
        );
      }
    }
  }

  const org = await prisma.organization.findFirst({
    where: { id: row.organizationId },
    select: { slug: true }
  });
  const slug = org?.slug ?? '';
  const path =
    row.redirectPath && row.redirectPath.length > 0
      ? row.redirectPath
      : `/organizations/${slug}/ai/channels`;
  return NextResponse.redirect(new URL(path, base));
}
