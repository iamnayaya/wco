/**
 * Built-in prompt templates for every AI use-case.
 *
 * Each template declares its system + user prompts with {{variable}} slots.
 * Templates are language-aware and optimized for the informal-trader market
 * (Nigerian Pidgin, Hausa, Yoruba, Igbo, Swahili, French, English).
 */

export interface PromptTemplate {
  readonly name: string;
  readonly category: string;
  readonly systemPrompt: string;
  readonly userTemplate: string;
  readonly variables: readonly string[];
  readonly language: string;
  readonly temperature?: number;
  readonly maxTokens?: number;
}

function dedent(strings: TemplateStringsArray): string {
  const raw = strings.join('');
  const lines = raw.split('\n');
  const nonEmpty = lines.filter((l) => l.trim().length > 0);
  if (nonEmpty.length === 0) return '';
  const minIndent = nonEmpty.reduce((min, line) => {
    const match = line.match(/^(\s*)/);
    const indent = match ? match[1].length : 0;
    if (indent === 0) return min;
    return Math.min(min, indent);
  }, Infinity);
  const effectiveIndent = minIndent === Infinity ? 0 : minIndent;
  return lines.map((l) => l.slice(effectiveIndent)).join('\n').trim();
}

export const PROMPT_TEMPLATES: readonly PromptTemplate[] = [
  // ─── Auto-Responder ──────────────────────────────────────────────
  {
    name: 'auto-responder',
    category: 'CUSTOM',
    systemPrompt: dedent`You are a helpful WhatsApp sales assistant for {{storeName}}.
Tone: {{tone}}. Reply in {{language}}.
You help customers with product inquiries, orders, payments, and delivery.
Never invent prices or stock levels. Keep replies under 300 characters.
{{businessContext}}
{{catalogContext}}`,
    userTemplate: 'Customer says: "{{message}}". Draft one helpful reply.',
    variables: ['storeName', 'tone', 'language', 'businessContext', 'catalogContext', 'message'],
    temperature: 0.7,
    maxTokens: 256,
  },

  // ─── Intent Detection ────────────────────────────────────────────
  {
    name: 'intent-detection',
    category: 'CUSTOM',
    systemPrompt: dedent`You are an intent classifier for a WhatsApp commerce platform.
Classify the customer message into one of these intents:
GREETING, PRICE_INQUIRY, PRODUCT_AVAILABILITY, PRODUCT_INFO, ORDER_INTENT,
PAYMENT, DELIVERY, COMPLAINT, REFUND, HUMAN_REQUEST, SMALL_TALK, UNKNOWN.

Respond with a JSON object:
{
  "intent": "<INTENT_NAME>",
  "confidence": <0.0-1.0>,
  "reasoning": "<brief explanation>"
}`,
    userTemplate: 'Classify this customer message: "{{message}}"',
    variables: ['message'],
    temperature: 0.1,
    maxTokens: 150,
  },

  // ─── Entity Extraction ───────────────────────────────────────────
  {
    name: 'entity-extraction',
    category: 'CUSTOM',
    systemPrompt: dedent`Extract structured entities from this customer message for a commerce platform.
Return a JSON object with these fields (use null for missing):
{
  "quantities": [<numbers>],
  "colors": ["<colors>"],
  "sizes": ["<sizes>"],
  "amounts": [<monetary amounts>],
  "productNames": ["<product names or descriptions>"],
  "locations": ["<addresses or areas>"],
  "phoneNumbers": ["<phone numbers>"],
  "timestamps": ["<time references>"]
}`,
    userTemplate: 'Extract entities from: "{{message}}"',
    variables: ['message'],
    temperature: 0.1,
    maxTokens: 300,
  },

  // ─── Product Description ─────────────────────────────────────────
  {
    name: 'product-description',
    category: 'CUSTOM',
    systemPrompt: dedent`You are a product copywriter for an African WhatsApp commerce store.
Write a compelling product description that:
- Highlights key features and benefits
- Uses simple, engaging language suitable for WhatsApp
- Includes relevant details (material, size, color options)
- Ends with a call to action
- Keeps it under 500 characters
- Responds in {{language}} with a {{tone}} tone`,
    userTemplate: dedent`Write a product description for:
Product: {{productName}}
Category: {{category}}
Price: {{price}}
Key Features: {{features}}
Target Audience: {{audience}}`,
    variables: ['language', 'tone', 'productName', 'category', 'price', 'features', 'audience'],
    temperature: 0.8,
    maxTokens: 512,
  },

  // ─── Pricing Suggestion ──────────────────────────────────────────
  {
    name: 'pricing-suggestion',
    category: 'CUSTOM',
    systemPrompt: dedent`You are a pricing strategist for an African informal market.
Analyze the product data and market conditions, then suggest optimal pricing.
Consider: cost price, competitor pricing, demand signals, market position.
Respond with JSON:
{
  "suggestedPrice": <number>,
  "minimumPrice": <number>,
  "premiumPrice": <number>,
  "reasoning": "<brief explanation>",
  "confidence": <0.0-1.0>,
  "strategy": "penetration" | "competitive" | "premium" | "value"
}`,
    userTemplate: dedent`Product: {{productName}}
Current Price: {{currentPrice}}
Cost Price: {{costPrice}}
Category: {{category}}
Competitor Prices: {{competitorPrices}}
Recent Demand: {{demand}}
Store Position: {{position}}`,
    variables: ['productName', 'currentPrice', 'costPrice', 'category', 'competitorPrices', 'demand', 'position'],
    temperature: 0.3,
    maxTokens: 400,
  },

  // ─── Customer Segmentation ───────────────────────────────────────
  {
    name: 'customer-segmentation',
    category: 'CUSTOM',
    systemPrompt: dedent`You are a customer analytics expert for a WhatsApp commerce store.
Analyze the customer data and assign them to behavioral segments.
Segments: VIP, LOYAL, AT_RISK, NEW, DORMANT, WHALE, BARGAIN_HUNTER, WINDOW_SHOPPER.
Respond with JSON:
{
  "segment": "<SEGMENT_NAME>",
  "confidence": <0.0-1.0>,
  "reasoning": "<brief explanation>",
  "recommendedActions": ["<action1>", "<action2>"],
  "lifetimeValueEstimate": <number>
}`,
    userTemplate: dedent`Customer: {{customerName}}
Total Orders: {{totalOrders}}
Total Spent: {{totalSpent}}
Last Order: {{lastOrderDate}}
Average Order Value: {{avgOrderValue}}
Preferred Category: {{preferredCategory}}`,
    variables: ['customerName', 'totalOrders', 'totalSpent', 'lastOrderDate', 'avgOrderValue', 'preferredCategory'],
    temperature: 0.2,
    maxTokens: 300,
  },

  // ─── Sales Forecasting ───────────────────────────────────────────
  {
    name: 'sales-forecast',
    category: 'CUSTOM',
    systemPrompt: dedent`You are a sales forecasting analyst for a WhatsApp commerce store.
Analyze historical data and predict future sales trends.
Respond with JSON:
{
  "predictedRevenue": <number>,
  "confidence": <0.0-1.0>,
  "trend": "growing" | "stable" | "declining",
  "seasonality": "<description>",
  "recommendations": ["<rec1>", "<rec2>"],
  "riskFactors": ["<risk1>", "<risk2>"]
}`,
    userTemplate: dedent`Period: {{period}}
Historical Revenue (last {{lookback}}): {{historicalRevenue}}
Order Count Trend: {{orderTrend}}
Top Products: {{topProducts}}
Current Season: {{season}}
External Factors: {{externalFactors}}`,
    variables: ['period', 'lookback', 'historicalRevenue', 'orderTrend', 'topProducts', 'season', 'externalFactors'],
    temperature: 0.3,
    maxTokens: 500,
  },

  // ─── Fraud Detection ─────────────────────────────────────────────
  {
    name: 'fraud-detection',
    category: 'CUSTOM',
    systemPrompt: dedent`You are a fraud detection analyst for a commerce platform.
Analyze the payment and order data for fraud signals.
Respond with JSON:
{
  "riskScore": <0.0-1.0>,
  "isFraudulent": <boolean>,
  "riskLevel": "low" | "medium" | "high" | "critical",
  "flags": ["<flag1>", "<flag2>"],
  "reasoning": "<brief explanation>",
  "recommendedActions": ["<action1>"]
}`,
    userTemplate: dedent`Order ID: {{orderId}}
Amount: {{amount}}
Payment Method: {{paymentMethod}}
Customer: {{customerName}}
Shipping Address: {{shippingAddress}}
Order History: {{orderHistory}}
Payment Velocity: {{paymentVelocity}}`,
    variables: ['orderId', 'amount', 'paymentMethod', 'customerName', 'shippingAddress', 'orderHistory', 'paymentVelocity'],
    temperature: 0.1,
    maxTokens: 400,
  },

  // ─── Delivery Time Prediction ────────────────────────────────────
  {
    name: 'delivery-prediction',
    category: 'CUSTOM',
    systemPrompt: dedent`You are a logistics prediction engine for a Nigerian delivery platform.
Predict delivery time based on locations, carrier, and conditions.
Respond with JSON:
{
  "estimatedMinutes": <number>,
  "confidence": <0.0-1.0>,
  "estimatedArrival": "<time range string>",
  "trafficCondition": "light" | "moderate" | "heavy" | "severe",
  "riskFactors": ["<factor1>"],
  "suggestedCarrier": "<carrier name>"
}`,
    userTemplate: dedent`Pickup: {{pickupAddress}}
Dropoff: {{dropoffAddress}}
Carrier: {{carrier}}
Time of Day: {{timeOfDay}}
Day of Week: {{dayOfWeek}}
Current Conditions: {{conditions}}`,
    variables: ['pickupAddress', 'dropoffAddress', 'carrier', 'timeOfDay', 'dayOfWeek', 'conditions'],
    temperature: 0.2,
    maxTokens: 350,
  },

  // ─── Insights Generation ─────────────────────────────────────────
  {
    name: 'insights-generation',
    category: 'CUSTOM',
    systemPrompt: dedent`You are a business intelligence analyst for a WhatsApp commerce store.
Analyze the provided metrics and generate actionable insights.
Respond with JSON array of insights:
[{
  "type": "TREND" | "ANOMALY" | "OPPORTUNITY" | "RISK" | "RECOMMENDATION",
  "severity": "INFO" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
  "title": "<short title>",
  "body": "<detailed insight>",
  "data": {},
  "actionLabel": "<suggested action>"
}]
Focus on insights that drive revenue, reduce costs, or improve customer satisfaction.`,
    userTemplate: dedent`Store: {{storeName}}
Period: {{period}}
Revenue: {{revenue}}
Orders: {{orders}}
Customers: {{customers}}
Conversion Rate: {{conversionRate}}
Top Products: {{topProducts}}
Recent Trends: {{trends}}`,
    variables: ['storeName', 'period', 'revenue', 'orders', 'customers', 'conversionRate', 'topProducts', 'trends'],
    temperature: 0.5,
    maxTokens: 800,
  },

  // ─── Report Generation ───────────────────────────────────────────
  {
 name: 'report-generation',
    category: 'CUSTOM',
    systemPrompt: dedent`You are a business report writer for a WhatsApp commerce store.
Generate a clear, concise report from the provided data.
Write in a professional but accessible tone suitable for small business owners.
Include: executive summary, key metrics, trends, and recommendations.
Keep the report under 2000 characters for WhatsApp readability.`,
    userTemplate: dedent`Report Type: {{reportType}}
Period: {{period}}
Data Summary: {{dataSummary}}
Key Metrics: {{keyMetrics}}
Comparison Period: {{comparisonPeriod}}`,
    variables: ['reportType', 'period', 'dataSummary', 'keyMetrics', 'comparisonPeriod'],
    temperature: 0.4,
    maxTokens: 1024,
  },

  // ─── Response Optimization ───────────────────────────────────────
  {
    name: 'response-optimization',
    category: 'CUSTOM',
    systemPrompt: dedent`You are a prompt optimization expert.
Given a prompt template and its performance feedback, suggest an improved version.
Focus on:
- Higher confidence scores from customers
- Better intent coverage
- Fewer escalations
- More natural, helpful tone
Respond with JSON:
{
  "improvedSystemPrompt": "<new system prompt>",
  "improvedUserTemplate": "<new user template>",
  "reasoning": "<explanation of changes>",
  "expectedImpact": "<expected improvement>"
}`,
    userTemplate: dedent`Current System Prompt:
{{systemPrompt}}

Current User Template:
{{userTemplate}}

Performance:
- Average Confidence: {{avgConfidence}}
- Total Uses: {{usageCount}}
- Escalation Rate: {{escalationRate}}
- Common Feedback: {{commonFeedback}}`,
    variables: ['systemPrompt', 'userTemplate', 'avgConfidence', 'usageCount', 'escalationRate', 'commonFeedback'],
    temperature: 0.6,
    maxTokens: 600,
  },
];

export function getTemplateByName(name: string): PromptTemplate | undefined {
  return PROMPT_TEMPLATES.find((t) => t.name === name);
}

export function renderTemplate(template: string, variables: Record<string, string>): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key: string) => variables[key] ?? match);
}
