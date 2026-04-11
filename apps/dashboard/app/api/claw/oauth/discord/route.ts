import { NextResponse } from 'next/server';

import { Role } from '@prisma/client';

import { dedupedAuth } from '@workspace/auth';
import { checkSession } from '@workspace/auth/session';
import { getRedirectToSignIn } from '@workspace/auth/redirect';
import { keys as goclawKeys } from '@workspace/goclaw/keys';
import { prisma } from '@workspace/database/client';

import { getOAuthPublicOrigin } from '~/lib/goclaw/oauth-public-origin';

/**
 * Starts Discord OAuth. Query: organizationId, agentId (GoClaw agent uuid).
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
  if (!env.GOCLAW_OAUTH_DISCORD_CLIENT_ID) {
    return NextResponse.json(
      { error: 'Discord OAuth is not configured.' },
      { status: 501 }
    );
  }

  const state = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
  await prisma.goclawOAuthState.create({
    data: {
      state,
      organizationId,
      provider: 'DISCORD',
      goclawAgentId: agentId,
      redirectPath: searchParams.get('redirectPath') ?? '',
      expiresAt
    }
  });

  const publicOrigin = getOAuthPublicOrigin(request.url);
  const callback = new URL(
    '/api/goclaw/oauth/discord/callback',
    `${publicOrigin}/`
  );
  const authorize = new URL('https://discord.com/api/oauth2/authorize');
  authorize.searchParams.set('client_id', env.GOCLAW_OAUTH_DISCORD_CLIENT_ID);
  authorize.searchParams.set('redirect_uri', callback.toString());
  authorize.searchParams.set('response_type', 'code');
  authorize.searchParams.set('scope', 'bot applications.commands');
  authorize.searchParams.set('state', state);

  return NextResponse.redirect(authorize);
}
