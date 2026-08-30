import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Kanban } from '../data/Kanban';
import { InfoCard } from '../data/InfoCard';
import { ProfileCard } from '../data/ProfileCard';
import { Carousel } from '../media/Carousel';
import { StatusIndicator } from '../feedback/StatusIndicator';
import { CompletionIndicator } from '../feedback/CompletionIndicator';
import { Kbd } from '../feedback/Kbd';

describe('Kanban', () => {
  const columns = [
    {
      id: 'todo',
      title: 'To do',
      cards: [{ id: 'c1', title: 'Follow up', description: 'Call Amina', onClick: vi.fn() }],
    },
    {
      id: 'done',
      title: 'Done',
      cards: [{ id: 'c2', title: 'Refund', onClick: vi.fn() }],
    },
  ];

  it('labels the board and renders columns with live counts', () => {
    render(<Kanban columns={columns} ariaLabel="Support board" />);
    expect(screen.getByRole('list', { name: 'Support board' })).toBeInTheDocument();
    expect(screen.getAllByText('1')).toHaveLength(2);
  });

  it('renders a column with no cards as empty', () => {
    render(
      <Kanban
        columns={[{ id: 'x', title: 'Backlog', cards: [] }]}
        ariaLabel="Board"
      />,
    );
    expect(screen.getByText('Backlog')).toBeInTheDocument();
    expect(screen.getByText('Empty')).toBeInTheDocument();
  });

  it('fires the card callback', () => {
    render(<Kanban columns={columns} ariaLabel="Board" />);
    fireEvent.click(screen.getByRole('button', { name: /Follow up/ }));
    expect(columns[0].cards[0].onClick).toHaveBeenCalledOnce();
  });
});

describe('InfoCard', () => {
  it('renders title and description', () => {
    render(<InfoCard title="Overdue" description="3 invoices pending" tone="warning" />);
    expect(screen.getByText('Overdue')).toBeInTheDocument();
    expect(screen.getByText('3 invoices pending')).toBeInTheDocument();
  });

  it('becomes a button when onClick is provided', () => {
    const onClick = vi.fn();
    render(<InfoCard title="View order" onClick={onClick} />);
    fireEvent.click(screen.getByRole('button', { name: 'View order' }));
    expect(onClick).toHaveBeenCalledOnce();
  });
});

describe('ProfileCard', () => {
  it('renders identity with an accessible avatar', () => {
    render(<ProfileCard name="Amina Yusuf" title="Merchant" bio="Lagos flagship" />);
    expect(screen.getByText('Amina Yusuf')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Amina Yusuf' })).toBeInTheDocument();
  });
});

describe('Carousel', () => {
  const slides = [
    { id: 'a', content: <span>Slide A</span> },
    { id: 'b', content: <span>Slide B</span> },
    { id: 'c', content: <span>Slide C</span> },
  ];

  it('announces itself as a carousel region', () => {
    render(<Carousel slides={slides} label="Promotions" />);
    const region = screen.getByRole('region', { name: 'Promotions' });
    expect(region).toHaveAttribute('aria-roledescription', 'carousel');
  });

  it('navigates with the next arrow', () => {
    const onSlideChange = vi.fn();
    render(<Carousel slides={slides} label="Promotions" loop={false} onSlideChange={onSlideChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(onSlideChange).toHaveBeenCalledWith(1);
    expect(screen.getByRole('button', { name: 'Next' })).not.toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
  });

  it('jumps with the dot controls', () => {
    const onSlideChange = vi.fn();
    render(<Carousel slides={slides} label="Promotions" onSlideChange={onSlideChange} />);
    fireEvent.click(screen.getByRole('button', { name: /slide 3/ }));
    expect(onSlideChange).toHaveBeenCalledWith(2);
  });
});

describe('StatusIndicator', () => {
  it('labels the state for assistive tech', () => {
    render(<StatusIndicator status="online" withLabel />);
    const dot = screen.getByRole('status');
    expect(dot).toHaveAccessibleName('Online');
  });

  it('accepts an explicit custom color and label', () => {
    render(<StatusIndicator status="custom" color="#7c3aed" label="Syncing" />);
    expect(screen.getByRole('status')).toHaveAccessibleName('Syncing');
  });
});

describe('CompletionIndicator', () => {
  it('renders a success summary as a polite live region', () => {
    render(<CompletionIndicator status="success" title="Payment captured" message="AED 120 to Omonigho" />);
    expect(screen.getByRole('status')).toHaveAccessibleName(/Payment captured/);
  });

  it('surfaces failures as an alert', () => {
    render(<CompletionIndicator status="failure" title="Payment failed" />);
    expect(screen.getByRole('alert')).toHaveAccessibleName(/Payment failed/);
  });
});

describe('Kbd', () => {
  it('renders a keycap and preserves the authored text', () => {
    render(<Kbd>Ctrl+K</Kbd>);
    expect(screen.getByText('Ctrl')).toBeInTheDocument();
    expect(screen.getByText('K')).toBeInTheDocument();
  });

  it('splits chords at plus signs', () => {
    const { container } = render(<Kbd>Shift+Enter</Kbd>);
    expect(container.querySelector('kbd')).not.toBeNull();
    expect(screen.getByText('Shift')).toBeInTheDocument();
    expect(screen.getByText('Enter')).toBeInTheDocument();
  });
});