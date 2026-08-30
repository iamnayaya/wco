import { forwardRef, type ForwardedRef, type SVGProps } from 'react';
import { cn } from '../lib/cn';
import { icons, iconA11y, isIconName } from '../design-tokens/icons';

/**
 * Path data for each WCO icon (24×24 viewBox, stroke-based).
 * Icons are drawn to the semantic vocabulary in design-tokens/icons.ts.
 * `data` is an array of `<path>` `d` strings; multi-path icons join.
 */
const PATHS: Record<string, string[]> = {
  home: ['M3 10.5 12 3l9 7.5V21a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z'],
  grid: ['M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z'],
  search: ['M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4.35-4.35'],
  plus: ['M12 5v14M5 12h14'],
  minus: ['M5 12h14'],
  close: ['M6 6l12 12M18 6 6 18'],
  check: ['M5 12.5l4.5 4.5L19 7'],
  chevronDown: ['M6 9l6 6 6-6'],
  chevronUp: ['M6 15l6-6 6 6'],
  chevronRight: ['M9 6l6 6-6 6'],
  chevronLeft: ['M15 6l-6 6 6 6'],
  arrowRight: ['M4 12h16M14 6l6 6-6 6'],
  arrowLeft: ['M20 12H4M10 6 4 12l6 6'],
  arrowUp: ['M12 20V4M6 10l6-6 6 6'],
  arrowDown: ['M12 4v16M6 14l6 6 6-6'],
  settings: ['M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.4 1a7 7 0 0 0-2-1.2L14 3h-4l-.5 2.7a7 7 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.5A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.5 2 3.4 2.4-1a7 7 0 0 0 2 1.2L10 21h4l.5-2.7a7 7 0 0 0 2-1.2l2.4 1 2-3.4-2-1.5c.06-.4.1-.8.1-1.2z'],
  bell: ['M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6zM10 19a2 2 0 0 0 4 0'],
  shield: ['M12 3l7 3v6c0 5-3 8-7 9-4-1-7-4-7-9V6z'],
  lock: ['M7 11V7a5 5 0 0 1 10 0v4M5 11h14v9H5z'],
  eye: ['M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12zM12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z'],
  eyeOff: ['M3 3l18 18M10.6 5.1A9.8 9.8 0 0 1 12 5c6.5 0 10 7 10 7a18 18 0 0 1-2.8 3.3M6 6.6C3.7 8.3 2 12 2 12s3.5 7 10 7a9.6 9.6 0 0 0 4.5-1.1'],
  info: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 11v5M12 8h.01'],
  success: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM8.5 12.5l2.5 2.5 5-6'],
  warning: ['M12 3 2.5 20h19zM12 10v4M12 17h.01'],
  error: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM9 9l6 6M15 9l-6 6'],
  question: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM9.5 9a2.5 2.5 0 0 1 5 0c0 1.5-2.5 2-2.5 3.5M12 16.5h.01'],
  user: ['M8 7a4 4 0 1 0 8 0 4 4 0 0 0-8 0zM4 21c0-4 3.6-6 8-6s8 2 8 6'],
  wallet: ['M3 6a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2v1M3 6v12a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2H5a2 2 0 0 1-2-2zM16 13h.01'],
  cart: ['M3 4h2l2.6 11.5a2 2 0 0 0 2 1.5h8a2 2 0 0 0 2-2l1-7H6M9 20a1 1 0 1 0 0 2 1 1 0 0 0 0-2zM17 20a1 1 0 1 0 0 2 1 1 0 0 0 0-2z'],
  chat: ['M4 5h16v11H8l-4 3V5z'],
  conversation: ['M4 6h12v8H8l-4 3V6zM16 9h4v8l-2 1.5'],
  inbox: ['M3 13h5l1.5 2.5h5L16 13h5M3 13l1-6h16l1 6M3 13v6h18v-6'],
  inboxRead: ['M3 13h5l1.5 2.5h5L16 13h5M3 13l1-6h16l1 6M3 13v4h18v-4M17 2l2 2 4-4'],
  broadcast: ['M3 12a9 9 0 0 1 18 0M7.5 12a4.5 4.5 0 0 1 9 0M12 12v6'],
  customer: ['M10 8a3 3 0 1 0 0 .01M5 20a6 6 0 0 1 10 0M16 4a3 3 0 0 1 1 5.8M18 14a4 4 0 0 1 2 3'],
  contact: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM8 9a4 4 0 0 1 8 0M5.5 18a8 8 0 0 1 13 0'],
  segment: ['M4 5h16M4 12h16M4 19h16'],
  ai: ['M12 3v18M3 12h18M6.5 6.5l11 11M17.5 6.5l-11 11'],
  sparkles: ['M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9z'],
  bot: ['M12 3a2 2 0 0 1 2 2h4a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h4a2 2 0 0 1 2-2zM9 12h.01M15 12h.01M12 13c1.5 0 2.5 1 2.5 2h-5c0-1 1-2 2.5-2z'],
  trendUp: ['M3 17l6-6 4 4 8-8M14 7h7v7'],
  trendDown: ['M3 7l6 6 4-4 8 8M14 17h7v-7'],
  chartLine: ['M4 20V4M4 20h16M6 15l4-5 3 3 5-7'],
  chartBar: ['M4 20V10M10 20V4M16 20v-6M22 20H2'],
  chartPie: ['M12 3a9 9 0 1 0 9 9h-9zM12 3v9h9a9 9 0 0 0-9-9z'],
  order: ['M6 3h12l1 18-7-4-7 4z'],
  refund: ['M9 4a7 7 0 1 0 7 7M9 4l2 2M9 4V2M21 4v6h-6'],
  payout: ['M4 5h16v14H4zM4 8h16M8 13h8'],
  invoice: ['M6 3h12v18l-3-2-3 2-3-2-3 2z'],
  calendar: ['M8 3v4M16 3v4M4 9h16M6 5h12a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z'],
  clock: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 3'],
  star: ['M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17.9 6.6 20l1-6.1L3.2 9.5l6.1-.9z'],
  heart: ['M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10z'],
  more: ['M5 12h.01M12 12h.01M19 12h.01'],
  moreVertical: ['M12 5h.01M12 12h.01M12 19h.01'],
  menu: ['M4 6h16M4 12h16M4 18h16'],
  edit: ['M4 20h4l11-11a2.8 2.8 0 0 0-4-4L4 16zM13.5 6.5l4 4'],
  trash: ['M6 6h12M9 6V4h6v2M8 10v8M12 10v8M16 10v8M5 6l1 14h12l1-14'],
  copy: ['M8 8h12v12H8zM6 16V4h10'],
  download: ['M12 3v12M7 10l5 5 5-5M4 19h16'],
  upload: ['M12 15V3M7 8l5-5 5 5M4 19h16'],
  share: ['M12 4v12M7 10l5-6 5 6M4 15v5h16v-5'],
  link: ['M9 12h6M7 7l-3 3a4 4 0 0 0 0 6l3 3M17 7l3 3a4 4 0 0 1 0 6l-3 3'],
  external: ['M14 4h6v6M20 4 10 14M18 14v6H4V6h6'],
  refresh: ['M20 11a8 8 0 1 0-2.3 6M20 4v7h-7'],
  undo: ['M8 5 3 10l5 5M3 10h11a6 6 0 0 1 0 12'],
  redo: ['M16 5l5 5-5 5M21 10H10a6 6 0 0 0 0 12'],
  save: ['M5 3h12l2 2v16H5V3zM8 3v6h8V3M8 21v-8h8v8'],
  print: ['M6 8V4h12v4M4 8h16v8h-4v4H8v-4H4z'],
  filter: ['M3 5h18l-7 8v6l-4 2v-8z'],
  sort: ['M7 4v13M4 14l3 3 3-3M17 20V7M14 10l3-3 3 3'],
  export: ['M12 3v12M7 8l5-5 5 5M4 15v6h16v-6'],
  history: ['M3 7a9 9 0 1 1 1 5M3 4v5h5'],
  target: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 11h.01'],
  insight: ['M12 2l2.4 5.6L20 10l-5.6 2.4L12 18l-2.4-5.6L4 10l5.6-2.4zM19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9z'],
  report: ['M4 4h16v16H4zM8 12v4M12 8v8M16 10v6'],
  product: ['M12 3 4 7v10l8 4 8-4V7zM4 7l8 4 8-4M12 11v10'],
  inventory: ['M4 5h16v6H4zM7 11v8M12 11v8M8 15h8'],
  category: ['M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z'],
  checkout: ['M3 4h2l1 3h14l-2 8H7l-1-6M9 20a1 1 0 1 0 0 2 1 1 0 0 0 0-2zM17 20a1 1 0 1 0 0 2 1 1 0 0 0 0-2z'],
  discount: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM9.5 9.5h.01M14.5 14.5h.01M9 15l6-6'],
  priceTag: ['M3 3h7l13 13-7 7L3 10zM7.5 7.5h.01'],
  barcode: ['M4 7v10M8 7v10M12 7v3M12 14v3M16 7v10M20 7v10'],
  shipping: ['M3 6h13v10H3zM16 9h4l2 3v4h-6'],
  warehouse: ['M4 9v11h16V9M2 9l10-5 10 5M8 14h8M12 9v11'],
  card: ['M3 6h18v12H3zM3 10h18'],
  cash: ['M4 6h16v12H4zM12 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM8 10h.01M16 14h.01'],
  mobileMoney: ['M6 3h12v18H6zM12 17h.01M8 6h8'],
  bank: ['M3 9l9-5 9 5M4 10v8M9 10v8M15 10v8M20 10v8M2 21h20'],
  receipt: ['M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2zM9 8h6M9 12h6'],
  tax: ['M12 2l8 4v6c0 5-3 9-8 10-5-1-8-5-8-10V6zM9 9l6 6M15 9l-6 6'],
  reaction: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM9 10h.01M15 10h.01M8.5 14.5a4 4 0 0 0 7 0'],
  attachment: ['M20 11.5l-8 8a5.5 5.5 0 0 1-8-8l8-8a3.5 3.5 0 0 1 5 5l-8 8a1.5 1.5 0 0 1-2-2'],
  template: ['M5 4h14v4H5zM5 11h9v9H5zM17 11h2M17 15h2M17 19h2'],
  autoReply: ['M4 6h12v7H9l-5 4v-4H4zM15 14l1.5 1.5L19 13'],
  phone: ['M5 3h4l2 5-2.5 2a12 12 0 0 0 5.5 5.5L16 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 5a2 2 0 0 1 2-2z'],
  voice: ['M12 4a3 3 0 0 1 3 3v5a3 3 0 0 1-6 0V7a3 3 0 0 1 3-3zM5 11a7 7 0 0 0 14 0M12 18v3'],
  video: ['M15 6H3v12h12zM15 10l6-3v10l-6-3'],
  camera: ['M4 7h3l2-3h6l2 3h3v12H4zM12 10a3 3 0 1 0 0 6 3 3 0 0 0 0-6z'],
  image: ['M4 5h16v14H4zM9 11a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM4 17l5-5 3 3 2-2 6 6'],
  mic: ['M12 3a3 3 0 0 1 3 3v5a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3zM6 11a6 6 0 0 0 12 0M12 17v4'],
  emoji: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM9 10h.01M15 10h.01M8.5 14.5a4 4 0 0 0 7 0'],
  globe: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18'],
  language: ['M4 5h16M12 5v16M9 21h6M12 5c-3 4-3 10 0 14M12 5c3 4 3 10 0 14M6 9h8'],
  location: ['M12 21s-6-5.5-6-10a6 6 0 1 1 12 0c0 4.5-6 10-6 10zM12 8.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z'],
  store: ['M3 9l1-4h16l1 4M4 9a2 2 0 0 0 4 0 2 2 0 0 0 4 0 2 2 0 0 0 4 0 2 2 0 0 0 4 0M5 9v12h14V9M9 21v-6h6v6'],
  notification: ['M12 3a5 5 0 0 1 5 5c0 4 1.5 5 1.5 5h-13S7 12 7 8a5 5 0 0 1 5-5zM10 19a2 2 0 0 0 4 0'],
  alert: ['M12 3 2.5 20h19zM12 8v5M12 16.5h.01'],
  help: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM9.5 9a2.5 2.5 0 0 1 5 0c0 1.5-2.5 2-2.5 3.5M12 16.5h.01'],
  automation: ['M4 8l4-4 4 4M8 4v9M20 16l-4 4-4-4M16 20v-9'],
  prediction: ['M12 2a6 6 0 0 1 4 10.5V15a1 1 0 0 1-1 1h-6a1 1 0 0 1-1-1v-2.5A6 6 0 0 1 12 2zM10 20h4M12 16v2'],
  priority: ['M5 5h14l-4 4 4 4H5l4-4zM5 18h14'],
  users: ['M8 7a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM2 20a6 6 0 0 1 12 0M17 8a3 3 0 1 0 0 6M17 14a5 5 0 0 1 5 5'],
  team: ['M8 7a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM14 6a3 3 0 1 1 0 6M2 20a6 6 0 0 1 12 0 6 6 0 0 0 6-6'],
  avatar: ['M8 7a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM3 20a6 6 0 0 1 12 0M17 9a3 3 0 1 1 0 6'],
  role: ['M12 3l7 3v6c0 5-3 8-7 9-4-1-7-4-7-9V6zM9 12l2 2 4-4'],
  permission: ['M4 4h16v10H4zM8 18h8M12 14v4M6 8h.01M10 8h.01M14 8h.01M18 8h.01M6 11h.01M10 11h.01M14 11h.01M18 11h.01'],
  key: ['M16 6a3 3 0 1 0-2.3 4.9L20 21h-3l-2-2v-2l-2-2h-2M6 12l4 4'],
  fingerprint: ['M7 10a5 5 0 0 1 10 0c0 4-1.5 6-2 7M5 10a8 8 0 0 1 14 0M4 14a10 10 0 0 1 16 0M12 12v5l-2 2M12 10c0 2-.5 3-1 4'],
  flag: ['M5 21V4M5 4h11l-1.5 4L16 12H5'],
  folder: ['M3 6h6l2 3h10v9H3z'],
  file: ['M6 3h8l4 4v14H6zM14 3v5h5'],
  bookmark: ['M6 3h12v18l-6-4-6 4z'],
  gift: ['M4 10h16v10H4zM3 7h18v3H3zM12 7v13M12 7a4 4 0 1 0-4-4zM12 7a4 4 0 1 1 4-4z'],
  zap: ['M13 2 4 14h7l-1 8 9-12h-7z'],
  anchor: ['M12 3a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM12 9v12M6 21h12M4 12h16'],
  sun: ['M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10z'],
  moon: ['M20 15A8.5 8.5 0 1 1 9 4a7 7 0 0 0 11 11z'],
  device: ['M4 5h16v14H4zM8 19h8'],
  web: ['M4 5h16v14H4zM4 9h16M9 9v10'],
  mobile: ['M7 3h10v18H7zM10 18h0'],
};

/** An icon component tied 1:1 to the WCO icon vocabulary. */
export interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  /** Icon name from the WCO vocabulary (design-tokens/icons.ts). */
  name: string;
  /** Size from the token scale. Defaults to `md` (24px). */
  size?: keyof typeof icons.sizes;
  /** Stroke weight voice. Defaults to `regular`. */
  weight?: keyof typeof icons.weights;
  /** Only set when the icon is the sole cue (icon-only buttons). */
  label?: string;
  /** Purely decorative micro-motion. Defaults to none. */
  motion?: 'spin' | 'pulse' | 'ring' | 'pop';
}

function IconImpl(
  { name, size = 'md', weight = 'regular', label, motion, className, style, ...props }: IconProps,
  ref: ForwardedRef<SVGSVGElement>,
) {
  const paths = PATHS[name];
  const px = icons.sizes[size];
  const strokeWidth = icons.weights[weight];
  const motionClass = motion ? `wco-icon-${motion}` : undefined;
  const a11y = iconA11y({ label });

  return (
    <svg
      ref={ref}
      viewBox="0 0 24 24"
      width={px}
      height={px}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('wco-icon', motionClass, className)}
      style={style}
      {...a11y}
      {...props}
    >
      {paths?.map((d, i) => <path key={i} d={d} />)}
    </svg>
  );
}

export const Icon = forwardRef<SVGSVGElement, IconProps>(IconImpl);

/** Convenience: verify a name exists (for autocomplete/build-time lint). */
export { isIconName };
