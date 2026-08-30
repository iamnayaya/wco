import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { I18nProvider } from '../../lib/i18n';
import { ActionMenu } from '../action/ActionMenu';
import { SplitButton } from '../action/SplitButton';
import { FloatingActionButton } from '../action/FloatingActionButton';
import { ToggleGroup } from '../action/ToggleGroup';
import { CommandPalette } from '../action/CommandPalette';

const menuItems = [
  { id: 'open', label: 'Open order', onSelect: vi.fn() },
  { id: 'dupe', label: 'Duplicate', disabled: true },
  { id: 'del', label: 'Delete', dangerous: true },
];

describe('ActionMenu', () => {
  it('toggles open via the trigger and labels the menu', () => {
    render(
      <I18nProvider locale="en">
        <ActionMenu label="Actions" items={menuItems} />
      </I18nProvider>,
    );
    const trigger = screen.getByRole('button', { name: 'Actions' });
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('menu', { name: 'Actions' })).toBeInTheDocument();
    fireEvent.click(trigger);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('activates the focused item with Enter', () => {
    const onSelect = vi.fn();
    render(
      <ActionMenu
        label="Actions"
        items={[
          { id: 'a', label: 'Run', onSelect },
          { id: 'b', label: 'Pause', onSelect },
        ]}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Actions' }));
    const menu = screen.getByRole('menu');
    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    fireEvent.keyDown(menu, { key: 'Enter' });
    expect(onSelect).toHaveBeenCalledOnce();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('skips disabled items while navigating', () => {
    const onSelect = vi.fn();
    render(
      <ActionMenu
        label="Actions"
        items={[
          { id: 'first', label: 'First', onSelect },
          { id: 'blocked', label: 'Blocked', disabled: true, onSelect },
          { id: 'last', label: 'Last', onSelect },
        ]}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Actions' }));
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'ArrowDown' });
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'ArrowDown' });
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Enter' });
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('closes on Escape', () => {
    render(<ActionMenu label="Actions" items={menuItems} />);
    fireEvent.click(screen.getByRole('button', { name: 'Actions' }));
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});

describe('SplitButton', () => {
  it('fuses a primary action with a disclosure menu', () => {
    const onPress = vi.fn();
    const onSelect = vi.fn();
    render(<SplitButton label="Send" onPress={onPress} items={[{ id: 'x', label: 'Reschedule', onSelect }]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(onPress).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: 'More options' }));
    expect(screen.getByRole('menu')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Reschedule' }));
    expect(onSelect).toHaveBeenCalledOnce();
  });

  it('disables both halves while loading', () => {
    render(<SplitButton label="Send" loading items={[{ id: 'x', label: 'Reschedule' }]} />);
    const [primary, more] = screen.getAllByRole('button');
    expect(primary).toBeDisabled();
    expect(more).toBeDisabled();
  });
});

describe('FloatingActionButton', () => {
  it('exposes speed-dial items with ARIA wiring', () => {
    const onPress = vi.fn();
    const onSelect = vi.fn();
    render(
      <FloatingActionButton
        label="New item"
        icon={<span>+</span>}
        onPress={onPress}
        items={[{ id: 'a', label: 'Photo', onSelect }]}
      />,
    );
    const fab = screen.getByRole('button', { name: 'New item' });
    expect(fab).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(fab);
    expect(fab).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Photo' }));
    expect(onSelect).toHaveBeenCalledOnce();
  });

  it('triggers onPress when there are no items', () => {
    const onPress = vi.fn();
    render(<FloatingActionButton label="Scan" onPress={onPress} />);
    fireEvent.click(screen.getByRole('button', { name: 'Scan' }));
    expect(onPress).toHaveBeenCalledOnce();
  });
});

describe('ToggleGroup', () => {
  const options = [
    { value: 'sms', label: 'SMS' },
    { value: 'email', label: 'Email' },
    { value: 'wa', label: 'WhatsApp', disabled: true },
  ];

  it('renders options as buttons in single-select mode', () => {
    render(<ToggleGroup label="Channel" options={options} defaultValue={['sms']} selectionMode="single" />);
    expect(screen.getByRole('radiogroup', { name: 'Channel' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'SMS' })).toHaveAttribute('aria-checked', 'true');
  });

  it('toggles multiple selections with aria-pressed', () => {
    const onChange = vi.fn();
    render(<ToggleGroup label="Channel" options={options.slice(0, 2)} selectionMode="multiple" onChange={onChange} />);
    const first = screen.getByRole('button', { name: 'SMS' });
    fireEvent.click(first);
    expect(first).toHaveAttribute('aria-pressed', 'true');
    expect(onChange).toHaveBeenCalledWith(['sms']);
  });
});

describe('CommandPalette', () => {
  const groups = [
    {
      id: 'actions',
      label: 'Quick actions',
      items: [
        { id: 'o', label: 'Open order', onSelect: vi.fn() },
        { id: 'r', label: 'Refund', onSelect: vi.fn() },
      ],
    },
  ];

  it('filters commands and runs the selected one', () => {
    render(<CommandPalette open onClose={vi.fn()} groups={groups} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    const input = screen.getByRole('textbox', { name: 'Search' });
    fireEvent.change(input, { target: { value: 'refund' } });
    expect(screen.getByRole('menuitem', { name: 'Refund' })).toBeInTheDocument();
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(groups[0].items[1].onSelect).toHaveBeenCalledOnce();
  });

  it('dismisses on Escape', () => {
    const onClose = vi.fn();
    render(<CommandPalette open onClose={onClose} groups={groups} />);
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Search' }), { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });
});