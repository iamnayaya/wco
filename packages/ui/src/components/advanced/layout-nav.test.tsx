import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Panel } from '../layout/Panel';
import { Spacer } from '../layout/Spacer';
import { Navbar } from '../nav/Navbar';
import { Sidebar } from '../nav/Sidebar';
import { TabBar } from '../nav/TabBar';
import { LinkList } from '../nav/LinkList';

describe('Panel', () => {
  it('renders title, subtitle and body', () => {
    render(
      <Panel title="Inventory" subtitle="3 unread">
        <p>Body</p>
      </Panel>,
    );
    expect(screen.getByText('Inventory')).toBeInTheDocument();
    expect(screen.getByText('3 unread')).toBeInTheDocument();
    expect(screen.getByText('Body')).toBeInTheDocument();
  });

  it('collapses the body behind an aria-expanded toggle', () => {
    render(
      <Panel title="Filters" collapsible>
        <p>Hidden</p>
      </Panel>,
    );
    const toggle = screen.getByRole('button', { name: /Filters/ });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(toggle);
    expect(screen.queryByText('Hidden')).not.toBeInTheDocument();
    fireEvent.click(toggle);
    expect(screen.getByText('Hidden')).toBeInTheDocument();
  });
});

describe('Spacer', () => {
  it('renders a fixed-height flex space', () => {
    const { container } = render(<Spacer size={24} />);
    expect(container.firstChild).toHaveStyle({ height: '24px' });
  });

  it('fills remaining space in auto mode', () => {
    const { container } = render(<Spacer size="auto" />);
    expect(container.firstChild).toHaveStyle({ flexGrow: '1' });
  });
});

describe('Navbar', () => {
  it('renders a banner with brand and actions', () => {
    render(<Navbar logo={<span>WCO</span>} nav={<a href="/en">Catalog</a>} />);
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByText('WCO')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Catalog' })).toHaveAttribute('href', '/en');
  });

  it('floats with a shadow in floating mode', () => {
    const { container } = render(<Navbar variant="floating" logo={<span>WCO</span>} />);
    expect((container.firstChild as HTMLElement).style.boxShadow).toContain('rgb');
  });
});

describe('Sidebar', () => {
  const groups = [
    {
      id: 'main',
      label: 'Main',
      items: [
        { id: 'orders', label: 'Orders', active: true, onSelect: vi.fn() },
        { id: 'catalog', label: 'Catalog', onSelect: vi.fn() },
      ],
    },
  ];

  it('collapses via the labelled toggle', () => {
    render(<Sidebar groups={groups} ariaLabel="App" />);
    const rail = screen.getByRole('complementary');
    expect(rail).toHaveAttribute('aria-label', 'App');
    const toggle = screen.getByRole('button', { name: 'Collapse sidebar' });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('button', { name: 'Expand sidebar' })).toBeInTheDocument();
  });

  it('marks the active item with aria-current and fires onSelect', () => {
    render(<Sidebar groups={groups} ariaLabel="App" />);
    const orders = screen.getByRole('button', { name: 'Orders' });
    expect(orders).toHaveAttribute('aria-current', 'page');
    fireEvent.click(orders);
    expect(groups[0].items[0].onSelect).toHaveBeenCalledOnce();
  });
});

describe('TabBar', () => {
  const items = [
    { value: 'home', label: 'Home' },
    { value: 'orders', label: 'Orders', badge: 3 },
    { value: 'more', label: 'More' },
  ];

  it('surfaces a controlled selection as aria-current', () => {
    render(<TabBar items={items} defaultValue="home" ariaLabel="Primary" />);
    expect(screen.getByRole('button', { name: 'Home' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: 'Orders, 3' })).not.toHaveAttribute('aria-current');
  });

  it('emits onChange and reads badges', () => {
    const onChange = vi.fn();
    render(<TabBar items={items} defaultValue="home" ariaLabel="Primary" onChange={onChange} />);
    expect(screen.getByText('3')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Orders, 3' }));
    expect(onChange).toHaveBeenCalledWith('orders');
  });
});

describe('LinkList', () => {
  const items = [
    { id: 'a', label: 'Orders', href: '/orders', active: true },
    { id: 'b', label: 'Docs', href: 'https://dev.wco.example', external: true },
    { id: 'c', label: 'Locked', disabled: true },
  ];

  it('renders href rows as links with aria-current', () => {
    render(<LinkList items={items} ariaLabel="Account" heading="Account" />);
    expect(screen.getByRole('navigation', { name: 'Account' })).toBeInTheDocument();
    const orders = screen.getByRole('link', { name: 'Orders' });
    expect(orders).toHaveAttribute('href', '/orders');
    expect(orders).toHaveAttribute('aria-current', 'page');
  });

  it('keeps disabled rows non-interactive', () => {
    render(<LinkList items={items} ariaLabel="Account" />);
    expect(screen.queryByRole('button', { name: 'Locked' })).not.toBeInTheDocument();
    expect(screen.getByText('Locked')).toBeInTheDocument();
  });
});