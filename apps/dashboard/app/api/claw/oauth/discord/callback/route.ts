import { NextResponse } from 'next/server';

import { keys as goclawKeys } from '@workspace/goclaw/keys';
import { prisma } from '@workspace/database/client';

import { getGoclawClientForOrganization } from '~/lib/goclaw/get-org-client';
import { getOAuthPublicOrigin } from '~/lib/goclaw/oauth-public-origin';

/**
 * Discord OAuth callback: exchanges code and registers a channel instance in GoClaw.
 */
export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const err = searchParams.get('error');

  const publicOrigin = getOAuthPublicOrigin(request.url);
  const base = new URL('/', `${publicOrigin}/`);

  if (err || !code || !state) {
    return NextResponse.redirect(
      new URL(`/?goclaw_oauth=error&message=${encodeURIComponent(err ?? 'missing')}`, base)
    );
  }

  const row = await prisma.goclawOAuthState.findFirst({
    where: { state, provider: 'DISCORD' },
    select: {
      organizationId: true,
      redirectPath: true,
      expiresAt: true,
      goclawAgentId: true
    }
  });
  if (!row || row.expiresAt < new Date()) {
    return NextResponse.redirect(
      new URL('/?goclaw_oauth=error&message=invalid_state', base)
    );
  }

  await prisma.goclawOAuthState.deleteMany({ where: { state } });

  const env = goclawKeys();
  if (
    !env.GOCLAW_OAUTH_DISCORD_CLIENT_ID ||
    !env.GOCLAW_OAUTH_DISCORD_CLIENT_SECRET
  ) {
    return NextResponse.redirect(
      new URL('/?goclaw_oauth=error&message=not_configured', base)
    );
  }

  const callbackUrl = new URL(
    '/api/goclaw/oauth/discord/callback',
    `${publicOrigin}/`
  );
  const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.GOCLAW_OAUTH_DISCORD_CLIENT_ID,
      client_secret: env.GOCLAW_OAUTH_DISCORD_CLIENT_SECRET,
      grant_type: 'authorization_code',
      code,
      redirect_uri: callbackUrl.toString()
    })
  });
  const tokenJson = (await tokenRes.json()) as {
    access_token?: string;
  };
  if (!tokenJson.access_token) {
    return NextResponse.redirect(
      new URL('/?goclaw_oauth=error&message=token_exchange', base)
    );
  }

  const owner = await prisma.membership.findFirst({
    where: { organizationId: row.organizationId, isOwner: true },
    select: { userId: true }
  });
  const userId = owner?.userId;
  if (!userId) {
    return NextResponse.redirect(
      new URL('/?goclaw_oauth=error&message=no_owner', base)
    );
  }

  const gc = await getGoclawClientForOrganization(row.organizationId, userId);
  if (!gc) {
    return NextResponse.redirect(
      new URL('/?goclaw_oauth=error&message=no_goclaw_tenant', base)
    );
  }

  const agentId = row.goclawAgentId;
  if (!agentId) {
    return NextResponse.redirect(
      new URL('/?goclaw_oauth=error&message=missing_agent', base)
    );
  }

  await gc.client.createChannelInstance({
    name: 'discord-oauth',
    channel_type: 'discord',
    agent_id: agentId,
    credentials: { token: tokenJson.access_token },
    enabled: true,
    metadata: { source: 'dashboard_oauth' }
  });

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
