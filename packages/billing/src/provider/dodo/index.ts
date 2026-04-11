import 'server-only';

import DodoPayments from 'dodopayments';

import { prisma } from '@workspace/database/client';
import { keys } from '../../../keys';
import { getPrimaryPrice } from '../../helpers';
import { PriceModel, PriceType, type Plan } from '../../schema';
import type {
    BillingProvider,
    Invoice,
    ProviderId,
    Session,
    UpsertCustomer,
    UpsertOrder,
    UpsertSubscription
} from '../types';

type DodoEnv = 'test_mode' | 'live_mode';

class DodoBillingProvider implements BillingProvider {
    public readonly providerId: ProviderId = 'dodo';
    private client: DodoPayments | undefined;

    private getClient(): DodoPayments {
        if (!this.client) {
            const env = keys().DODO_ENVIRONMENT as DodoEnv | undefined;
            const token = keys().DODO_PAYMENTS_API_KEY;
            this.client = new DodoPayments({
                bearerToken: token,
                environment: env ?? 'test_mode'
            });
        }
        return this.client;
    }

    // -------------------------- Session -------------------------- //

    public async createCheckoutSession(params: {
        returnUrl: string;
        organizationId: string;
        plan: Plan;
        customerId?: string;
        customerEmail?: string;
        enableDiscounts?: boolean;
        variantQuantities?: {
            variantId: string;
            quantity: number;
        }[];
        metadata?: Record<string, string>;
    }): Promise<Session> {
        const primaryPrice = getPrimaryPrice(params.plan);

        const product_cart =
            params.plan.prices.map((price) => {
                const variantQty =
                    params.variantQuantities?.find((v) => v.variantId === price.id)?.quantity;
                const quantity =
                    price.model === PriceModel.Metered
                        ? 1
                        : typeof variantQty === 'number' && variantQty > 0
                            ? variantQty
                            : 1;

                return {
                    product_id: price.id,
                    quantity
                };
            }) ?? [];

        const session = await this.getClient().checkoutSessions.create({
            product_cart,
            customer: params.customerEmail
                ? {
                    email: params.customerEmail
                }
                : undefined,
            billing_currency: primaryPrice.currency,
            return_url: params.returnUrl,
            metadata: {
                organizationId: params.organizationId,
                planId: params.plan.id,
                ...(params.metadata ?? {})
            }
        });

        if (!session?.checkout_url) {
            throw new Error('Failed to create Dodo checkout session');
        }

        return {
            id: session.session_id,
            url: session.checkout_url
        };
    }

    public async createBillingPortalSession(params: {
        returnUrl: string;
        customerId: string;
    }): Promise<Session> {
        const portal = await this.getClient().customers.customerPortal.create(
            params.customerId,
            {
                return_url: params.returnUrl
            }
        );

        if (!portal?.url) {
            throw new Error('Failed to create Dodo customer portal session');
        }

        return {
            id: portal.id ?? crypto.randomUUID(),
            url: portal.url
        };
    }

    // -------------------------- Subscription -------------------------- //

    public async getSubscriptions(_params: {
        customerId: string;
    }): Promise<UpsertSubscription[]> {
        // Synchronization endpoint: we conservatively return an empty list.
        // Subscriptions are upserted from webhook events (subscription.active/renewed/cancelled).
        return [];
    }

    public async cancelSubscription(params: {
        subscriptionId: string;
        invoiceNow?: boolean;
    }): Promise<void> {
        // Dodo supports cancel at next billing date
        await this.getClient().subscriptions.update(params.subscriptionId, {
            cancel_at_next_billing_date: true
        });
    }

    public async updateSubscriptionItemQuantity(params: {
        subscriptionId: string;
        subscriptionItemId: string;
        quantity: number;
    }): Promise<void> {
        // We need the addon (variant) identifier for Dodo; look up from our DB by subscriptionItemId
        const item = await prisma.subscriptionItem.findUnique({
            where: { id: params.subscriptionItemId },
            select: { variantId: true }
        });

        if (!item?.variantId) {
            // Nothing to update if we do not know the variant/addon id
            return;
        }

        await this.getClient().subscriptions.update(params.subscriptionId, {
            addons: [
                {
                    addon_id: item.variantId,
                    quantity: params.quantity
                }
            ]
        });
    }

    // -------------------------- Order -------------------------- //

    public async getOrders(params: {
        customerId: string;
    }): Promise<UpsertOrder[]> {
        const orders: UpsertOrder[] = [];

        // Use payments.list to find completed one-time payments for this customer
        for await (const payment of this.getClient().payments.list({
            customer_id: params.customerId,
            status: 'succeeded'
        })) {
            // Retrieve line items for richer order items
            let lineItems: Array<{
                product_id?: string;
                price_id?: string;
                unit_amount?: number;
                quantity?: number;
                item_id?: string;
            }> = [];
            try {
                const resp = await this.getClient().payments.retrieveLineItems(
                    payment.payment_id
                );
                lineItems = resp?.items ?? [];
            } catch {
                // best-effort; proceed without line items
            }

            const orderPayload: UpsertOrder = {
                orderId: payment.payment_id,
                customerId: params.customerId,
                status: 'succeeded',
                provider: this.providerId,
                currency: payment.currency ?? 'USD',
                totalAmount: payment.total_amount ?? 0,
                items: (lineItems ?? []).map((li, idx) => ({
                    orderItemId: li.item_id ?? `${payment.payment_id}_${idx}`,
                    productId: li.product_id ?? '',
                    variantId: li.price_id ?? li.product_id ?? '',
                    priceAmount: typeof li.unit_amount === 'number' ? li.unit_amount : 0,
                    quantity: li.quantity ?? 1,
                    type: PriceType.OneTime,
                    model: PriceModel.Flat
                }))
            };

            orders.push(orderPayload);
        }

        return orders;
    }

    // -------------------------- Meter -------------------------- //

    public async reportMeteredUsage(_params: {
        customerId: string;
        eventName: string;
        quantity: number;
    }): Promise<void> {
        // For Dodo, usage is handled through subscriptions usage/charge endpoints or ingestion blueprints.
        // No-op here; application-level metering can integrate ingestion blueprints separately.
        return;
    }

    public async getMeteredUsage(_params: {
        meterId: string;
        customerId: string;
        startsAt: Date;
        endsAt: Date;
    }): Promise<number> {
        // This starter kit does not compute usage from Dodo; return 0 for display.
        return 0;
    }

    // -------------------------- Customer -------------------------- //

    public async *getCustomers(): AsyncGenerator<UpsertCustomer> {
        for await (const customer of this.getClient().customers.list({
            page_size: 100
        })) {
            // Map Dodo customer to UpsertCustomer payload
            yield {
                customerId: customer.customer_id,
                provider: this.providerId,
                organizationId: (customer as any)?.metadata?.organizationId,
                email: customer.email ?? '',
                line1: (customer as any)?.billing?.street ?? '',
                line2: '',
                city: (customer as any)?.billing?.city ?? '',
                postalCode: (customer as any)?.billing?.zipcode ?? '',
                country: (customer as any)?.billing?.country ?? '',
                state: (customer as any)?.billing?.state ?? ''
            };
        }
    }

    public async createCustomer(params: {
        organizationId: string;
        name: string;
        email: string;
    }): Promise<string> {
        const customer = await this.getClient().customers.create({
            name: params.name,
            email: params.email,
            metadata: {
                organizationId: params.organizationId
            }
        });

        return customer.customer_id;
    }

    public async updateCustomerName(params: {
        customerId: string;
        name: string;
    }): Promise<void> {
        await this.getClient().customers.update(params.customerId, {
            name: params.name
        });
    }

    public async updateCustomerEmail(params: {
        customerId: string;
        email: string;
    }): Promise<void> {
        await this.getClient().customers.update(params.customerId, {
            email: params.email
        });
    }

    public async updateCustomerAddress(params: {
        customerId: string;
        address: {
            line1?: string;
            line2?: string;
            city?: string;
            state?: string;
            postalCode?: string;
            country?: string;
        };
    }): Promise<void> {
        await this.getClient().customers.update(params.customerId, {
            billing: {
                street: params.address.line1,
                city: params.address.city,
                state: params.address.state,
                country: params.address.country,
                zipcode: params.address.postalCode
            }
        });
    }

    public async deleteCustomer(_params: { customerId: string }): Promise<void> {
        // Dodo Customers API currently does not expose a delete endpoint; treat as no-op.
        return;
    }

    // -------------------------- Invoice -------------------------- //

    public async getInvoices(params: { customerId: string }): Promise<Invoice[]> {
        const invoices: Invoice[] = [];

        for await (const p of this.getClient().payments.list({
            customer_id: params.customerId
        })) {
            invoices.push({
                id: p.payment_id,
                number: undefined,
                url: undefined,
                createdAt: p.created_at,
                total: typeof p.total_amount === 'number' ? p.total_amount / 100 : 0,
                currency: p.currency ?? 'USD',
                status: p.status
            });
        }

        return invoices;
    }

    // -------------------------- Webhook -------------------------- //

    public async verifyWebhookSignature(request: Request): Promise<unknown> {
        const rawBody = await request.clone().text();
        const headers = {
            'webhook-id': request.headers.get('webhook-id') || '',
            'webhook-signature': request.headers.get('webhook-signature') || '',
            'webhook-timestamp': request.headers.get('webhook-timestamp') || ''
        };

        const token = keys().DODO_PAYMENTS_API_KEY;
        const webhookKey = keys().DODO_PAYMENTS_WEBHOOK_KEY;
        if (!token || !webhookKey) {
            throw new Error('Missing Dodo Payments API key or webhook key');
        }

        const client = new DodoPayments({
            bearerToken: token,
            webhookKey
        });

        // unwrap will validate signature and return the original payload, or throw
        const event = client.webhooks.unwrap(rawBody, { headers });

        if (!event) {
            throw new Error('Invalid Dodo webhook signature');
        }

        return event;
    }

    public async handleWebhookEvent(
        event: any,
        params: {
            // Subscriptions and One-time payments
            onCheckoutSessionCompleted: (
                data: UpsertSubscription | UpsertOrder
            ) => Promise<unknown>;

            // Subscriptions
            onSubscriptionUpdated: (subscription: UpsertSubscription) => Promise<unknown>;
            onSubscriptionDeleted: (subscriptionId: string) => Promise<unknown>;

            // One-time payments
            onPaymentSucceeded: (sessionId: string) => Promise<unknown>;
            onPaymentFailed: (sessionId: string) => Promise<unknown>;

            // Customer (no-op for Dodo unless wired via custom events)
            onCustomerCreated: (customer: UpsertCustomer) => Promise<unknown>;
            onCustomerUpdated: (customer: UpsertCustomer) => Promise<unknown>;
            onCustomerDeleted: (customerId: string) => Promise<unknown>;
        }
    ) {
        const type: string = event?.type ?? '';
        const data: any = event?.data ?? {};

        switch (type) {
            case 'subscription.active':
            case 'subscription.renewed': {
                const payload = this.buildSubscriptionPayloadFromWebhook(data);
                // Either path upserts a subscription; use onSubscriptionUpdated
                return params.onSubscriptionUpdated(payload);
            }
            case 'subscription.cancelled': {
                const subscriptionId: string =
                    data?.subscription_id ?? data?.id ?? '';
                if (subscriptionId) {
                    return params.onSubscriptionDeleted(subscriptionId);
                }
                return;
            }
            case 'payment.succeeded': {
                const order = await this.buildOrderPayloadFromPaymentWebhook(data);
                // Upsert order on checkout-session-completed analog
                await params.onCheckoutSessionCompleted(order);
                // Also mark succeeded using the payment id
                return params.onPaymentSucceeded(order.orderId);
            }
            case 'payment.failed': {
                const paymentId: string = data?.payment_id ?? data?.id ?? '';
                if (paymentId) {
                    return params.onPaymentFailed(paymentId);
                }
                return;
            }
            default: {
                console.info(`Unhandled Dodo event: ${type}`);
                return;
            }
        }
    }

    // -------------------------- Helpers -------------------------- //

    private buildSubscriptionPayloadFromWebhook(s: any): UpsertSubscription {
        // Best-effort mapping from Dodo subscription webhook payload
        const subscriptionId: string = s?.subscription_id ?? s?.id ?? crypto.randomUUID();
        const customerId: string =
            s?.customer?.customer_id ?? s?.customer_id ?? '';
        const currency: string =
            s?.billing_currency ?? s?.currency ?? 'USD';
        const status: string = s?.status ?? 'active';
        const active = status === 'active';

        const cancelAtPeriodEnd: boolean =
            Boolean(s?.cancel_at_next_billing_date);

        const periodStartsAt: string | undefined =
            s?.current_period_start ??
            s?.start_date ??
            undefined;

        const periodEndsAt: string | undefined =
            s?.current_period_end ??
            s?.next_billing_date ??
            undefined;

        const trialStartsAt: string | undefined = s?.trial_start ?? undefined;
        const trialEndsAt: string | undefined = s?.trial_end ?? undefined;

        // Items: use addons if present; else a single flat item from the product
        const addons: Array<{ addon_id: string; quantity?: number }> = s?.addons ?? [];
        const items =
            addons.length > 0
                ? addons.map((a) => ({
                    subscriptionItemId: a.addon_id,
                    quantity: a.quantity ?? 1,
                    subscriptionId,
                    productId: s?.product_id ?? a.addon_id,
                    variantId: a.addon_id,
                    priceAmount: undefined,
                    interval: s?.payment_frequency_interval ?? 'month',
                    intervalCount: s?.payment_frequency_interval_count ?? 1,
                    type: PriceType.Recurring,
                    model: PriceModel.Flat
                }))
                : [
                    {
                        subscriptionItemId: s?.product_id ?? subscriptionId,
                        quantity: 1,
                        subscriptionId,
                        productId: s?.product_id ?? '',
                        variantId: s?.product_id ?? '',
                        priceAmount: undefined,
                        interval: s?.payment_frequency_interval ?? 'month',
                        intervalCount: s?.payment_frequency_interval_count ?? 1,
                        type: PriceType.Recurring,
                        model: PriceModel.Flat
                    }
                ];

        return {
            subscriptionId,
            organizationId: (s as any)?.metadata?.organizationId,
            customerId,
            active,
            status,
            provider: this.providerId,
            cancelAtPeriodEnd,
            currency,
            periodStartsAt: periodStartsAt ?? new Date().toISOString(),
            periodEndsAt: periodEndsAt ?? new Date().toISOString(),
            trialStartsAt,
            trialEndsAt,
            items
        };
    }

    private async buildOrderPayloadFromPaymentWebhook(s: any): Promise<UpsertOrder> {
        const paymentId: string = s?.payment_id ?? s?.id ?? crypto.randomUUID();
        const customerId: string =
            s?.customer?.customer_id ?? s?.customer_id ?? '';
        const currency: string = s?.currency ?? 'USD';
        const totalAmount: number = s?.total_amount ?? 0;

        // Attempt to fetch richer line items
        let lineItems: Array<{
            product_id?: string;
            price_id?: string;
            unit_amount?: number;
            quantity?: number;
            item_id?: string;
        }> = [];
        try {
            const resp = await this.getClient().payments.retrieveLineItems(paymentId);
            lineItems = resp?.items ?? [];
        } catch {
            // fall through
        }

        return {
            orderId: paymentId,
            customerId,
            provider: this.providerId,
            status: 'succeeded',
            currency,
            totalAmount,
            items: (lineItems ?? []).map((li, idx) => ({
                orderItemId: li.item_id ?? `${paymentId}_${idx}`,
                productId: li.product_id ?? '',
                variantId: li.price_id ?? li.product_id ?? '',
                priceAmount: typeof li.unit_amount === 'number' ? li.unit_amount : 0,
                quantity: li.quantity ?? 1,
                type: PriceType.OneTime,
                model: PriceModel.Flat
            }))
        };
    }
}

export default new DodoBillingProvider();