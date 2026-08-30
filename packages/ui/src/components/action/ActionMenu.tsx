import { cloneElement, type CSSProperties, type ReactElement, type ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { controlSize, motion, sem, type ControlSize } from '../../lib/styles';
import { shadows, radii } from '../../design-tokens/layout';
import { Button, type ButtonProps, type ButtonVariant } from '../Button';
import { Icon } from '../Icon';
import { useActionMenu } from './useActionMenu';

/** A single actionable row inside a menu (ActionMenu, SplitButton, CommandPalette). */
export interface ActionMenuItem {
  id: string;
  label: string;
  description?: string;
  icon?: ReactNode;
  /** Keyboard shortcut hint rendered as a trailing chip. */
  shortcut?: string;
  dangerous?: boolean;
  disabled?: boolean;
  /** Renders a divider above this item. */
  separatorBefore?: boolean;
  onSelect?: () => void;
}

export function isMenuItemDisabled(item: ActionMenuItem | undefined): boolean {
  return Boolean(item?.disabled);
}

const itemBase: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  width: '100%',
  border: 'none',
  background: 'transparent',
  textAlign: 'start',
  borderRadius: radii.sm,
  padding: '8px 10px',
  fontSize: 14,
  fontFamily: 'var(--font-inter, system-ui)',
  cursor: 'pointer',
  color: sem('text'),
  transition: `background-color ${motion.fast}, color ${motion.fast}`,
};

function itemStyle(item: ActionMenuItem, active: boolean): CSSProperties {
  return {
    ...itemBase,
    color: item.dangerous ? sem('dangerText') : sem('text'),
    background: active && !item.disabled ? sem('surfaceHover') : 'transparent',
    cursor: item.disabled ? 'default' : 'pointer',
    opacity: item.disabled ? 0.45 : 1,
  };
}

/**
 * The shared menu panel body. Internally used by ActionMenu, SplitButton and
 * CommandPalette so keyboard navigation + visual language never drift.
 */
export function MenuItems({
  items,
  activeIndex,
  onSelect,
  onHover,
  idPrefix,
}: {
  items: readonly ActionMenuItem[];
  activeIndex: number;
  onSelect: (index: number) => void;
  onHover: (index: number) => void;
  idPrefix: string;
}) {
  return (
    <>
      {items.map((item, i) => (
        <span key={item.id}>
          {item.separatorBefore && i > 0 && (
            <span
              aria-hidden
              style={{
                display: 'block',
                height: 1,
                margin: '4px 6px',
                background: sem('border'),
              }}
            />
          )}
          <button
            id={`${idPrefix}-item-${i}`}
            type="button"
            role="menuitem"
            tabIndex={-1}
            disabled={item.disabled}
            aria-disabled={item.disabled || undefined}
            onClick={() => onSelect(i)}
            onMouseEnter={() => onHover(i)}
            style={itemStyle(item, activeIndex === i)}
          >
            {item.icon && <span aria-hidden style={{ display: 'inline-flex', color: sem('textFaint') }}>{item.icon}</span>}
            <span style={{ flex: 1, textAlign: 'start' }}>
              <span style={{ display: 'block', lineHeight: 1.3 }}>{item.label}</span>
              {item.description && (
                <span style={{ display: 'block', fontSize: 12, color: sem('textMuted'), lineHeight: 1.3 }}>{item.description}</span>
              )}
            </span>
            {item.shortcut && (
              <span
                aria-hidden
                style={{
                  fontSize: 11,
                  color: sem('textFaint'),
                  border: `1px solid ${sem('border')}`,
                  borderRadius: 6,
                  padding: '2px 5px',
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                }}
              >
                {item.shortcut}
              </span>
            )}
          </button>
        </span>
      ))}
    </>
  );
}

export interface ActionMenuProps {
  /** Accessible name for the trigger and the menu itself. */
  label: string;
  items: readonly ActionMenuItem[];
  /** Custom trigger element (a `Button`). Menu wiring is merged in. */
  trigger?: ReactElement<ButtonProps>;
  variant?: ButtonVariant;
  size?: ControlSize;
  /** Whether the panel aligns to the start or end edge of the trigger. */
  align?: 'start' | 'end';
  width?: number;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
  style?: CSSProperties;
}

/**
 * ActionMenu — accessible popover menu with full keyboard navigation.
 * The trigger (default or custom `Button`) manages `aria-haspopup`,
 * `aria-expanded` and activation; the panel implements the WAI-ARIA menu
 * pattern with `aria-activedescendant` roving selection.
 */
export function ActionMenu({
  label,
  items,
  trigger,
  variant = 'secondary',
  size = 'md',
  align = 'end',
  width = 232,
  open,
  defaultOpen,
  onOpenChange,
  className,
  style,
}: ActionMenuProps) {
  const menu = useActionMenu({
    count: items.length,
    isDisabled: (i) => isMenuItemDisabled(items[i]),
    open,
    defaultOpen,
    onOpenChange,
    onSelect: (i) => items[i]?.onSelect?.(),
  });
  const s = controlSize[size];

  const triggerNode = trigger ? (
    // Clone the consumer's button and merge ARIA + handlers onto it.
    cloneElement(trigger as ReactElement<Record<string, unknown>>, menu.triggerProps)
  ) : (
    <Button ref={menu.triggerRef} variant={variant} size={size} aria-label={label} {...menu.triggerProps}>
      {label}
      <Icon
        name="chevronDown"
        size="sm"
        aria-hidden
        style={{
          transition: `transform ${motion.base}`,
          transform: menu.open ? 'rotate(180deg)' : undefined,
        }}
      />
    </Button>
  );

  return (
    <div className={cn('wco-action-menu', className)} style={{ position: 'relative', display: 'inline-flex', ...style }}>
      {triggerNode}
      {menu.open && (
        <div
          ref={menu.panelRef}
          role="menu"
          aria-label={label}
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: align === 'end' ? undefined : 0,
            right: align === 'end' ? 0 : undefined,
            width,
            minWidth: s.height,
            background: sem('surface'),
            border: `1px solid ${sem('border')}`,
            borderRadius: radii.lg,
            boxShadow: shadows.popover,
            padding: 4,
            maxHeight: 320,
            overflow: 'auto',
            zIndex: 960,
          }}
          {...menu.panelProps}
        >
          <MenuItems
            items={items}
            activeIndex={menu.activeIndex}
            onSelect={menu.activate}
            onHover={menu.setActiveIndex}
            idPrefix={menu.menuId}
          />
        </div>
      )}
    </div>
  );
}