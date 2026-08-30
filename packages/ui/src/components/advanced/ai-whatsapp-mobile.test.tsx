import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AIPrediction } from '../ai/AIPrediction';
import { AIRecommendation } from '../ai/AIRecommendation';
import { AIChat } from '../ai/AIChat';
import { ChatHeader } from '../whatsapp/ChatHeader';
import { MessageReactions } from '../whatsapp/MessageReactions';
import { MessageAttachment } from '../whatsapp/MessageAttachment';
import { MessagePreview } from '../whatsapp/MessagePreview';
import { TopNavigationBar } from '../mobile/TopNavigationBar';
import { BottomNavigationBar } from '../mobile/BottomNavigationBar';

describe('AIPrediction', () => {
  it('exposes confidence as a progressbar', () => {
    render(<AIPrediction title="Reply chance" outcome="High likelihood" confidence={72} tone="success" />);
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '72');
    expect(screen.getByText('High likelihood')).toBeInTheDocument();
    expect(screen.getByText('72%')).toBeInTheDocument();
  });

  it('clamps confidence into 0–100', () => {
    render(<AIPrediction title="Reply chance" outcome="Extremely likely" confidence={150} />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
  });
});

describe('AIRecommendation', () => {
  it('lists reasons and runs the CTA', () => {
    const onAction = vi.fn();
    render(
      <AIRecommendation
        title="Follow up now"
        description="Edit and resend"
        reasons={['Strong open rate', 'Customer online']}
        actionLabel="Follow up"
        onAction={onAction}
      />,
    );
    expect(screen.getByRole('list')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'Follow up' }));
    expect(onAction).toHaveBeenCalledOnce();
  });

  it('honours dismiss', () => {
    const onDismiss = vi.fn();
    render(<AIRecommendation title="Tip" dismissLabel="Dismiss tip" onDismiss={onDismiss} />);
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss tip' }));
    expect(onDismiss).toHaveBeenCalledOnce();
  });
});

describe('AIChat', () => {
  it('submits typed messages with Enter', () => {
    const onSend = vi.fn();
    render(<AIChat messages={[]} onSend={onSend} />);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'Hello' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onSend).toHaveBeenCalledWith('Hello');
    expect(input).toHaveValue('');
  });

  it('submits via the send button and disables it while empty', () => {
    const onSend = vi.fn();
    render(<AIChat messages={[]} onSend={onSend} />);
    const send = screen.getByRole('button', { name: /Send message/ });
    expect(send).toBeDisabled();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Hi' } });
    expect(send).not.toBeDisabled();
    fireEvent.click(send);
    expect(onSend).toHaveBeenCalledWith('Hi');
  });

  it('fills the input from a suggestion chip', () => {
    const onSend = vi.fn();
    render(<AIChat messages={[]} onSend={onSend} suggestions={['Check inventory']} />);
    fireEvent.click(screen.getByRole('button', { name: 'Check inventory' }));
    expect(screen.getByRole('textbox')).toHaveValue('Check inventory');
  });
});

describe('ChatHeader', () => {
  it('invokes the back callback', () => {
    const onBack = vi.fn();
    render(<ChatHeader title="Amina" subtitle="online" onBack={onBack} />);
    fireEvent.click(screen.getByRole('button', { name: 'Go back' }));
    expect(onBack).toHaveBeenCalledOnce();
  });
});

describe('MessageReactions', () => {
  it('renders toggleable, pressed-aware pills', () => {
    const onToggle = vi.fn();
    render(
      <MessageReactions
        reactions={[
          { emoji: '👍', count: 2, reacted: true },
          { emoji: '❤️', count: 1 },
        ]}
        onToggle={onToggle}
      />,
    );
    expect(screen.getByRole('group', { name: 'Reactions' })).toBeInTheDocument();
    const thumbs = screen.getByRole('button', { name: '👍 2' });
    expect(thumbs).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(thumbs);
    expect(onToggle).toHaveBeenCalledWith('👍', false);
  });
});

describe('MessageAttachment', () => {
  it('renders a file card with an action', () => {
    const onAction = vi.fn();
    render(<MessageAttachment type="file" name="invoice.pdf" size="1.2 MB" onAction={onAction} />);
    expect(screen.getByRole('group', { name: 'invoice.pdf' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Upload' }));
    expect(onAction).toHaveBeenCalledOnce();
  });

  it('renders a determinate progress bar while downloading', () => {
    const { container } = render(<MessageAttachment type="voice" name="Note" progress={40} />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '40');
    expect(container.querySelector('[data-hidden]')).toBeNull();
  });
});

describe('MessagePreview', () => {
  it('composes an accessible label and fires onClick', () => {
    const onClick = vi.fn();
    render(<MessagePreview contactName="Amina" message="On my way" time="14:02" unread={2} onClick={onClick} />);
    const row = screen.getByRole('button', { name: /Amina/ });
    expect(row).toHaveAccessibleName(/2 unread/);
    fireEvent.click(row);
    expect(onClick).toHaveBeenCalledOnce();
  });
});

describe('TopNavigationBar', () => {
  it('renders an app bar with a back button', () => {
    const onLeading = vi.fn();
    render(<TopNavigationBar title="Chat" subtitle="Amina" onLeading={onLeading} />);
    expect(screen.getByText('Chat')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(onLeading).toHaveBeenCalledOnce();
  });
});

describe('BottomNavigationBar', () => {
  const items = [
    { id: 'home', label: 'Home' },
    { id: 'orders', label: 'Orders', badge: 120 },
    { id: 'profile', label: 'Profile' },
  ];

  it('marks the active tab and truncates badges', () => {
    render(<BottomNavigationBar items={items} defaultCurrent="home" label="App tabs" />);
    const nav = screen.getByRole('navigation', { name: 'App tabs' });
    expect(nav).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Home' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: 'Orders, 99+' })).toBeInTheDocument();
  });

  it('emits onChange on tab selection', () => {
    const onChange = vi.fn();
    render(<BottomNavigationBar items={items} defaultCurrent="home" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Profile' }));
    expect(onChange).toHaveBeenCalledWith('profile');
  });
});