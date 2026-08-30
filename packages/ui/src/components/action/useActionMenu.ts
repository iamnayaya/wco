import { useCallback, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useClickOutside, useControllableState, useId } from '../../lib/hooks';

/**
 * `useActionMenu` — the accessibility + keyboard engine behind ActionMenu,
 * SplitButton and CommandPalette.
 *
 * Implements the WAI-ARIA menu pattern without a single dependency:
 * - roving `activeIndex` over *enabled* items (ArrowDown/Up, Home/End),
 * - Enter/Space activation, Escape + Tab close (refocusing the trigger),
 * - `aria-haspopup` / `aria-expanded` / `aria-activedescendant` wiring,
 * - click-outside dismissal, focus moved into the panel on open.
 */

export interface UseActionMenuOptions {
  /** Total number of menu items (including disabled). */
  count: number;
  /** Returns whether the item at `index` is disabled. */
  isDisabled?: (index: number) => boolean;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Called with the index of the activated (Enter/Space/click) item. */
  onSelect?: (index: number) => void;
}

export function useActionMenu(options: UseActionMenuOptions) {
  const { count, isDisabled, onSelect, onOpenChange } = options;
  const [open, setOpen] = useControllableState<boolean>({
    value: options.open,
    defaultValue: options.defaultOpen ?? false,
    onChange: onOpenChange,
  });
  const [activeIndex, setActiveIndex] = useState(-1);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const uid = useId('wco-menu');

  const nextEnabled = useCallback(
    (from: number, dir: 1 | -1) => {
      for (let i = 1; i <= count; i += 1) {
        const idx = (from + dir * i + count) % count;
        if (!isDisabled?.(idx)) return idx;
      }
      return -1;
    },
    [count, isDisabled],
  );

  const openMenu = useCallback(
    (activate = true) => {
      if (open) {
        if (activate) setActiveIndex((a) => (a === -1 ? nextEnabled(-1, 1) : a));
        return;
      }
      setOpen(true);
      if (activate) setActiveIndex(nextEnabled(-1, 1));
    },
    [open, setOpen, nextEnabled],
  );

  const close = useCallback(() => {
    setOpen(false);
    setActiveIndex(-1);
    requestAnimationFrame(() => triggerRef.current?.focus());
  }, [setOpen]);

  const activate = useCallback(
    (index: number) => {
      if (index < 0 || isDisabled?.(index)) return;
      onSelect?.(index);
      close();
    },
    [onSelect, isDisabled, close],
  );

  const handleMenuKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const dir = e.key === 'ArrowDown' ? 1 : -1;
        setActiveIndex((a) => nextEnabled(a === -1 ? -1 : a + dir, dir));
        return;
      }
      if (e.key === 'Home') {
        e.preventDefault();
        setActiveIndex(nextEnabled(-1, 1));
        return;
      }
      if (e.key === 'End') {
        e.preventDefault();
        setActiveIndex(nextEnabled(count, -1));
        return;
      }
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        activate(activeIndex === -1 ? nextEnabled(-1, 1) : activeIndex);
        return;
      }
      if (e.key === 'Escape' || e.key === 'Tab') close();
    },
    [count, nextEnabled, activeIndex, activate, close],
  );

  const handleTriggerKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        openMenu();
      } else if (e.key === 'Escape') {
        close();
      }
    },
    [openMenu, close],
  );

  const toggle = useCallback(() => (open ? close() : openMenu()), [open, close, openMenu]);

  useClickOutside(panelRef, close, open);

  useLayoutEffect(() => {
    if (!open || !panelRef.current) return;
    panelRef.current.focus();
  }, [open]);

  return {
    open,
    activeIndex,
    setActiveIndex,
    setOpen,
    toggle,
    activate,
    triggerRef,
    panelRef,
    menuId: uid,
    triggerProps: {
      onClick: toggle,
      onKeyDown: handleTriggerKeyDown,
      'aria-haspopup': 'menu' as const,
      'aria-expanded': open,
      'aria-controls': open ? `${uid}-menu` : undefined,
    },
    panelProps: {
      id: `${uid}-menu`,
      tabIndex: -1,
      'aria-activedescendant': activeIndex >= 0 ? `${uid}-item-${activeIndex}` : undefined,
      onKeyDown: handleMenuKeyDown,
    },
  };
}