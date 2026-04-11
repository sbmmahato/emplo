import { createEnv } from '@t3-oss/env-nextjs';
import { z } from 'zod';

/**
 * Control-plane env for GoClaw gateway integration (server-only).
 */
export const keys = () =>
  createEnv({
    server: {
      GOCLAW_BASE_URL: z.url().optional(),
      GOCLAW_GATEWAY_TOKEN: z.string().min(1).optional(),
      GOCLAW_TENANT_KEY_SECRET: z.string().min(32).optional(),
      GOCLAW_OAUTH_SLACK_CLIENT_ID: z.string().optional(),
      GOCLAW_OAUTH_SLACK_CLIENT_SECRET: z.string().optional(),
      /**
       * Slack App-Level token (xapp-...) for Socket Mode. Same for all installs of your Slack app;
       * not returned by OAuth — create under Slack app → Socket Mode.
       */
      GOCLAW_OAUTH_SLACK_APP_TOKEN: z.string().optional(),
      GOCLAW_OAUTH_DISCORD_CLIENT_ID: z.string().optional(),
      GOCLAW_OAUTH_DISCORD_CLIENT_SECRET: z.string().optional(),
      GOCLAW_OAUTH_GITHUB_CLIENT_ID: z.string().optional(),
      GOCLAW_OAUTH_GITHUB_CLIENT_SECRET: z.string().optional(),
      /** Public base URL for Slack/Discord OAuth redirect_uri (e.g. https://abc.ngrok-free.app). No trailing slash. */
      GOCLAW_OAUTH_PUBLIC_BASE_URL: z.url().optional()
    },
    runtimeEnv: {
      GOCLAW_BASE_URL: process.env.GOCLAW_BASE_URL,
      GOCLAW_GATEWAY_TOKEN: process.env.GOCLAW_GATEWAY_TOKEN,
      GOCLAW_TENANT_KEY_SECRET: process.env.GOCLAW_TENANT_KEY_SECRET,
      GOCLAW_OAUTH_SLACK_CLIENT_ID: process.env.GOCLAW_OAUTH_SLACK_CLIENT_ID,
      GOCLAW_OAUTH_SLACK_CLIENT_SECRET: process.env.GOCLAW_OAUTH_SLACK_CLIENT_SECRET,
      GOCLAW_OAUTH_SLACK_APP_TOKEN: process.env.GOCLAW_OAUTH_SLACK_APP_TOKEN,
      GOCLAW_OAUTH_DISCORD_CLIENT_ID: process.env.GOCLAW_OAUTH_DISCORD_CLIENT_ID,
      GOCLAW_OAUTH_DISCORD_CLIENT_SECRET:
        process.env.GOCLAW_OAUTH_DISCORD_CLIENT_SECRET,
      GOCLAW_OAUTH_GITHUB_CLIENT_ID: process.env.GOCLAW_OAUTH_GITHUB_CLIENT_ID,
      GOCLAW_OAUTH_GITHUB_CLIENT_SECRET:
        process.env.GOCLAW_OAUTH_GITHUB_CLIENT_SECRET,
      GOCLAW_OAUTH_PUBLIC_BASE_URL: process.env.GOCLAW_OAUTH_PUBLIC_BASE_URL
    }
  });
