import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  Button,
  Input,
  Field,
  Badge,
  EmptyState,
  StatCard,
  Spinner,
} from './index';

describe('Button', () => {
  it('renders children and triggers onClick', async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(<Button onClick={onClick}>Save</Button>);
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('renders a spinner and disables while loading', () => {
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        Save
      </Button>,
    );
    const btn = screen.getByRole('button', { name: /loading/i });
    expect(btn).toBeDisabled();
  });

  it('respects disabled via prop', () => {
    render(<Button disabled>Save</Button>);
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('applies a danger variant class', () => {
    const { container } = render(<Button variant="danger">Delete</Button>);
    expect(container.firstChild).toHaveClass('bg-red-600');
  });
});

describe('Input / Field', () => {
  it('renders an input with the input class and passes through props', () => {
    render(<Input aria-label="Email" placeholder="you@example.com" />);
    const el = screen.getByRole('textbox', { name: 'Email' });
    expect(el).toHaveClass('input');
    expect(el).toHaveAttribute('placeholder', 'you@example.com');
  });

  it('renders a labelled field and surfaces validation errors accessibly', () => {
    render(
      <Field label="Store name" error="Required">
        <Input aria-label="Store name" />
      </Field>,
    );
    expect(screen.getByText('Store name')).toBeInTheDocument();
    expect(screen.getByText('Required')).toBeInTheDocument();
  });
});

describe('Badge', () => {
  it('renders the label with underscores replaced by spaces', () => {
    render(<Badge label="PENDING_PAYMENT" />);
    expect(screen.getByText('PENDING PAYMENT')).toBeInTheDocument();
  });

  it('applies a tone-specific class for known statuses', () => {
    const { container } = render(<Badge label="PAID" />);
    expect(container.firstChild).toHaveClass('text-emerald-700');
  });

  it('falls back to the neutral style for unknown tones', () => {
    const { container } = render(<Badge label="SOMETHING_ELSE" />);
    expect(container.firstChild).toHaveClass('text-slate-600');
  });
});

describe('EmptyState', () => {
  it('renders title, description and optional action', () => {
    render(
      <EmptyState title="No orders yet" description="Create your first order." action={<button>New</button>} />,
    );
    expect(screen.getByText('No orders yet')).toBeInTheDocument();
    expect(screen.getByText('Create your first order.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New' })).toBeInTheDocument();
  });
});

describe('StatCard', () => {
  it('renders the label and value', () => {
    render(<StatCard label="Revenue" value="₦1,250,000" delta={12.4} />);
    expect(screen.getByText('Revenue')).toBeInTheDocument();
    expect(screen.getByText('₦1,250,000')).toBeInTheDocument();
  });

  it('shows green up-delta', () => {
    const { container } = render(<StatCard label="Revenue" value="x" delta={5.2} />);
    expect(container).toHaveTextContent('▲');
    expect(container).toHaveTextContent('5.2%');
  });

  it('shows red down-delta', () => {
    const { container } = render(<StatCard label="Orders" value="x" delta={-3.1} />);
    expect(container).toHaveTextContent('▼');
    expect(container).toHaveTextContent('3.1%');
  });

  it('omits the delta line when no delta is provided', () => {
    render(<StatCard label="Revenue" value="x" />);
    expect(screen.queryByText(/vs yesterday/i)).not.toBeInTheDocument();
  });
});

describe('Spinner', () => {
  it('renders a status with a "Loading" aria-label', () => {
    render(<Spinner />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'Loading');
  });
});
