import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { cn } from '../../lib/cn';
import { motion, sem } from '../../lib/styles';
import { shadows, radii } from '../../design-tokens/layout';
import { useId, useScrollLock } from '../../lib/hooks';
import { mergeStrings, useWcoI18n, type CoreStrings } from '../../lib/i18n';
import { Icon } from '../Icon';
import { MenuItems, type ActionMenuItem } from './ActionMenu';

export interface CommandGroup {
  id: string;
  /** Short group heading (only shown while its filter has results). */
  label: string;
  items: readonly ActionMenuItem[];
}

export interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  groups: readonly CommandGroup[];
  placeholder?: string;
  width?: number;
  maxHeight?: number;
  strings?: Partial<CoreStrings>;
  className?: string;
  style?: CSSProperties;
}

const kbdChip: CSSProperties = {
  fontSize: 11,
  color: sem('textFaint'),
  border: `1px solid ${sem('border')}`,
  borderRadius: 6,
  padding: '2px 6px',
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
};

/**
 * CommandPalette — the ⌘K-style search surface. Flattens the command groups,
 * filters on label/description/keyword, and exposes the full keyboard model:
 * ↑↓ navigate, Home/End jump, Enter run, Esc dismiss. Fully ARIA-labelled.
 */
export function CommandPalette({
  open,
  onClose,
  groups,
  placeholder,
  width = 560,
  maxHeight = 480,
  strings,
  className,
  style,
}: CommandPaletteProps) {
  const { t } = useWcoI18n();
  const ui = mergeStrings(t, strings);
  const uid = useId('wco-command');
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(-1);

  useScrollLock(open);

  const visibleGroups = useMemo(
    () =>
      groups
        .map((group) => {
          const q = query.trim().toLowerCase();
          const items = q
            ? group.items.filter((item) =>
                `${item.label} ${item.description ?? ''} ${item.id}`
                  .toLowerCase()
                  .includes(q),
              )
            : group.items;
          return { ...group, items };
        })
        .filter((group) => group.items.length > 0),
    [groups, query],
  );

  const visibleCount = visibleGroups.reduce((n, g) => n + g.items.length, 0);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIndex(0);
    }
  }, [open]);

  useEffect(() => {
    if (activeIndex >= visibleCount) setActiveIndex(visibleCount - 1);
    if (visibleCount === 0) setActiveIndex(-1);
  }, [visibleCount, activeIndex]);

  useLayoutEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const activate = (index: number) => {
    let start = 0;
    for (const group of visibleGroups) {
      const within = index - start;
      if (within >= 0 && within < group.items.length) {
        group.items[within]?.onSelect?.();
        onClose();
        return;
      }
      start += group.items.length;
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((a) => (visibleCount === 0 ? -1 : (a + 1) % visibleCount));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((a) => (visibleCount === 0 ? -1 : (a - 1 + visibleCount) % visibleCount));
    } else if (e.key === 'Home') {
      e.preventDefault();
      setActiveIndex(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      setActiveIndex(visibleCount - 1);
    } else if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'Enter') {
      if (activeIndex >= 0) {
        e.preventDefault();
        activate(activeIndex);
      }
    }
  };

  if (!open) return null;

  let runningStart = 0;

  return (
    <div
      className={cn('wco-command-palette', className)}
      role="dialog"
      aria-modal="true"
      aria-label={ui.commands}
      style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', justifyContent: 'center', alignItems: 'flex-start', padding: '10vh 16px 16px', ...style }}
    >
      <div aria-hidden onClick={onClose} style={{ position: 'absolute', inset: 0, background: sem('overlay') }} />
      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: width,
          maxHeight,
          display: 'flex',
          flexDirection: 'column',
          background: sem('surface'),
          borderRadius: radii.xl,
          boxShadow: shadows.modal,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '12px 16px',
            borderBottom: `1px solid ${sem('border')}`,
            color: sem('textFaint'),
          }}
        >
          <Icon name="search" aria-hidden />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder ?? ui.search}
            aria-label={ui.search}
            style={{
              flex: 1,
              border: 'none',
              outline: 'none',
              background: 'transparent',
              fontSize: 16,
              fontFamily: 'var(--font-inter, system-ui)',
              color: sem('text'),
            }}
          />
          <kbd aria-hidden style={kbdChip}>esc</kbd>
        </div>
        <div style={{ overflow: 'auto', padding: 8 }}>
          {visibleGroups.length === 0 ? (
            <div
              role="status"
              style={{
                padding: '28px 16px',
                textAlign: 'center',
                color: sem('textMuted'),
                fontSize: 14,
              }}
            >
              {ui.noResults}
            </div>
          ) : (
            visibleGroups.map((group) => {
              const start = runningStart;
              runningStart += group.items.length;
              return (
                <div key={group.id}>
                  <div
                    aria-hidden
                    style={{ padding: '8px 12px 6px', fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: sem('textFaint') }}
                  >
                    {group.label}
                  </div>
                  <MenuItems
                    idPrefix={`${uid}-${group.id}`}
                    items={group.items}
                    activeIndex={activeIndex - start}
                    onSelect={(i) => activate(start + i)}
                    onHover={(i) => setActiveIndex(start + i)}
                  />
                </div>
              );
            })
          )}
        </div>
        <div
          aria-hidden
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            padding: '10px 16px',
            borderTop: `1px solid ${sem('border')}`,
            color: sem('textFaint'),
            fontSize: 12,
          }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <kbd style={kbdChip}>↑↓</kbd>
            <kbd style={kbdChip}>↵</kbd>
          </span>
          <span>{ui.select}</span>
          <span style={{ flex: 1 }} />
          <span style={{ transition: `opacity ${motion.fast}` }}>{query ? `${visibleCount} result${visibleCount === 1 ? '' : 's'}` : ui.commands}</span>
        </div>
      </div>
    </div>
  );
}