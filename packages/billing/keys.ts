import { createEnv } from '@t3-oss/env-nextjs';
import { z } from 'zod';

export const keys = () =>
  createEnv({
    client: {
      NEXT_PUBLIC_BILLING_PRICE_PRO_MONTH_ID: z.string().optional(),
      NEXT_PUBLIC_BILLING_PRICE_PRO_YEAR_ID: z.string().optional(),
      NEXT_PUBLIC_BILLING_PRICE_LIFETIME_ID: z.string().optional(),
      NEXT_PUBLIC_BILLING_PRICE_ENTERPRISE_MONTH_ID: z.string().optional(),
      NEXT_PUBLIC_BILLING_PRICE_ENTERPRISE_YEAR_ID: z.string().optional()
    },
    server: {
      DODO_PAYMENTS_API_KEY: z.string().optional(),
      DODO_PAYMENTS_WEBHOOK_KEY: z.string().optional(),
      DODO_ENVIRONMENT: z.enum(['test_mode', 'live_mode']).optional()
    },
    runtimeEnv: {
      NEXT_PUBLIC_BILLING_PRICE_PRO_MONTH_ID:
        process.env.NEXT_PUBLIC_BILLING_PRICE_PRO_MONTH_ID,
      NEXT_PUBLIC_BILLING_PRICE_PRO_YEAR_ID:
        process.env.NEXT_PUBLIC_BILLING_PRICE_PRO_YEAR_ID,
      NEXT_PUBLIC_BILLING_PRICE_LIFETIME_ID:
        process.env.NEXT_PUBLIC_BILLING_PRICE_LIFETIME_ID,
      NEXT_PUBLIC_BILLING_PRICE_ENTERPRISE_MONTH_ID:
        process.env.NEXT_PUBLIC_BILLING_PRICE_ENTERPRISE_MONTH_ID,
      NEXT_PUBLIC_BILLING_PRICE_ENTERPRISE_YEAR_ID:
        process.env.NEXT_PUBLIC_BILLING_PRICE_ENTERPRISE_YEAR_ID,
      DODO_PAYMENTS_API_KEY: process.env.DODO_PAYMENTS_API_KEY,
      DODO_PAYMENTS_WEBHOOK_KEY: process.env.DODO_PAYMENTS_WEBHOOK_KEY,
      DODO_ENVIRONMENT: process.env.DODO_ENVIRONMENT
    }
  });
