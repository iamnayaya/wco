import { Router } from 'express';

import { adminRouter } from '../modules/admin/admin.routes.js';
import { analyticsRouter } from '../modules/analytics/analytics.routes.js';
import { aiEngineRouter } from '../modules/ai/ai.routes.js';
import { authRouter } from '../modules/auth/auth.routes.js';
import { oauthRouter } from '../modules/auth/oauth.routes.js';
import { customerSegmentsRouter } from '../modules/customers/customer-segments.routes.js';
import { customerTagsRouter } from '../modules/customers/customer-tags.routes.js';
import { customersRouter } from '../modules/customers/customers.routes.js';
import { deliveriesRouter } from '../modules/logistics/logistics.routes.js';
import { deliveryProvidersRouter } from '../modules/deliveries/delivery-provider.routes.js';
import { deliveryAddressesRouter } from '../modules/deliveries/delivery-address.routes.js';
import { deliveryTrackingRouter } from '../modules/deliveries/delivery-tracking.routes.js';
import { deliveryClaimsRouter } from '../modules/deliveries/delivery-claim.routes.js';
import { deliveryRatesRouter } from '../modules/deliveries/delivery-rate.routes.js';
import { deliveryZonesRouter } from '../modules/deliveries/delivery-zone.routes.js';
import { deliveryWebhookRouter } from '../modules/deliveries/delivery-webhook.routes.js';
import { campaignsRouter } from '../modules/marketing/campaigns.routes.js';
import { aiConfigRouter, aiResponsesRouter } from '../modules/messages/ai.routes.js';
import { messageEscalationsRouter } from '../modules/messages/escalations.routes.js';
import { messagesRouter } from '../modules/messages/messages.routes.js';
import { messageThreadsRouter } from '../modules/messages/threads.routes.js';
import { whatsappWebhookRouter } from '../modules/messages/whatsapp-webhook.routes.js';
import { whatsappRouter } from '../modules/messages/whatsapp.routes.js';
import { conversationsRouter } from '../modules/messaging/conversations.routes.js';
import { ordersRouter } from '../modules/orders/orders.routes.js';
import { paymentsRouter } from '../modules/payments/payments.routes.js';
import { inboundPaymentRouter } from '../modules/payments/payment-webhook.routes.js';
import { paymentMethodsRouter } from '../modules/payments/payment-methods.routes.js';
import { paymentRefundsRouter } from '../modules/payments/payment-refunds.routes.js';
import { subscriptionsRouter } from '../modules/payments/subscriptions.routes.js';
import { subscriptionPlansRouter } from '../modules/payments/subscription-plans.routes.js';
import { pricingRouter } from '../modules/pricing/pricing.routes.js';
import { inventoryRouter } from '../modules/products/inventory.routes.js';
import { productCategoriesRouter } from '../modules/products/product-categories.routes.js';
import { productTagsRouter } from '../modules/products/product-tags.routes.js';
import { productsRouter } from '../modules/products/products.routes.js';
import { storesRouter } from '../modules/stores/stores.routes.js';
import { uploadsRouter } from '../modules/uploads/uploads.routes.js';
import { adminUsersRouter } from '../modules/user-management/admin.user.routes.js';
import { userMeRouter } from '../modules/user-management/user.routes.js';
import { usersRouter } from '../modules/users/users.routes.js';
import { webhooksRouter } from '../modules/webhooks/webhooks.routes.js';

/**
 * API v1 aggregate router.
 *
 * Versioning contract: breaking changes ship under /api/v2; v1 keeps running
 * until sunset (see docs/api/architecture.md#versioning). Each module owns a
 * resource-prefixed subtree and its own middleware chain - this file only
 * composes, it never implements behavior.
 *
 * Mounting map:
 *   /auth          public + session endpoints (stricter per-route limits)
 *   /users         team management (merchant-scoped)
 *   /stores        commerce locations
 *   /products      catalog + stock
 *   /customers     WhatsApp CRM directory
 *   /orders        checkout + state machine
 *   /payments      provider checkout init/verify/refund
 *   /conversations WhatsApp inbox
 *   /campaigns     broadcast marketing
 *   /deliveries    logistics quotes/booking/tracking
 *   /analytics     dashboard reads + event capture
 *   /uploads       S3 media uploads
 *   /webhooks      merchant outbound webhook subscriptions
 *   /pricing       AI price suggestions review/apply
 *   /admin         platform ops (x-admin-key guarded)
 */
export const apiRouter: Router = Router();

// Public Meta webhook - no auth middleware; HMAC-verified inside the router.
apiRouter.use('/webhooks', whatsappWebhookRouter);
// Public payment provider webhooks - no auth; signature-verified per PSP.
apiRouter.use('/webhooks', inboundPaymentRouter);

  apiRouter.use('/auth', authRouter);
  apiRouter.use('/auth', oauthRouter);
// /users/me* must register before the merchant-scoped team router.
apiRouter.use('/users', userMeRouter);
apiRouter.use('/users', usersRouter);
apiRouter.use('/admin/users', adminUsersRouter);
apiRouter.use('/stores', storesRouter);
apiRouter.use('/products', productsRouter);
apiRouter.use('/product-categories', productCategoriesRouter);
apiRouter.use('/product-tags', productTagsRouter);
apiRouter.use('/inventory', inventoryRouter);
apiRouter.use('/customers', customersRouter);
apiRouter.use('/customer-tags', customerTagsRouter);
apiRouter.use('/customer-segments', customerSegmentsRouter);
apiRouter.use('/orders', ordersRouter);
apiRouter.use('/payments', paymentsRouter);
apiRouter.use('/payment-methods', paymentMethodsRouter);
apiRouter.use('/payments/:id/refunds', paymentRefundsRouter);
apiRouter.use('/subscriptions', subscriptionsRouter);
apiRouter.use('/subscription-plans', subscriptionPlansRouter);
apiRouter.use('/conversations', conversationsRouter);
apiRouter.use('/whatsapp', whatsappRouter);
apiRouter.use('/message-threads', messageThreadsRouter);
apiRouter.use('/messages', messagesRouter);
apiRouter.use('/message-escalations', messageEscalationsRouter);
apiRouter.use('/ai-configurations', aiConfigRouter);
apiRouter.use('/ai-responses', aiResponsesRouter);
apiRouter.use('/ai', aiEngineRouter);
apiRouter.use('/campaigns', campaignsRouter);
apiRouter.use('/deliveries', deliveriesRouter);
apiRouter.use('/delivery-providers', deliveryProvidersRouter);
apiRouter.use('/delivery-addresses', deliveryAddressesRouter);
apiRouter.use('/deliveries/:id/tracking', deliveryTrackingRouter);
apiRouter.use('/deliveries/:id/claims', deliveryClaimsRouter);
apiRouter.use('/delivery-rates', deliveryRatesRouter);
apiRouter.use('/delivery-zones', deliveryZonesRouter);
apiRouter.use('/webhooks/delivery', deliveryWebhookRouter);
apiRouter.use('/analytics', analyticsRouter);
apiRouter.use('/uploads', uploadsRouter);
apiRouter.use('/webhooks', webhooksRouter);
apiRouter.use('/pricing', pricingRouter);
apiRouter.use('/admin', adminRouter);
