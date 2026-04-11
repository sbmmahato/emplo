import { NextResponse } from 'next/server';

import { GoclawHttpError } from '@workspace/goclaw';
import { keys as goclawKeys } from '@workspace/goclaw/keys';
import { prisma } from '@workspace/database/client';

import { getGoclawClientForOrganization } from '~/lib/goclaw/get-org-client';
import { getOAuthPublicOrigin } from '~/lib/goclaw/oauth-public-origin';
import {
  extractSlackBotTokenFromOauthV2Access,
  verifySlackBotToken,
  type SlackOauthV2AccessResponse
} from '~/lib/goclaw/slack-oauth-tokens';

/**
 * Slack OAuth callback: exchanges code and registers a channel instance in GoClaw.
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
    where: { state, provider: 'SLACK' },
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
    !env.GOCLAW_OAUTH_SLACK_CLIENT_ID ||
    !env.GOCLAW_OAUTH_SLACK_CLIENT_SECRET
  ) {
    return NextResponse.redirect(
      new URL('/?goclaw_oauth=error&message=not_configured', base)
    );
  }

  const callbackUrl = new URL(
    '/api/goclaw/oauth/slack/callback',
    `${publicOrigin}/`
  );
  const tokenRes = await fetch('https://slack.com/api/oauth.v2.access', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.GOCLAW_OAUTH_SLACK_CLIENT_ID,
      client_secret: env.GOCLAW_OAUTH_SLACK_CLIENT_SECRET,
      code,
      redirect_uri: callbackUrl.toString()
    })
  });
  const tokenJson = (await tokenRes.json()) as SlackOauthV2AccessResponse;
  if (!tokenJson.ok) {
    return NextResponse.redirect(
      new URL(
        `/?goclaw_oauth=error&message=${encodeURIComponent(tokenJson.error ?? 'token_exchange')}`,
        base
      )
    );
  }

  const botToken = extractSlackBotTokenFromOauthV2Access(tokenJson);
  if (!botToken) {
    return NextResponse.redirect(
      new URL(
        '/?goclaw_oauth=error&message=' +
          encodeURIComponent(
            'slack_oauth_no_bot_token:Check_app_requests_bot_scopes_and_disable_user-only_install'
          ),
        base
      )
    );
  }

  const authCheck = await verifySlackBotToken(botToken);
  if (!authCheck.ok) {
    return NextResponse.redirect(
      new URL(
        `/?goclaw_oauth=error&message=${encodeURIComponent(
          `slack_bot_token_auth_test_failed:${authCheck.error}`
        )}`,
        base
      )
    );
  }

  const slackAppToken = env.GOCLAW_OAUTH_SLACK_APP_TOKEN?.trim();
  if (!slackAppToken) {
    return NextResponse.redirect(
      new URL(
        '/?goclaw_oauth=error&message=' +
          encodeURIComponent(
            'slack_socket_app_token_missing:Set_GOCLAW_OAUTH_SLACK_APP_TOKEN'
          ),
        base
      )
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

  // GoClaw `channels.slack` uses `bot_token` + `app_token` (see plan/go-claw-full-docs/channels/slack.md).
  const instanceName = `slack-oauth-${row.organizationId}`;

  // Policies live under `config` (jsonb); there is no `group_policy` column on `channel_instances`.
  const channelBody = {
    channel_type: 'slack',
    agent_id: agentId,
    credentials: {
      bot_token: botToken,
      app_token: slackAppToken,
      token: botToken
    },
    enabled: true,
    config: {
      dm_policy: 'open',
      group_policy: 'open',
      require_mention: true
    }
  };

  try {
    const existingId = await findSlackDashboardInstanceId(
      gc.client,
      instanceName
    );
    if (existingId) {
      await gc.client.updateChannelInstance(existingId, channelBody);
    } else {
      await gc.client.createChannelInstance({
        name: instanceName,
        ...channelBody
      });
    }
  } catch (e) {
    const detail =
      e instanceof GoclawHttpError
        ? parseGoclawErrorMessage(e.body)
        : 'channel_create_failed';
    return NextResponse.redirect(
      new URL(
        `/?goclaw_oauth=error&message=${encodeURIComponent(detail)}`,
        base
      )
    );
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

type ChannelInstanceRow = {
  id: string;
  name?: string;
  channel_type?: string;
};

type ListChannelInstancesResponse = {
  instances?: ChannelInstanceRow[];
};

/**
 * Resolves an existing channel instance id to update on Slack reconnect.
 * GoClaw enforces unique (tenant_id, name); POST would fail with 23505 otherwise.
 */
async function findSlackDashboardInstanceId(
  client: {
    listChannelInstances: () => Promise<unknown>;
  },
  stableName: string
): Promise<string | undefined> {
  const raw = (await client.listChannelInstances()) as ListChannelInstancesResponse;
  const instances = raw.instances ?? [];
  const byStable = instances.find((i) => i.name === stableName);
  if (byStable) {
    return byStable.id;
  }
  const legacy = instances.filter(
    (i) => i.channel_type === 'slack' && i.name === 'slack-oauth'
  );
  if (legacy.length === 1) {
    return legacy[0].id;
  }
  return undefined;
}

/**
 * Best-effort extract of a short error string from GoClaw JSON error bodies.
 */
function parseGoclawErrorMessage(body: string): string {
  try {
    const j = JSON.parse(body) as {
      error?: { message?: string; code?: string };
    };
    const m = j.error?.message;
    if (typeof m === 'string' && m.length > 0) {
      return m.length > 400 ? `${m.slice(0, 400)}…` : m;
    }
  } catch {
    /* ignore */
  }
  return body.length > 400 ? `${body.slice(0, 400)}…` : body;
}
