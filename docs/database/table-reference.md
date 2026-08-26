# WCO Table Reference

Column-level dictionary for all 31 tables. Generated DDL is authoritative:
`packages/database/prisma/migrations/20260201000000_init_full_schema/migration.sql`.

Legend: 🔑 PK · 🔗 FK · **bold** = NOT NULL · `italic` = default shown.

---

## Identity & Tenancy

### merchants — tenant root
| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| id 🔑 | TEXT (cuid) | | client-gen | |
| companyName | TEXT | | | |
| email | TEXT | | | UNIQUE — login identity |
| phone | TEXT | ✓ | | E.164 recommended |
| country | TEXT | | `'NG'` | ISO-3166 alpha-2 |
| plan | PlanTier enum | | `FREE` | Denormalized tier for fast gating |
| planExpiresAt | TIMESTAMP(3) | ✓ | | |
| settings | JSONB | | `{}` | Feature prefs, brand color… |
| createdAt / updatedAt | TIMESTAMP(3) | | now / trigger | |

### users — seller/staff accounts
| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| id 🔑 | TEXT | | | |
| merchantId 🔗 | → merchants | | | CASCADE |
| email | TEXT | | | UNIQUE(merchantId,email) |
| fullName | TEXT | | | |
| passwordHash | TEXT | ✓ | | argon2id; NULL ⇒ SSO-only |
| role | UserRole enum | | `OWNER` | OWNER>ADMIN>AGENT>VIEWER |
| isActive | BOOLEAN | | true | Deactivate instead of delete |
| settings | JSONB | | `{}` | Notification channels, UI prefs |
| lastLoginAt | TIMESTAMP(3) | ✓ | | |

### refresh_tokens
id · userId🔗(CASCADE) · **tokenHash** UNIQUE (SHA-256 of opaque token) ·
**expiresAt** · revokedAt? · ip? · userAgent? · **createdAt**
Indexes: userId, expiresAt (nightly sweeper).

### api_tokens — machine-to-machine public API credentials
id · merchantId🔗(CASCADE) · **name** · **prefix** · **tokenHash** UNIQUE ·
lastUsedAt? · expiresAt? · revokedAt? · **createdAt**

## Billing

### subscription_plans — immutable-ish catalog
| Column | Type | Notes |
|---|---|---|
| id 🔑 | TEXT | |
| code | TEXT UNIQUE | FREE·STARTER·GROWTH·SCALE |
| name / description | TEXT / TEXT? | |
| priceMonthly / priceYearly | DECIMAL(10,2) | CHECK ≥ 0; price changes = new row |
| currency | Currency enum | default NGN |
| trialDays | INT | CHECK 0..90 |
| limits | JSONB | `{ordersPerMonth, aiCredits, stores, users, products}` |
| features | TEXT[] | Marketing bullets surfaced in pricing UI |
| isActive / sortOrder | BOOL / INT | |

### subscriptions — one live per merchant (partial unique index)
| Column | Type | Null | Notes |
|---|---|---|---|
| id 🔑 | TEXT | | |
| merchantId 🔗 | → merchants CASCADE | | |
| planId 🔗 | → subscription_plans RESTRICT | | Historical price fidelity |
| status | SubscriptionStatus | | TRIALING→ACTIVE→PAST_DUE→PAUSED/CANCELLED/EXPIRED |
| billingCycle | BillingCycle | | MONTHLY/YEARLY |
| amount | DECIMAL(10,2) | | Locked-in charge amount |
| currentPeriodStart/End | TIMESTAMP(3) | | CHECK end > start |
| trialEndsAt | TIMESTAMP(3)? | | Trial reminder cron scans this |
| cancelAtPeriodEnd / cancelledAt | BOOL / TS? | | Stripe-style cancellation |
| providerReference | TEXT? | | PSP subscription code |

### payment_methods — seller payout destinations (PII)
| Column | Type | Notes |
|---|---|---|
| id 🔑 / merchantId 🔗(CASCADE) | TEXT | UNIQUE(merchantId, accountNumberHash) |
| type | PaymentMethodType | BANK_ACCOUNT·MOBILE_MONEY·USSD·CARD |
| providerName | TEXT | "GTBank", "OPay", "M-Pesa" |
| accountName | TEXT | |
| accountNumberEnc | TEXT | AES-256-GCM ciphertext — plaintext never stored |
| accountNumberLast4 | TEXT | CHECK `^[0-9]{4}$`; display only |
| accountNumberHash | TEXT | HMAC-SHA256 — dedupe/search without decryption |
| bankCode | TEXT? | NIBSS/momo network code |
| isDefault | BOOLEAN | |
| verificationStatus | PayoutVerificationStatus | PENDING→VERIFIED/FAILED |

## Catalog

### stores — primary tenant scope
id · merchantId🔗(CASCADE) · **name** · description? · **slug** UNIQUE ·
whatsappNumber? UNIQUE (CHECK E.164) · whatsappNameId? (Meta phone_number_id) ·
**currency** Currency=`NGN` · **timezone**=`Africa/Lagos` · address? city?
**country**=`NG` · **status** StoreStatus=`ACTIVE` · **settings** JSONB · timestamps.
Every business table below carries `storeId` FK → stores (CASCADE).

### categories
id · storeId🔗 · **name** · sortOrder=0 — UNIQUE(storeId,name).

### products
| Column | Type | Null | Notes |
|---|---|---|---|
| id 🔑 / storeId 🔗 / categoryId 🔗? (SET NULL) | TEXT | | |
| sku | TEXT | | UNIQUE(storeId,sku) |
| name / description | TEXT / TEXT? | | |
| price | DECIMAL(14,2) | | CHECK ≥0 |
| compareAtPrice | DECIMAL(14,2)? | | CHECK ≥ price (strike-through display) |
| costPrice | DECIMAL(14,2)? | | Margin analytics; never exposed to customers |
| stockQuantity / lowStockThreshold | INT | | CHECK ≥0; mirrors SUM(variants) |
| trackStock | BOOLEAN | true | false ⇒ digital/unlimited items |
| images | TEXT[] | `{}` | S3/R2 keys or CDN URLs |
| status | ProductStatus | ACTIVE | ACTIVE·DRAFT·OUT_OF_STOCK·ARCHIVED |
| attributes | JSONB | `{}` | Fashion fields, IMEI, expiry… fed to AI answers |
| deletedAt | TIMESTAMP(3)? | | Soft delete (audit history matters) |

### product_variants
id · productId🔗(CASCADE) · **sku** UNIQUE(productId,sku) · **name** ("Red · XL") ·
price? NULL⇒inherit parent · costPrice? · stockQuantity=0 · lowStockThreshold=5 ·
trackStock=true · attributes JSONB · imageUrl? · status ProductStatus · deletedAt?.

## Commerce

### customers
| Column | Type | Null | Notes |
|---|---|---|---|
| id 🔑 / storeId 🔗(CASCADE) | TEXT | | UNIQUE(storeId,waPhone) |
| waPhone | TEXT | | CHECK E.164 — WhatsApp identity |
| name / email / notes | TEXT? | | |
| tags | TEXT[] | `{}` | Manual + automation-applied labels |
| segment | TEXT? | | VIP·REPEAT·NEW·CHURN_RISK (nightly job) |
| sentiment | Sentiment? | | Latest AI sentiment |
| totalSpent / ordersCount | DECIMAL(14,2) / INT | 0/0 | CHECK ≥0; refreshed by segmentation |
| lastOrderAt / lastSeenAt | TS? | | |
| marketingOptIn | BOOLEAN | false | NDPR consent flag — campaigns filter on it |

### orders
| Column | Type | Notes |
|---|---|---|
| id 🔑 / storeId🔗 / customerId🔗(RESTRICT) | TEXT | |
| orderNumber | TEXT UNIQUE | Human ref `WC-XXXXXX` |
| status | OrderStatus | PENDING_PAYMENT→PAID→PROCESSING→SHIPPED→DELIVERED; CANCELLED/REFUNDED terminal |
| channel | OrderChannel | WHATSAPP·DASHBOARD·PAYMENT_LINK |
| subtotal / discount / deliveryFee / total | DECIMAL(14,2) | CHECK total=subtotal−discount+deliveryFee; all ≥0 |
| currency | Currency | NGN |
| paymentReference | TEXT? | PSP ref mirror for support lookups |
| deliveryAddress / deliveryCity / notes | TEXT? | |
| paidAt / shippedAt / deliveredAt / cancelledAt | TS? | Status-transition stamps |
| cancellationReason | TEXT? | |

### order_items
id · orderId🔗(CASCADE) · productId🔗(**RESTRICT**) · variantId🔗?(SET NULL) ·
**productName** snapshot · variantName? · sku? snapshot · quantity CHECK>0 ·
unitPrice CHECK≥0 · note?. Snapshots guarantee historical accuracy.

### payments
id · storeId🔗(CASCADE) · orderId🔗?(UNIQUE, SET NULL) · provider PaymentProvider ·
**providerReference** UNIQUE (webhook dedupe) · amount CHECK≥0 · fee=0 · currency ·
status PaymentStatus=`INITIALIZED` · checkoutUrl? · failureReason? · meta JSONB ·
initializedAt=now() · paidAt? · refundedAt?.

## Logistics

### delivery_providers — platform-global registry
id · **code** UNIQUE (GIG·KWIK·SENDY…) · **name** · countries TEXT[] · cities TEXT[]
(empty=nationwide) · baseFee ≥0 · perKmFee ≥0 · avgEtaMinutes? ·
credentialsEncrypted BYTEA? (AES-256-GCM app-layer envelope) · webhookSecretHash? ·
isActive=true · meta JSONB.

### deliveries — fulfilment record, 1:1 order
id · storeId🔗(CASCADE) · orderId🔗(RESTRICT, UNIQUE) · deliveryProviderId🔗?(SET NULL) ·
carrier LogisticsCarrier=`MANUAL` (snapshot of provider.code) · trackingCode? (indexed) ·
status DeliveryStatus=`QUOTED`: QUOTED→BOOKED→PICKED_UP→IN_TRANSIT→DELIVERED;
FAILED/CANCELLED terminal · pickupAddress? dropoffAddress? recipientName?
recipientPhone? · fee? CHECK≥0 · etaMinutes? CHECK>0 · quotedAt? bookedAt?
pickedUpAt? deliveredAt? failedAt? · failureReason? · proofUrl? (POD S3 key) · meta.

## Messaging

### conversations ≡ message_threads view
id · storeId🔗(CASCADE) · customerId🔗(RESTRICT) · UNIQUE(storeId,customerId) ·
**waPhone** denormalized hot-path identity · status ConversationStatus=`BOT`
(BOT→HANDLED→CLOSED) · botEnabled=true · assignedUserId🔗users?(SET NULL) ·
unreadCount=0 CHECK≥0 · lastMessageAt=now() · lastMessagePreview?.
Exposed additionally as read-only view `message_threads`.

### messages — hottest table (prod: monthly partitions)
id · conversationId🔗(CASCADE) · direction MessageDirection · type MessageType=`TEXT` ·
body? mediaUrl? templateName? · waMessageId? UNIQUE (provider dedupe) ·
status MessageStatus=`QUEUED` · sentByBot=false · errorReason? · **createdAt**.
No updatedAt — immutable log.

## Growth

### automation_rules
id · storeId🔗(CASCADE) · trigger AutomationTrigger · conditions JSONB ·
**messageBody** · delayMinutes=0 CHECK≥0 · isEnabled=true · priority=0.
Index (storeId,trigger,isEnabled) serves the rule engine hot path.

### campaigns
id · storeId🔗(CASCADE) · type CampaignType · **name** · audienceFilter JSONB ·
**messageBody** · scheduledFor? startedAt? completedAt? · status CampaignStatus=`DRAFT` ·
statsSent/statsDelivered/statsReplied =0 CHECK≥0 · createdAt.

### campaign_messages — junction w/ state
id · campaignId🔗(CASCADE) · customerId🔗(RESTRICT) · status TEXT=`queued`
(queued|sent|delivered|replied|failed) · messageId? · errorReason? · sentAt?.

## AI

### ai_configurations — one per store (storeId UNIQUE)
isEnabled=true · tone AiTone=`FRIENDLY` · languages TEXT[]=`{en,pcm}` ·
businessContext TEXT? (seller FAQ/policies → prompts) · autoReplyEnabled=true ·
workingHours JSONB · outOfOfficeBody? · escalationKeywords TEXT[] ·
primaryModel=`claude-3-haiku-20240307` · fallbackModel=`gpt-4o-mini` ·
temperature DECIMAL(3,2)=0.7 CHECK 0..1 · maxTokens=512 CHECK>0 ·
dailyTokenBudget=200000 CHECK>0 (COGS guardrail enforced via Redis counters) ·
semanticCacheEnabled=true.

### ai_responses — templates; storeId NULL ⇒ platform system template
id · storeId🔗?(CASCADE) · category AiTemplateCategory=`CUSTOM` · **templateName** ·
UNIQUE(storeId,templateName) (NULL rows exempt by SQL semantics) · **body** ({{mustache}}) ·
variables TEXT[] · language=`en` · isActive=true · priority=0 · usageCount=0.
Index (category,language,isActive).

### price_suggestions
id · storeId🔗(CASCADE) · productId🔗(CASCADE) · currentPrice/suggestedPrice CHECK≥0 ·
confidence DECIMAL(3,2) CHECK 0..1 · reason · factors JSONB · status TEXT=`PENDING`
(PENDING|APPROVED|DISMISSED|EXPIRED) · expiresAt? appliedAt?.

### demand_forecasts — UNIQUE(productId, forecastDate)
id · storeId · productId🔗(CASCADE) · forecastDate DATE grain · predictedDemand ≥0 ·
actualDemand? ≥0 · confidence CHECK 0..1 · modelVersion.

## Platform

### analytics_events — append-only (prod: partitions/hypertable)
id BIGSERIAL🔑 · storeId🔗(CASCADE) · customerId? sessionId? · **type** dotted event ·
props JSONB · occurredAt=now(). Indexes: (storeId,type,occurredAt), occurredAt.
Retention 13 months → S3 Parquet.

### daily_store_metrics — UNIQUE(storeId,date)
revenue DECIMAL(16,2) · ordersCount/newCustomers/messagesCount ≥0 ·
aiResolutionRate/conversionRate CHECK 0..1 · avgResponseSeconds DECIMAL(8,1).
Rollup target of the 02:00 WAT cron + realtime upserts.

### outbox_events — transactional outbox (ADR-002)
aggregateType · aggregateId · eventType · payload JSONB CHECK typeof=object ·
processedAt?. Index (processedAt,createdAt). App role: INSERT+SELECT only.
Sweeper deletes processed rows >30d.

### webhook_subscriptions — merchant outgoing webhooks
id · storeId🔗(CASCADE) · url CHECK `^https://` · secret (HMAC key) · events TEXT[]
(empty=all) · isActive=true. Delivery retries exponential backoff.

### audit_logs — immutable trail
id · storeId🔗?(SET NULL) · actorUserId? actorIp? · action (`auth.login`,
`product.update`, `payout.request`…) · resource · resourceId? · before JSONB? after JSONB? ·
createdAt. App role INSERT+SELECT only. Prod: monthly partitions.

---

## Enum catalog (25)

UserRole · PlanTier · StoreStatus · ProductStatus · Currency · OrderStatus ·
OrderChannel · PaymentProvider · PaymentStatus · LogisticsCarrier ·
DeliveryStatus · MessageDirection · MessageType · MessageStatus ·
ConversationStatus · CampaignType · CampaignStatus · AutomationTrigger ·
Sentiment · PaymentMethodType · PayoutVerificationStatus · SubscriptionStatus ·
BillingCycle · AiTone · AiTemplateCategory — values enumerated in migration SQL.
