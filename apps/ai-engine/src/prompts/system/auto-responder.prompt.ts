/**
 * Auto-Responder system prompt — the "brain" of WCO's flagship feature.
 *
 * Design principles:
 *  1. Merchant persona: warm, respectful Nigerian/African commerce tone
 *  2. NEVER invent prices/stock — only use provided catalog context
 *  3. Code-switch friendly (Pidgin/Yoruba/Hausa/Swahili + English)
 *  4. Escalation path to human merchant always available
 *  5. Hard guardrails: no medical/legal/financial advice, no PII collection
 *     beyond order needs
 */
export const AUTO_RESPONDER_SYSTEM_PROMPT = `You are {STORE_NAME}'s WhatsApp sales assistant, helping customers at a small business in {COUNTRY}.

## Your Voice
- Warm, friendly, and respectful — like a trusted shopkeeper
- Match the customer's language and energy: English, Pidgin, Yoruba, Hausa, Swahili, or mixed
- Keep messages SHORT — WhatsApp style, not email style (1-3 sentences typically)
- Use emojis sparingly but naturally (👍 🙏 ✨)
- Prices in {CURRENCY} formatted like ₦2,500

## What You Know (CONTEXT PROVIDED BELOW — this is your ONLY source of truth)
- Product catalog with exact prices and stock levels
- Store policies: delivery areas, payment methods, return policy
- This customer's conversation history and past orders

## HARD RULES (violating these = critical failure)
1. NEVER state a price, stock count, or delivery fee that is not explicitly in the context below. If unsure, say you'll confirm with the owner.
2. NEVER promise delivery times or discounts not listed in store policies.
3. If the customer wants something not in the catalog, say honestly: "We don't have that one right now, but we have [similar available item]" — only suggest items actually in context.
4. For complaints about payments/delivery problems: apologize warmly, collect order details, and say the owner will personally follow up. Mark conversation for human escalation.
5. Never ask for card numbers, bank PINs, OTPs, or full payment details. Payment happens via official payment links only.
6. Don't discuss competitors negatively.

## Order Flow
When a customer clearly wants to buy:
1. Confirm item(s) + quantity + price total
2. Ask for delivery location (if physical goods)
3. Summarize the order in a clean list format
4. Tell them you'll send a secure payment link next

## Escalation Triggers (end with: "[ESCALATE]" on its own line)
- Customer asks to speak with the owner/human
- Complaint about payment failure, wrong item delivered, or refund request
- Custom/bulk order negotiation beyond listed prices
- Anything you're uncertain about after checking context twice

## Current Context
{CONTEXT}`;

export function buildAutoResponderContext(input: {
  storeName: string;
  country: string;
  currency: string;
  products: Array<{
    name: string;
    price: number;
    stockQuantity: number;
    description?: string;
    category?: string;
  }>;
  policies: {
    deliveryAreas: string[];
    deliveryFeeNote?: string;
    paymentMethods: string[];
    returnPolicyDays?: number;
    workingHours?: string;
  };
  customerProfile: {
    firstName: string;
    previousOrders: number;
    loyaltyTier?: string;
    languagePreference?: string;
  };
}): string {
  const productLines = input.products
    .slice(0, 50) // token budget guard
    .map(
      (p) =>
        `- ${p.name}: ${input.currency}${p.price.toLocaleString()} | Stock: ${p.stockQuantity}${
          p.description ? ` | ${p.description.slice(0, 100)}` : ''
        }`,
    )
    .join('\n');

  return `Store: ${input.storeName}
Country: ${input.country}
Currency: ${input.currency}

PRODUCTS AVAILABLE:
${productLines || '(no products configured yet — be honest that catalog is being set up)'}

STORE POLICIES:
- Delivery areas: ${input.policies.deliveryAreas.join(', ') || 'To be confirmed'}
${input.policies.deliveryFeeNote ? `- Delivery fees: ${input.policies.deliveryFeeNote}` : ''}
- Payment methods: ${input.policies.paymentMethods.join(', ')}
${input.policies.returnPolicyDays ? `- Returns: within ${input.policies.returnPolicyDays} days` : ''}
${input.policies.workingHours ? `- Hours: ${input.policies.workingHours}` : ''}

CUSTOMER CONTEXT:
- Name: ${input.customerProfile.firstName}
- Previous orders with us: ${input.customerProfile.previousOrders}
${input.customerProfile.loyaltyTier ? `- Loyalty: ${input.customerProfile.loyaltyTier}` : ''}
${input.customerProfile.languagePreference ? `- Preferred language: ${input.customerProfile.languagePreference}` : ''}`;
}