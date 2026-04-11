import 'server-only';

/**
 * Parsed Slack `oauth.v2.access` JSON (subset).
 * @see https://api.slack.com/methods/oauth.v2.access
 */
export type SlackOauthV2AccessResponse = {
  ok?: boolean;
  access_token?: string;
  token_type?: string;
  bot_user_id?: string;
  error?: string;
  authed_user?: {
    access_token?: string;
    token_type?: string;
  };
  bot?: {
    bot_access_token?: string;
  };
  refresh_token?: string;
  expires_in?: number;
};

/**
 * Returns the bot token to use for Web API calls (posting, etc.).
 * Never uses `authed_user.access_token` (user / xoxp- scope).
 */
export function extractSlackBotTokenFromOauthV2Access(
  json: SlackOauthV2AccessResponse
): string | null {
  const nested = json.bot?.bot_access_token?.trim();
  if (nested?.startsWith('xoxb-')) {
    return nested;
  }

  const top = json.access_token?.trim();
  if (!top) {
    return null;
  }

  // Granular bot install: top-level token is the bot token (xoxb- or rotated xoxe.* form when token_type is bot).
  if (json.token_type === 'bot') {
    return top;
  }

  if (top.startsWith('xoxb-')) {
    return top;
  }

  // Rotating bot tokens (org apps); still bot scope — not xoxp-.
  if (top.startsWith('xoxe.') && json.token_type === 'bot') {
    return top;
  }

  return null;
}

/**
 * Verifies the token works for Slack Web API (same check as manual auth.test).
 */
export async function verifySlackBotToken(
  botToken: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = await fetch('https://slack.com/api/auth.test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ token: botToken })
  });
  const data = (await res.json()) as { ok?: boolean; error?: string };
  if (data.ok) {
    return { ok: true };
  }
  return { ok: false, error: data.error ?? 'unknown' };
}
