import 'server-only';

import { keys as goclawKeys } from '@workspace/goclaw/keys';

/**
 * Public origin for OAuth redirect_uri and post-login redirects.
 * When unset, uses the incoming request (fine when the app is only opened via one URL).
 * Set `GOCLAW_OAUTH_PUBLIC_BASE_URL` to your ngrok/https tunnel when the dashboard is
 * opened at localhost but Slack/Discord must redirect to a public URL.
 */
export function getOAuthPublicOrigin(requestUrl: string): string {
  const k = goclawKeys();
  const explicit = k.GOCLAW_OAUTH_PUBLIC_BASE_URL?.trim();
  if (explicit) {
    return new URL(explicit).origin;
  }
  return new URL(requestUrl).origin;
}
