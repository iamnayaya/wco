# Icon System

> **One set, many voices.** A single, internally-consistent icon vocabulary across web, mobile, and (soon) spatial. Icons are **semantic first**: every glyph maps to a named token, so switching weight — or the whole set — never ripples through the product.

## Source of truth

- [`icons.ts`](../../packages/ui/src/design-tokens/icons.ts) — vocabulary, sizes, weights, states, micro-motion
- [`components/Icon.tsx`](../../packages/ui/src/components/Icon.tsx) — the runtime `<Icon>` component bound to the registry

## Naming — semantic, not pixel-described

Names describe meaning (`inboxRead`, not `doubleCheck`; `mobileMoney`, not `phoneCoin`). A handful from the 100+ vocabulary:

- **Commerce**: `product`, `inventory`, `cattegory`, `cart`, `checkout`, `order`, `refund`, `discount`, `barcode`, `warehouse`, `shipping`
- **Payments**: `wallet`, `card`, `cash`, `payout`, `invoice`, `currency`, `mobileMoney`, `bank`, `receipt`, `tax`
- **Messaging**: `chat`, `conversation`, `inbox`, `inboxUnread`, `inboxRead`, `broadcast`, `customer`, `segments`, `reaction`, `template`, `autoReply`
- **Analytics**: `chartLine`, `chartBar`, `chartPie`, `chartFunnel`, `trendUp`, `trendDown`, `insight`, `target`, `report`
- **Status**: `info`, `success`, `warning`, `error`, `question`, `bell`, `shield`, `lock`, `eye`, `verified`
- **AI**: `ai`, `sparkles`, `bot`, `automation`, `prediction`, `priority`
- **People**: `user`, `users`, `team`, `avatar`, `role`, `key`, `fingerprint`

## Sizes

| Token | px | Use |
|---|---|---|
| `xs` | 16 | inline, dense rows |
| `sm` | 20 | small buttons, list leading |
| **`md`** | **24** | **default UI** |
| `lg` | 32 | feature headers, empty states |
| `xl` | 48 | hero / onboarding |
| `2xl` | 64 | brand moments |

## Weights

| Token | stroke | Use |
|---|---|---|
| `light` | 1.5 | large/sparse glyphs, idle hover |
| `regular` | 1.75 | default — crisp at 24 & smaller |
| `bold` | 2.25 | active nav, primary actions, offline-first |

## States

Icons inherit `currentColor`; interactive states are handled by the parent control (hover tint, pressed scale `1.12`, disabled opacity `0.42`, focus ring on the control — never drawn on the glyph).

## Micro-motion

Subtle and purposeful: `spin` (loading/processing), `pulse` (attention), `ring` (notification bell with a fresh item), `pop` (confirmation tick / verified). All honor reduced-motion.

## Usage

```tsx
import { Icon } from '@wco/ui';

<Icon name="mobileMoney" size="md" weight="bold" />
// Decorative by default (aria-hidden). Only icon-only controls need a label:
<Icon name="trash" label="Delete product" />
```

- Icons are decorative **by default** (`aria-hidden`); sibling text carries meaning.
- Set `label` only when the icon is the *sole* cue (icon-only buttons).
- `/^.*$/`-check names with `isIconName(name)` for build-time linting.

## Accessibility

- Minimum 24px visual size with an effective ≥ 44px touch target on controls.
- Never rely on icon alone for meaning — pair with text or a `label`.
- Never declare an icon in `role="img"` if a text alternative already exists.

## Governance

- Add icons only via the registry (never inline ad-hoc SVGs scattered across pages).
- New names must be semantic and non-duplicate; PRs to `icons.ts` go through the [design-system governance](./governance.md) review.
