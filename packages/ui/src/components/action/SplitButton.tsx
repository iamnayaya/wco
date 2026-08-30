import { type CSSProperties, type ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { controlSize, motion, sem, type ControlSize } from '../../lib/styles';
import { shadows, radii } from '../../design-tokens/layout';
import { mergeStrings, useWcoI18n, type CoreStrings } from '../../lib/i18n';
import { Button, type ButtonVariant } from '../Button';
import { Icon } from '../Icon';
import { ButtonGroup, GroupSeparator } from '../ButtonGroup';
import { MenuItems, type ActionMenuItem } from './ActionMenu';
import { useActionMenu } from './useActionMenu';

export interface SplitButtonProps {
  /** Primary action label (rendered on the leading button). */
  label: string;
  /** Flashes the primary button as busy (spinner) and disables both halves. */
  loading?: boolean;
  /** Primary action handler. */
  onPress?: () => void;
  items: readonly ActionMenuItem[];
  variant?: ButtonVariant;
  size?: ControlSize;
  fullWidth?: boolean;
  disabled?: boolean;
  className?: string;
  style?: CSSProperties;
  /** Localized label strings (rarely needed for the default English table). */
  strings?: Partial<Pick<CoreStrings, 'moreOptions'>>;
}

/**
 * SplitButton — a primary action fused with an overflow menu.
 *
 * Both halves share a single border radius, the primary action stays
 * one-tap, and the disclosure arrow toggles the same accessible menu used by
 * ActionMenu (arrow keys, `aria-activedescendant`, Escape/Tab close).
 */
export function SplitButton({
  label,
  loading = false,
  onPress,
  items,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  disabled = false,
  className,
  style,
  strings,
}: SplitButtonProps) {
  const { t } = useWcoI18n();
  const ui = mergeStrings(t, strings);
  const menu = useActionMenu({
    count: items.length,
    isDisabled: (i) => Boolean(items[i]?.disabled),
    onSelect: (i) => items[i]?.onSelect?.(),
  });
  const s = controlSize[size];
  const isDisabled = disabled || loading;

  const trigger: CSSProperties = {
    border: 'none',
    background: 'transparent',
    color: sem('textFaint'),
    cursor: isDisabled ? 'default' : 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: s.height,
    height: s.height,
    transition: `background-color ${motion.fast}, transform 80ms ${motion.base}`,
  };

  return (
    <div className={cn('wco-split-button', className)} style={{ position: 'relative', display: 'inline-flex', ...style }}>
      <ButtonGroup>
        <Button
          variant={variant}
          size={size}
          loading={loading}
          disabled={disabled}
          fullWidth={fullWidth}
          onClick={onPress}
        >
          {label}
        </Button>
        <GroupSeparator size={size} />
        <button
          ref={menu.triggerRef}
          type="button"
          disabled={isDisabled}
          aria-label={ui.moreOptions}
          style={trigger}
          {...menu.triggerProps}
        >
          <Icon
            name="chevronDown"
            size="sm"
            aria-hidden
            style={{
              transform: menu.open ? 'rotate(180deg)' : undefined,
              transition: `transform ${motion.base}`,
            }}
          />
        </button>
      </ButtonGroup>
      {menu.open && (
        <div
          ref={menu.panelRef}
          role="menu"
          aria-label={ui.moreOptions}
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            right: 0,
            width: 224,
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