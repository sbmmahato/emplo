import { NextResponse } from 'next/server';

import { dedupedAuth } from '@workspace/auth';
import { checkSession } from '@workspace/auth/session';
import { keys as goclawKeys } from '@workspace/goclaw/keys';
import { prisma } from '@workspace/database/client';

import { getRedirectToSignIn } from '@workspace/auth/redirect';
import { Role } from '@prisma/client';

import { getOAuthPublicOrigin } from '~/lib/goclaw/oauth-public-origin';

/**
 * Starts Slack OAuth. Query: organizationId (uuid), agentId (GoClaw agent uuid).
 */
export async function GET(request: Request): Promise<Response> {
  const session = await dedupedAuth();
  if (!checkSession(session)) {
    return NextResponse.redirect(new URL(getRedirectToSignIn(), request.url));
  }

  const { searchParams } = new URL(request.url);
  const organizationId = searchParams.get('organizationId');
  const agentId = searchParams.get('agentId');
  if (!organizationId || !agentId) {
    return NextResponse.json(
      { error: 'organizationId and agentId are required' },
      { status: 400 }
    );
  }

  const membership = await prisma.membership.findFirst({
    where: { organizationId, userId: session.user.id },
    select: { role: true }
  });
  if (!membership || membership.role !== Role.ADMIN) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const env = goclawKeys();
  if (!env.GOCLAW_OAUTH_SLACK_CLIENT_ID) {
    return NextResponse.json(
      { error: 'Slack OAuth is not configured.' },
      { status: 501 }
    );
  }

  const state = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
  await prisma.goclawOAuthState.create({
    data: {
      state,
      organizationId,
      provider: 'SLACK',
      goclawAgentId: agentId,
      redirectPath: searchParams.get('redirectPath') ?? '',
      expiresAt
    }
  });

  const publicOrigin = getOAuthPublicOrigin(request.url);
  const callback = new URL('/api/goclaw/oauth/slack/callback', `${publicOrigin}/`);
  const authorize = new URL('https://slack.com/oauth/v2/authorize');
  authorize.searchParams.set('client_id', env.GOCLAW_OAUTH_SLACK_CLIENT_ID);
  // Match GoClaw Slack docs: history + mentions for channels/DMs; Socket Mode uses app token from env.
  authorize.searchParams.set(
    'scope',
    [
      'app_mentions:read',
      'channels:history',
      'chat:write',
      'groups:history',
      'im:history',
      'im:read',
      'im:write',
      'mpim:history',
      'users:read'
    ].join(',')
  );
  authorize.searchParams.set('redirect_uri', callback.toString());
  authorize.searchParams.set('state', state);

  return NextResponse.redirect(authorize);
}
