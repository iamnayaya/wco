import { type CSSProperties, type ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { motion, sem } from '../../lib/styles';
import { radii } from '../../design-tokens/layout';
import { useControllableState, useId } from '../../lib/hooks';
import { Icon } from '../Icon';

export interface FormSectionProps {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  /** Collapses the body behind the title (aria-expanded toggle). */
  collapsible?: boolean;
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Small label chip in the header (e.g. â€œOptionalâ€/â€œ2 of 3â€). */
  badge?: ReactNode;
  /** Action slot in the header row (e.g. â€œResetâ€). */
  action?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

const heading: CSSProperties = {
  fontSize: 16,
  fontWeight: 700,
  fontFamily: 'var(--font-inter, system-ui)',
  color: sem('text'),
  margin: 0,
  lineHeight: 1.3,
};

function chipStyle(): CSSProperties {
  return {
    fontSize: 11,
    fontWeight: 600,
    color: sem('textMuted'),
    border: `1px solid ${sem('borderStrong')}`,
    borderRadius: 999,
    padding: '2px 8px',
    whiteSpace: 'nowrap',
  };
}

/**
 * FormSection â€” groups related fields behind a titled header with optional
 * description, a small state chip, a header action slot and a collapsible
 * body. Rendered as an `aria-labelledby` group so the heading labels the
 * whole region for assistive tech.
 */
export function FormSection({
  title,
  description,
  children,
  collapsible = false,
  defaultOpen = true,
  open,
  onOpenChange,
  badge,
  action,
  className,
  style,
}: FormSectionProps) {
  const [isOpen, setOpen] = useControllableState<boolean>({
    value: open,
    defaultValue: defaultOpen,
    onChange: onOpenChange,
  });
  const titleId = useId('wco-form-section');

  const panel: CSSProperties = {
    border: `1px solid ${sem('border')}`,
    borderRadius: radii.lg,
    background: sem('surface'),
    padding: '18px 20px',
    ...style,
  };

  const expanded = !collapsible || isOpen;

  return (
    <section aria-labelledby={titleId} className={cn('wco-form-section', className)} style={panel}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: expanded && description ? 6 : 14 }}>
        {collapsible ? (
          <button
            type="button"
            aria-expanded={isOpen}
            aria-controls={titleId}
            onClick={() => setOpen(!isOpen)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              flex: 1,
              minWidth: 0,
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              padding: 0,
              color: sem('text'),
              textAlign: 'start',
            }}
          >
            <Icon
              name="chevronRight"
              aria-hidden
              style={{
                transition: `transform ${motion.base}`,
                transform: isOpen ? 'rotate(90deg)' : undefined,
                color: sem('textFaint'),
                flexShrink: 0,
              }}
            />
            <h3 id={titleId} style={heading}>
              {title}
            </h3>
          </button>
        ) : (
          <h3 id={titleId} style={{ ...heading, flex: 1, minWidth: 0 }}>
            {title}
          </h3>
        )}
        {badge && <span style={chipStyle()}>{badge}</span>}
        {action}
      </div>
      {expanded && description && (
        <div style={{ fontSize: 13, lineHeight: 1.5, color: sem('textMuted'), marginBottom: 14 }}>{description}</div>
      )}
      {expanded && <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>{children}</div>}
    </section>
  );
}