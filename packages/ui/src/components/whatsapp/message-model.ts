import { useCallback, useRef, useState } from 'react';

/**
 * WCO WhatsApp message model — shared types + a tiny state helper for
 * conversation threads. Kept framework-agnostic (plain React state) so it can
 * power both the `MessageThread` component and app-level chat state.
 */
export type MessageSender = 'customer' | 'business' | 'system';

export type MessageStatus = 'sent' | 'delivered' | 'read';

export interface Message {
  id: string | number;
  sender: MessageSender;
  body: string;
  timestamp: number | string;
  status?: MessageStatus;
}

export interface Conversation {
  id: string | number;
  customerName: string;
  customerAvatar?: string;
  phone: string;
  lastMessage?: string;
  lastTimestamp?: number | string;
  unread?: number;
  status?: 'online' | 'offline' | 'away';
}

export interface ChatContact {
  name: string;
  phone: string;
  src?: string;
  status?: 'online' | 'offline' | 'away';
}

/** A minimal conversation-state hook: list of messages + helpers. */
export function useConversationMessages(initial: Message[] = []) {
  const [messages, setMessages] = useState<Message[]>(initial);
  const counter = useRef(0);

  const append = useCallback((message: Omit<Message, 'id' | 'timestamp'>) => {
    const id = `m-${Date.now()}-${++counter.current}`;
    setMessages((prev) => [...prev, { ...message, id, timestamp: Date.now() }]);
  }, []);

  const update = useCallback((id: Message['id'], patch: Partial<Message>) => {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  }, []);

  const clear = useCallback(() => setMessages([]), []);
  const reset = useCallback((next: Message[]) => setMessages(next), []);

  return { messages, append, update, clear, reset, setMessages };
}

export default Message;
