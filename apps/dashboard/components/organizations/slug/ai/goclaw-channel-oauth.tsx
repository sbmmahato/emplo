'use client';

import * as React from 'react';

import { Button } from '@workspace/ui/components/button';
import { Input } from '@workspace/ui/components/input';
import { Label } from '@workspace/ui/components/label';

export type GoclawChannelOauthProps = {
  organizationId: string;
};

/**
 * Starts Slack / Discord / GitHub OAuth against dashboard API routes (configure client IDs in env).
 */
export function GoclawChannelOauth({
  organizationId
}: GoclawChannelOauthProps): React.JSX.Element {
  const [agentId, setAgentId] = React.useState('');
  const [githubAgentIds, setGithubAgentIds] = React.useState('');

  const slackHref =
    typeof window !== 'undefined' && agentId
      ? `/api/goclaw/oauth/slack?organizationId=${encodeURIComponent(organizationId)}&agentId=${encodeURIComponent(agentId)}`
      : '#';

  const discordHref =
    typeof window !== 'undefined' && agentId
      ? `/api/goclaw/oauth/discord?organizationId=${encodeURIComponent(organizationId)}&agentId=${encodeURIComponent(agentId)}`
      : '#';

  const githubHref =
    typeof window !== 'undefined'
      ? `/api/goclaw/oauth/github?organizationId=${encodeURIComponent(organizationId)}${githubAgentIds.trim() ? `&agentIds=${encodeURIComponent(githubAgentIds.trim())}` : ''}`
      : '#';

  return (
    <div className="grid max-w-lg gap-3">
      <div className="grid gap-1">
        <Label htmlFor="oauth_agent">GoClaw agent ID (UUID)</Label>
        <Input
          id="oauth_agent"
          value={agentId}
          onChange={(e) => setAgentId(e.target.value)}
          placeholder="from Agents JSON response"
        />
      </div>
      <div className="grid gap-1">
        <Label htmlFor="oauth_github_agents">
          GitHub MCP — agent IDs (optional, comma-separated)
        </Label>
        <Input
          id="oauth_github_agents"
          value={githubAgentIds}
          onChange={(e) => setGithubAgentIds(e.target.value)}
          placeholder="uuid, uuid, … — leave empty to connect token only"
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="secondary" asChild disabled={!agentId}>
          <a href={slackHref}>Connect Slack</a>
        </Button>
        <Button type="button" variant="secondary" asChild disabled={!agentId}>
          <a href={discordHref}>Connect Discord</a>
        </Button>
        <Button type="button" variant="secondary" asChild>
          <a href={githubHref}>Connect GitHub (MCP)</a>
        </Button>
      </div>
      <p className="text-muted-foreground text-xs">
        Slack: set `GOCLAW_OAUTH_SLACK_APP_TOKEN` (Socket Mode app token, xapp-…), OAuth
        client ID/secret, redirect URLs, and enable Socket Mode + bot events in the Slack
        app. In channels, @mention the bot unless you change `require_mention` in GoClaw
        channel config. GitHub: registers the official GitHub MCP server in GoClaw (Docker)
        and stores your token for API tools — not the same as `git push`; see infra docs.
      </p>
    </div>
  );
}
