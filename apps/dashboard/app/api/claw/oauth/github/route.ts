import { NextResponse } from 'next/server';

import { Role } from '@prisma/client';
import type { Prisma } from '@prisma/client';

import { dedupedAuth } from '@workspace/auth';
import { checkSession } from '@workspace/auth/session';
import { getRedirectToSignIn } from '@workspace/auth/redirect';
import { keys as goclawKeys } from '@workspace/goclaw/keys';
import { prisma } from '@workspace/database/client';

import { getOAuthPublicOrigin } from '~/lib/goclaw/oauth-public-origin';

const GITHUB_OAUTH_SCOPES = ['repo', 'read:org', 'workflow'].join(' ');

/**
 * Starts GitHub OAuth for GoClaw GitHub MCP (per-user token).
 * Query: organizationId (uuid), optional agentIds (comma-separated GoClaw agent UUIDs), optional redirectPath.
 */
export async function GET(request: Request): Promise<Response> {
  const session = await dedupedAuth();
  if (!checkSession(session)) {
    return NextResponse.redirect(new URL(getRedirectToSignIn(), request.url));
  }

  const { searchParams } = new URL(request.url);
  const organizationId = searchParams.get('organizationId');
  if (!organizationId) {
    return NextResponse.json({ error: 'organizationId is required' }, { status: 400 });
  }

  const membership = await prisma.membership.findFirst({
    where: { organizationId, userId: session.user.id },
    select: { role: true }
  });
  if (!membership || membership.role !== Role.ADMIN) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const env = goclawKeys();
  if (!env.GOCLAW_OAUTH_GITHUB_CLIENT_ID) {
    return NextResponse.json(
      { error: 'GitHub OAuth is not configured.' },
      { status: 501 }
    );
  }

  const rawAgentIds = searchParams.get('agentIds') ?? '';
  const agentIds = rawAgentIds
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const state = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
  const metadata: Prisma.InputJsonValue = { agentIds };

  await prisma.goclawOAuthState.create({
    data: {
      state,
      organizationId,
      provider: 'GITHUB',
      goclawAgentId: null,
      metadata,
      redirectPath: searchParams.get('redirectPath') ?? '',
      expiresAt
    }
  });

  const publicOrigin = getOAuthPublicOrigin(request.url);
  const callback = new URL('/api/goclaw/oauth/github/callback', `${publicOrigin}/`);
  const authorize = new URL('https://github.com/login/oauth/authorize');
  authorize.searchParams.set('client_id', env.GOCLAW_OAUTH_GITHUB_CLIENT_ID);
  authorize.searchParams.set('redirect_uri', callback.toString());
  authorize.searchParams.set('scope', GITHUB_OAUTH_SCOPES);
  authorize.searchParams.set('state', state);
  authorize.searchParams.set('allow_signup', 'false');

  return NextResponse.redirect(authorize);
}
