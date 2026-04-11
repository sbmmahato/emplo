// Temporary ambient type declarations for the Dodo Payments Node SDK.
// Replace with real types once the package is installed in the workspace.
//
// Context7 references:
// - https://context7.com/dodopayments/dodopayments-node/llms.txt
// - https://github.com/dodopayments/dodopayments-node/blob/main/api.md

declare module 'dodopayments' {
    export type DodoEnvironment = 'test_mode' | 'live_mode';

    export type RequestOptions = {
        maxRetries?: number;
        timeout?: number;
    };

    export default class DodoPayments {
        constructor(options: {
            bearerToken: string | undefined;
            environment?: DodoEnvironment;
            webhookKey?: string;
            baseURL?: string;
            timeout?: number;
            maxRetries?: number;
            logLevel?: 'debug' | 'info' | 'warn' | 'error';
        });

        checkoutSessions: {
            create(params: any, options?: RequestOptions): Promise<{
                session_id: string;
                checkout_url: string;
            }>;
        };

        customers: {
            create(params: any, options?: RequestOptions): Promise<{
                customer_id: string;
                email?: string;
                name?: string;
                billing?: {
                    street?: string;
                    city?: string;
                    state?: string;
                    country?: string;
                    zipcode?: string;
                };
                metadata?: Record<string, string>;
            }>;
            update(
                customerId: string,
                params: any,
                options?: RequestOptions
            ): Promise<any>;
            retrieve(customerId: string, options?: RequestOptions): Promise<any>;
            list(
                params?: any,
                options?: RequestOptions
            ): AsyncIterable<{
                customer_id: string;
                email?: string;
                name?: string;
                billing?: {
                    street?: string;
                    city?: string;
                    state?: string;
                    country?: string;
                    zipcode?: string;
                };
                metadata?: Record<string, string>;
                created_at?: string;
            }>;
            customerPortal: {
                create(
                    customerId: string,
                    params: { return_url: string },
                    options?: RequestOptions
                ): Promise<{ id?: string; url: string }>;
            };
        };

        subscriptions: {
            create(params: any, options?: RequestOptions): Promise<any>;
            update(
                subscriptionId: string,
                params: any,
                options?: RequestOptions
            ): Promise<any>;
            changePlan(
                subscriptionId: string,
                params: any,
                options?: RequestOptions
            ): Promise<void>;
            charge(
                subscriptionId: string,
                params: any,
                options?: RequestOptions
            ): Promise<any>;
            list(
                params?: any,
                options?: RequestOptions
            ): AsyncIterable<any>;
            retrieveUsageHistory(
                subscriptionId: string,
                params?: any,
                options?: RequestOptions
            ): Promise<any>;
        };

        payments: {
            create(params: any, options?: RequestOptions): Promise<any>;
            retrieve(paymentId: string, options?: RequestOptions): Promise<any>;
            list(
                params?: any,
                options?: RequestOptions
            ): AsyncIterable<{
                payment_id: string;
                status?: string;
                total_amount?: number;
                currency?: string;
                customer_id?: string;
                created_at?: string;
            }>;
            retrieveLineItems(
                paymentId: string,
                options?: RequestOptions
            ): Promise<{
                items: Array<{
                    item_id?: string;
                    product_id?: string;
                    price_id?: string;
                    unit_amount?: number;
                    quantity?: number;
                }>
            }>;
        };

        webhooks: {
            unwrap(
                rawBody: string,
                options: { headers: Record<string, string> }
            ): any;
        };
    }

    export namespace DodoPayments {
        export class APIError extends Error {
            status?: number;
            headers?: Record<string, string>;
        }
        export class APIConnectionError extends APIError { }
        export class APIConnectionTimeoutError extends APIError { }
        export class AuthenticationError extends APIError { }
        export class BadRequestError extends APIError { }
        export class NotFoundError extends APIError { }
        export class RateLimitError extends APIError { }
        export class InternalServerError extends APIError { }
    }
}