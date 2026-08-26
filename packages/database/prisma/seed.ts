/* eslint-disable no-console */
/**
 * WCO development/test seed.
 *
 * Idempotent: every write is an upsert keyed on natural keys, so `db:reset`
 * and repeated `db:seed` runs converge to the same state.
 *
 * Coverage:
 *   Subscription plans (4) · delivery providers (3) · system AI templates (8)
 *   Demo merchant + owner/agent users · store + AI configuration
 *   Categories · products (+ variants) · customers
 *   Message thread with bot/human history · orders (paid + pending)
 *   Payment · delivery w/ tracking · payment method · subscription
 *   Automation rules · campaign · webhook subscription · daily metrics
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  // ---------------------------------------------------------------------------
  // Platform reference data
  // ---------------------------------------------------------------------------
  const planList = await Promise.all(
    (
      [
        {
          code: 'FREE',
          name: 'Free',
          description: 'Get started — 50 orders/mo, basic AI replies.',
          priceMonthly: 0,
          priceYearly: 0,
          trialDays: 0,
          sortOrder: 0,
          limits: { ordersPerMonth: 50, aiCredits: 200, stores: 1, users: 1, products: 20 },
          features: ['AI auto-reply (limited)', 'Order tracking', 'Payment links'],
        },
        {
          code: 'STARTER',
          name: 'Starter',
          description: 'For side hustles finding their feet.',
          priceMonthly: 5000,
          priceYearly: 51000,
          trialDays: 14,
          sortOrder: 1,
          limits: { ordersPerMonth: 500, aiCredits: 2500, stores: 2, users: 2, products: 150 },
          features: ['Full AI auto-reply', 'Abandoned cart recovery', 'Delivery quotes'],
        },
        {
          code: 'GROWTH',
          name: 'Growth',
          description: 'For sellers scaling past WhatsApp chaos.',
          priceMonthly: 15000,
          priceYearly: 153000,
          trialDays: 14,
          sortOrder: 2,
          limits: { ordersPerMonth: 5000, aiCredits: 25000, stores: 5, users: 10, products: 2000 },
          features: ['Everything in Starter', 'Campaigns & segments', 'Demand forecasting', 'Price suggestions'],
        },
        {
          code: 'SCALE',
          name: 'Scale',
          description: 'Multi-store operations with priority AI.',
          priceMonthly: 45000,
          priceYearly: 459000,
          trialDays: 14,
          sortOrder: 3,
          limits: { ordersPerMonth: 100000, aiCredits: 250000, stores: 50, users: 100, products: 100000 },
          features: ['Everything in Growth', 'Priority AI lane', 'Dedicated support', 'Custom webhooks'],
        },
      ] as const
    ).map((p) =>
      prisma.subscriptionPlan.upsert({
        where: { code: p.code },
        update: { name: p.name, priceMonthly: p.priceMonthly, priceYearly: p.priceYearly, isActive: true },
        create: { ...p },
      }),
    ),
  );
  const plans = Object.fromEntries(planList.map((p) => [p.code, p])) as Record<
    'FREE' | 'STARTER' | 'GROWTH' | 'SCALE',
    (typeof planList)[number]
  >;

  const providers = await Promise.all(
    (
      [
        { code: 'GIG', name: 'GIG Logistics', baseFee: 2500, perKmFee: 65, avgEtaMinutes: 240, cities: [] },
        { code: 'KWIK', name: 'Kwik Delivery', baseFee: 1900, perKmFee: 80, avgEtaMinutes: 120, cities: ['Lagos', 'Ibadan'] },
        { code: 'SENDY', name: 'Sendy', baseFee: 1700, perKmFee: 75, avgEtaMinutes: 95, cities: ['Lagos', 'Nairobi'] },
      ] as const
    ).map((p) =>
      prisma.deliveryProvider.upsert({
        where: { code: p.code },
        update: { isActive: true },
        create: { ...p, countries: ['NG'], meta: { integration: `${p.code.toLowerCase()}.v1` } },
      }),
    ),
  );
  const providerByCode = Object.fromEntries(providers.map((p) => [p.code, p])) as Record<
    'GIG' | 'KWIK' | 'SENDY',
    (typeof providers)[number]
  >;

  // System templates: storeId is NULL, and Prisma cannot upsert on a compound
  // unique containing NULL — find-then-write keeps this idempotent.
  for (const t of [
    { category: 'GREETING' as const, templateName: 'greeting-first-contact', language: 'en', body: "Hi {{customerName}}! 👋 Welcome to {{storeName}}. I'm the shop assistant — ask me about any product or say MENU to browse." },
    { category: 'PRICE_INQUIRY' as const, templateName: 'price-quote-simple', language: 'en', body: '{{productName}} is {{price}}. Want me to reserve one for you?' },
    { category: 'PRICE_INQUIRY' as const, templateName: 'price-quote-pidgin', language: 'pcm', body: '{{productName}} na {{price}}. I go keep am for you?' },
    { category: 'ORDER_CONFIRMATION' as const, templateName: 'order-confirmed', language: 'en', body: '✅ Order {{orderNumber}} confirmed! Total: {{total}}. Pay here: {{paymentLink}} — delivery follows immediately after.' },
    { category: 'SHIPPING_INFO' as const, templateName: 'shipping-tracking', language: 'en', body: 'Your order {{orderNumber}} is on the way 🚚 Track it live: {{trackingUrl}}' },
    { category: 'PAYMENT_REMINDER' as const, templateName: 'payment-nudge', language: 'en', body: 'Quick reminder: order {{orderNumber}} ({{total}}) is awaiting payment. Link: {{paymentLink}}' },
    { category: 'ABANDONED_CART' as const, templateName: 'cart-rescue', language: 'en', body: 'Hi {{customerName}} 👋 You left {{itemCount}} item(s): {{itemNames}}. Should I reserve them for you?' },
    { category: 'ESCALATION' as const, templateName: 'escalation-human-handoff', language: 'en', body: 'Let me get a human on this right away — {{ownerName}} will reply in a moment. 🙏' },
  ]) {
    const existing = await prisma.aiResponseTemplate.findFirst({
      where: { storeId: null, templateName: t.templateName },
      select: { id: true },
    });
    if (existing) {
      await prisma.aiResponseTemplate.update({ where: { id: existing.id }, data: { body: t.body } });
    } else {
      await prisma.aiResponseTemplate.create({ data: { ...t, storeId: null, variables: [], priority: 10 } });
    }
  }

  // ---------------------------------------------------------------------------
  // Demo tenant: merchant → users → store → AI config
  // ---------------------------------------------------------------------------
  const passwordHash = await bcrypt.hash('Demo1234!', 12);

  const merchant = await prisma.merchant.upsert({
    where: { email: 'demo@wco.app' },
    update: {},
    create: {
      companyName: 'Mama Nkechi Ventures',
      email: 'demo@wco.app',
      phone: '+2348012345678',
      country: 'NG',
      plan: 'GROWTH',
    },
  });

  const owner = await prisma.user.upsert({
    where: { merchantId_email: { merchantId: merchant.id, email: 'demo@wco.app' } },
    update: {},
    create: {
      merchantId: merchant.id,
      email: 'demo@wco.app',
      fullName: 'Nkechi Okafor',
      passwordHash,
      role: 'OWNER',
    },
  });

  await prisma.user.upsert({
    where: { merchantId_email: { merchantId: merchant.id, email: 'agent@wco.app' } },
    update: {},
    create: {
      merchantId: merchant.id,
      email: 'agent@wco.app',
      fullName: 'Chidi Agent',
      passwordHash,
      role: 'AGENT',
    },
  });

  await prisma.apiToken.upsert({
    where: { tokenHash: 'seed-demo-token-hash-not-real' },
    update: {},
    create: {
      merchantId: merchant.id,
      name: 'Dev sandbox token',
      prefix: 'wco_test_seed',
      tokenHash: 'seed-demo-token-hash-not-real',
    },
  });

  const store = await prisma.store.upsert({
    where: { slug: 'mama-nkechi-lagos' },
    update: {},
    create: {
      merchantId: merchant.id,
      name: 'Mama Nkechi Provisions — Lagos',
      slug: 'mama-nkechi-lagos',
      description: 'Groceries, provisions & household items. Delivery within Lagos.',
      whatsappNumber: '+2348012345678',
      whatsappNameId: 'seed-meta-phone-id',
      currency: 'NGN',
      city: 'Lagos',
      address: '12 Balogun Market, Lagos Island',
    },
  });

  await prisma.aiConfiguration.upsert({
    where: { storeId: store.id },
    update: {},
    create: {
      storeId: store.id,
      isEnabled: true,
      tone: 'FRIENDLY',
      businessContext:
        'Family-run provisions shop in Balogun Market since 1998. Prices negotiable for bulk (5+ bags). We deliver same-day within Lagos mainland, next-day for island. No refunds after 24h; exchanges only with receipt photo.',
      workingHours: { start: '08:00', end: '20:00', days: [1, 2, 3, 4, 5, 6] },
      outOfOfficeBody: 'Shop don close 😴 We dey back by 8am — send your message, I go reply first thing.',
      escalationKeywords: ['refund', 'complain', 'police', 'scam', 'lawyer'],
    },
  });

  // Payout account (ciphertext fields are placeholder envelopes in dev only).
  await prisma.paymentMethod.upsert({
    where: {
      merchantId_accountNumberHash: { merchantId: merchant.id, accountNumberHash: 'seed-hmac-0123456789' },
    },
    update: {},
    create: {
      merchantId: merchant.id,
      type: 'BANK_ACCOUNT',
      providerName: 'GTBank',
      accountName: 'Mama Nkechi Ventures Ltd',
      accountNumberEnc: 'dev-only:not-a-real-ciphertext',
      accountNumberLast4: '4021',
      accountNumberHash: 'seed-hmac-0123456789',
      bankCode: '058',
      isDefault: true,
      verificationStatus: 'VERIFIED',
      verifiedAt: new Date(),
    },
  });

  await prisma.subscription.upsert({
    where: { id: `seed-sub-${merchant.id}` },
    update: {},
    create: {
      id: `seed-sub-${merchant.id}`,
      merchantId: merchant.id,
      planId: plans.GROWTH!.id,
      status: 'ACTIVE',
      billingCycle: 'MONTHLY',
      amount: plans.GROWTH!.priceMonthly,
      currentPeriodStart: new Date(Date.now() - 10 * 864e5),
      currentPeriodEnd: new Date(Date.now() + 20 * 864e5),
      providerReference: 'sub_seed_demo_001',
    },
  });

  // ---------------------------------------------------------------------------
  // Catalog
  // ---------------------------------------------------------------------------
  const categories = await Promise.all(
    ['Groceries', 'Household', 'Beverages'].map((name, i) =>
      prisma.category.upsert({
        where: { storeId_name: { storeId: store.id, name } },
        update: {},
        create: { storeId: store.id, name, sortOrder: i },
      }),
    ),
  );

  type VariantSeed = { sku: string; name: string; price?: number; stockQuantity: number };
  type ProductSeed = {
    sku: string;
    name: string;
    price: number;
    costPrice: number;
    stockQuantity: number;
    categoryIdx: number;
    variants?: VariantSeed[];
  };

  const productSeeds: ProductSeed[] = [
    {
      sku: 'RICE-50KG', name: 'Local Rice 50kg bag', price: 62000, costPrice: 54000, stockQuantity: 24, categoryIdx: 0,
      variants: [
        { sku: 'RICE-25KG', name: '25kg half bag', price: 33000, stockQuantity: 30 },
        { sku: 'RICE-50KG', name: '50kg full bag', price: 62000, stockQuantity: 24 },
      ],
    },
    { sku: 'OIL-5L', name: 'Groundnut Oil 5L', price: 12500, costPrice: 9800, stockQuantity: 40, categoryIdx: 0 },
    { sku: 'BEANS-10KG', name: 'Honey Beans 10kg', price: 18500, costPrice: 15000, stockQuantity: 15, categoryIdx: 0 },
    { sku: 'SUGAR-1KG', name: 'Granulated Sugar 1kg', price: 2100, costPrice: 1650, stockQuantity: 120, categoryIdx: 0 },
    { sku: 'TOMATO-TIN', name: 'Tomato Paste (tin)', price: 450, costPrice: 320, stockQuantity: 300, categoryIdx: 0 },
    {
      sku: 'DETERGENT', name: 'Washing Detergent', price: 3500, costPrice: 2600, stockQuantity: 85, categoryIdx: 1,
      variants: [
        { sku: 'DET-900G', name: '900g pouch', price: 3500, stockQuantity: 60 },
        { sku: 'DET-3KG', name: '3kg bucket', price: 9800, stockQuantity: 25 },
      ],
    },
    { sku: 'MALT-24', name: 'Malt Drink (crate of 24)', price: 7200, costPrice: 6000, stockQuantity: 18, categoryIdx: 2 },
  ];

  const products = [];
  for (const p of productSeeds) {
    const product = await prisma.product.upsert({
      where: { storeId_sku: { storeId: store.id, sku: p.sku } },
      update: { status: 'ACTIVE' },
      create: {
        storeId: store.id,
        categoryId: categories[p.categoryIdx]!.id,
        sku: p.sku,
        name: p.name,
        price: p.price,
        costPrice: p.costPrice,
        stockQuantity: p.stockQuantity,
        lowStockThreshold: 10,
        images: [`https://cdn.wco.test/${p.sku.toLowerCase()}.webp`],
        attributes: { source: 'seed' },
      },
    });
    for (const v of p.variants ?? []) {
      await prisma.productVariant.upsert({
        where: { productId_sku: { productId: product.id, sku: v.sku } },
        update: { price: v.price ?? null, stockQuantity: v.stockQuantity },
        create: {
          productId: product.id,
          sku: v.sku,
          name: v.name,
          price: v.price ?? null,
          stockQuantity: v.stockQuantity,
          attributes: { parentSku: p.sku },
        },
      });
    }
    products.push(product);
  }
  const rice = products[0]!;
  const oil = products[1]!;
  const detergent = products[5]!;

  // ---------------------------------------------------------------------------
  // Customers
  // ---------------------------------------------------------------------------
  const customerSeeds = [
    { waPhone: '+2347011223344', name: 'Adaeze Bello', tags: ['VIP'], segment: 'VIP', totalSpent: 486000, ordersCount: 9, marketingOptIn: true },
    { waPhone: '+2347022334455', name: 'Tunde Adeleke', tags: ['REPEAT'], segment: 'REPEAT', totalSpent: 73500, ordersCount: 3, marketingOptIn: true },
    { waPhone: '+2347033445566', name: 'Fatima Yusuf', tags: [], segment: 'NEW', totalSpent: 0, ordersCount: 0, marketingOptIn: false },
  ];
  const customers = [];
  for (const c of customerSeeds) {
    customers.push(
      await prisma.customer.upsert({
        where: { storeId_waPhone: { storeId: store.id, waPhone: c.waPhone } },
        update: { segment: c.segment },
        create: { storeId: store.id, ...c, lastSeenAt: new Date() },
      }),
    );
  }
  const [adaeze] = customers;

  // ---------------------------------------------------------------------------
  // Message thread + history
  // ---------------------------------------------------------------------------
  const conversation = await prisma.conversation.upsert({
    where: { storeId_customerId: { storeId: store.id, customerId: adaeze!.id } },
    update: { unreadCount: 1 },
    create: {
      storeId: store.id,
      customerId: adaeze!.id,
      waPhone: adaeze!.waPhone,
      status: 'BOT',
      lastMessagePreview: 'How much is the 50kg rice?',
    },
  });

  const existingMessages = await prisma.message.count({ where: { conversationId: conversation.id } });
  if (existingMessages === 0) {
    await prisma.message.createMany({
      data: [
        { conversationId: conversation.id, direction: 'INBOUND', body: 'Good morning! How much is the 50kg rice?', status: 'RECEIVED', sentByBot: false },
        { conversationId: conversation.id, direction: 'OUTBOUND', body: 'Hello Ada! Local Rice 50kg is ₦62,000. Free delivery within Lagos for orders above ₦50,000 🍚', sentByBot: true, status: 'DELIVERED' },
        { conversationId: conversation.id, direction: 'INBOUND', body: 'OK give me one bag plus the 5L groundnut oil', status: 'RECEIVED', sentByBot: false },
        { conversationId: conversation.id, direction: 'OUTBOUND', body: 'Done! Order WC-SEED01 created — ₦74,500 total. Pay here: https://pay.wco.test/WC-SEED01', sentByBot: true, status: 'READ' },
      ],
    });
  }

  // ---------------------------------------------------------------------------
  // Orders: paid+delivered-in-progress lifecycle & a pending one
  // ---------------------------------------------------------------------------
  const order1 = await prisma.order.upsert({
    where: { orderNumber: 'WC-SEED01' },
    update: {},
    create: {
      storeId: store.id,
      customerId: adaeze!.id,
      orderNumber: 'WC-SEED01',
      status: 'PAID',
      channel: 'WHATSAPP',
      subtotal: 74500,
      discount: 0,
      deliveryFee: 0,
      total: 74500,
      paidAt: new Date(),
      deliveryAddress: '3 Adeniyi Jones, Ikeja, Lagos',
      deliveryCity: 'Lagos',
    },
  });

  const riceVariant = await prisma.productVariant.findUnique({
    where: { productId_sku: { productId: rice.id, sku: 'RICE-50KG' } },
  });

  await prisma.orderItem.upsert({
    where: { id: `seed-item-${order1.id}-rice` },
    update: {},
    create: {
      id: `seed-item-${order1.id}-rice`,
      orderId: order1.id,
      productId: rice.id,
      variantId: riceVariant?.id ?? null,
      productName: rice.name,
      variantName: '50kg full bag',
      sku: 'RICE-50KG',
      quantity: 1,
      unitPrice: 62000,
    },
  });
  await prisma.orderItem.upsert({
    where: { id: `seed-item-${order1.id}-oil` },
    update: {},
    create: {
      id: `seed-item-${order1.id}-oil`,
      orderId: order1.id,
      productId: oil.id,
      productName: oil.name,
      sku: 'OIL-5L',
      quantity: 1,
      unitPrice: 12500,
    },
  });

  await prisma.payment.upsert({
    where: { providerReference: 'ps_seed_txn_001' },
    update: {},
    create: {
      storeId: store.id,
      orderId: order1.id,
      provider: 'PAYSTACK',
      providerReference: 'ps_seed_txn_001',
      amount: 74500,
      fee: 1075,
      status: 'SUCCEEDED',
      paidAt: new Date(),
      meta: { channel: 'card', authorization: 'AUTH_seed1' },
    },
  });

  await prisma.delivery.upsert({
    where: { orderId: order1.id },
    update: {},
    create: {
      storeId: store.id,
      orderId: order1.id,
      deliveryProviderId: providerByCode.SENDY!.id,
      carrier: 'SENDY',
      trackingCode: 'SDY-SEED-88421',
      status: 'IN_TRANSIT',
      pickupAddress: '12 Balogun Market, Lagos Island',
      dropoffAddress: '3 Adeniyi Jones, Ikeja, Lagos',
      recipientName: adaeze!.name,
      recipientPhone: adaeze!.waPhone,
      fee: 0, // free over ₦50k
      etaMinutes: 90,
      quotedAt: new Date(Date.now() - 3600e3),
      bookedAt: new Date(Date.now() - 1800e3),
      pickedUpAt: new Date(Date.now() - 900e3),
    },
  });

  const order2 = await prisma.order.upsert({
    where: { orderNumber: 'WC-SEED02' },
    update: {},
    create: {
      storeId: store.id,
      customerId: customers[1]!.id,
      orderNumber: 'WC-SEED02',
      status: 'PENDING_PAYMENT',
      channel: 'PAYMENT_LINK',
      subtotal: 13300,
      discount: 500,
      deliveryFee: 1900,
      total: 14700,
      deliveryAddress: '7 Herbert Macaulay Way, Yaba, Lagos',
      deliveryCity: 'Lagos',
      notes: 'Call before delivery',
    },
  });
  await prisma.orderItem.upsert({
    where: { id: `seed-item-${order2.id}-det` },
    update: {},
    create: {
      id: `seed-item-${order2.id}-det`,
      orderId: order2.id,
      productId: detergent.id,
      variantName: '3kg bucket',
      sku: 'DET-3KG',
      productName: detergent.name,
      quantity: 1,
      unitPrice: 9800,
    },
  });
  await prisma.orderItem.upsert({
    where: { id: `seed-item-${order2.id}-sugar` },
    update: {},
    create: {
      id: `seed-item-${order2.id}-sugar`,
      orderId: order2.id,
      productId: products[3]!.id,
      productName: products[3]!.name,
      sku: 'SUGAR-1KG',
      quantity: 2,
      unitPrice: 1750,
    },
  });

  // ---------------------------------------------------------------------------
  // Automation, campaigns, webhooks, metrics
  // ---------------------------------------------------------------------------
  await prisma.automationRule.upsert({
    where: { id: `seed-${store.id}-cart` },
    update: {},
    create: {
      id: `seed-${store.id}-cart`,
      storeId: store.id,
      trigger: 'CART_ABANDONED',
      conditions: { afterMinutes: 30, minCartValue: 5000 },
      messageBody: 'Hi {{customerName}} 👋 You left {{itemCount}} item(s). Want me to reserve them?',
      delayMinutes: 30,
    },
  });
  await prisma.automationRule.upsert({
    where: { id: `seed-${store.id}-paid` },
    update: {},
    create: {
      id: `seed-${store.id}-paid`,
      storeId: store.id,
      trigger: 'ORDER_PAID',
      conditions: {},
      messageBody: '🎉 Payment received for {{orderNumber}}! We are packing your order now.',
    },
  });

  const campaign = await prisma.campaign.upsert({
    where: { id: `seed-campaign-${store.id}` },
    update: {},
    create: {
      id: `seed-campaign-${store.id}`,
      storeId: store.id,
      type: 'PROMOTION',
      name: 'December Rice Promo',
      audienceFilter: { tags: ['VIP'], minOrders: 2 },
      messageBody: 'Ma! December bulk discount: 50kg rice at ₦59,000 this week only 🔥 Reply YES to lock it.',
      status: 'COMPLETED',
      startedAt: new Date(Date.now() - 30 * 864e5),
      completedAt: new Date(Date.now() - 29 * 864e5),
      statsSent: 42,
      statsDelivered: 41,
      statsReplied: 17,
    },
  });
  await prisma.campaignMessage.upsert({
    where: { id: `seed-campmsg-${campaign.id}` },
    update: {},
    create: {
      id: `seed-campmsg-${campaign.id}`,
      campaignId: campaign.id,
      customerId: adaeze!.id,
      status: 'replied',
      sentAt: new Date(Date.now() - 30 * 864e5),
    },
  });

  await prisma.webhookSubscription.upsert({
    where: { id: `seed-hook-${store.id}` },
    update: {},
    create: {
      id: `seed-hook-${store.id}`,
      storeId: store.id,
      url: 'https://example.ngrok.dev/hooks/wco',
      secret: 'whsec_dev_seed_secret_do_not_use',
      events: ['order.paid', 'shipment.delivered'],
    },
  });

  // Last 7 days of dashboard metrics (deterministic-ish ramp).
  const metricRows = Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setUTCHours(0, 0, 0, 0);
    date.setUTCDate(date.getUTCDate() - i);
    return {
      storeId: store.id,
      date,
      revenue: 120000 - i * 9000 + ((i % 3) * 4000),
      ordersCount: 18 - i,
      newCustomers: 5 - (i % 4),
      messagesCount: 140 - i * 9,
      aiResolutionRate: 0.82 - (i % 3) * 0.03,
      avgResponseSeconds: 2.4 + (i % 2),
      conversionRate: 0.31 - (i % 2) * 0.02,
    };
  });
  for (const row of metricRows) {
    await prisma.dailyStoreMetric.upsert({
      where: { storeId_date: { storeId: row.storeId, date: row.date } },
      update: row,
      create: row,
    });
  }

  console.log(`Seeded: ${owner.email} / Demo1234! · store=${store.slug} · plan=${plans.GROWTH!.code}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
