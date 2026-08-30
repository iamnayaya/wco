import { forwardRef, type CSSProperties, type HTMLAttributes, type ReactNode } from 'react';
import { cn } from '../lib/cn';
import { sem } from '../lib/styles';
import { radii } from '../design-tokens/layout';

export interface CardProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  /** Visual treatment. `raised` uses the themed surface + soft shadow. */
  variant?: 'raised' | 'outlined' | 'subtle';
  /** Padding from the token scale. */
  padding?: 'none' | 'sm' | 'md' | 'lg' | 'xl';
  /** Interactive card (hover lift + focusable as a link/button). */
  interactive?: boolean;
  /** Header slot (rendered tight to the top edge for a flush header). */
  header?: ReactNode;
  /** Footer slot. */
  footer?: ReactNode;
  title?: ReactNode;
  as?: 'div' | 'section' | 'article';
}

const PAD: Record<NonNullable<CardProps['padding']>, string> = {
  none: '0px',
  sm: '12px',
  md: '20px',
  lg: '28px',
  xl: '40px',
};

const VARIANTS: Record<NonNullable<CardProps['variant']>, CSSProperties> = {
  raised: { background: sem('surface'), border: `1px solid ${sem('border')}` },
  outlined: { background: 'transparent', border: `1px solid ${sem('borderStrong')}` },
  subtle: { background: sem('bgRaised'), border: `1px solid ${sem('border')}` },
};

/**
 * Themed surface container. Flush `header`/`footer` slots render edge-to-edge
 * (common for list cards); body gets the token padding.
 */
export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { variant = 'raised', padding = 'md', interactive = false, header, footer, title, as: Tag = 'div', className, style, children, ...props },
  ref,
) {
  const base: CSSProperties = {
    borderRadius: radii.lg,
    ...VARIANTS[variant],
    ...style,
  };
  const interactiveCss: CSSProperties = interactive
    ? { cursor: 'pointer', transition: 'transform 160ms cubic-bezier(0.2,0,0,1), box-shadow 160ms ease' }
    : {};
  return (
    <Tag ref={ref as never} className={cn('wco-card', className)} style={{ ...base, ...interactiveCss }} {...props}>
      {header !== undefined && (
        <div style={{ paddingInline: PAD[padding], paddingBlockStart: PAD[padding], paddingBlockEnd: 0 }}>{header}</div>
      )}
      <div style={{ padding: PAD[padding] }}>
        {title !== undefined && <div style={{ marginBottom: 8, fontWeight: 700, fontSize: 15, color: sem('text') }}>{title}</div>}
        {children}
      </div>
      {footer !== undefined && (
        <div style={{ paddingInline: PAD[padding], paddingBlockStart: 12, paddingBlockEnd: PAD[padding], borderTop: `1px solid ${sem('border')}` }}>
          {footer}
        </div>
      )}
    </Tag>
  );
});