import type { PaginationMeta } from '../../lib/api/client';

/**
 * Messages (Inbox/Conversations) wire models.
 *
 * The backend stores threads in the `conversations` table — `message-threads`
 * is the API-facing name. Threads list via offset pagination; chat history is
 * cursor based, newest page first (`id`-desc base64url cursor).
 */

export type ConversationStatus = 'BOT' | 'HANDLED' | 'CLOSED';

export type MessageDirection = 'INBOUND' | 'OUTBOUND';

export type MessageType =
  | 'TEXT'
  | 'IMAGE'
  | 'AUDIO'
  | 'VIDEO'
  | 'DOCUMENT'
  | 'LOCATION'
  | 'TEMPLATE'
  | 'INTERACTIVE';

export type MessageStatus =
  | 'QUEUED'
  | 'SENT'
  | 'DELIVERED'
  | 'READ'
  | 'FAILED'
  | 'RECEIVED';

export interface ThreadCustomer {
  id: string;
  name: string | null;
  waPhone: string;
}

export interface Thread {
  id: string;
  storeId: string;
  customerId: string;
  waPhone: string;
  status: ConversationStatus;
  botEnabled: boolean;
  assignedUserId: string | null;
  unreadCount: number;
  lastMessageAt: string;
  lastMessagePreview: string | null;
  createdAt: string;
  updatedAt: string;
  customer: ThreadCustomer | null;
}

export interface Message {
  id: string;
  conversationId: string;
  direction: MessageDirection;
  type: MessageType;
  body: string | null;
  mediaUrl: string | null;
  templateName: string | null;
  waMessageId: string | null;
  status: MessageStatus;
  sentByBot: boolean;
  errorReason: string | null;
  createdAt: string;
}

export interface MessageAttachment {
  id: string;
  url: string;
  mimeType: string;
  fileName: string;
}

export interface MessageWithAttachments extends Message {
  attachments: MessageAttachment[];
}

export interface ChatPage {
  items: Message[];
  nextCursor: string | null;
}

export interface ThreadsListResult {
  items: Thread[];
  meta: PaginationMeta;
}

export type ThreadStatusFilter = ConversationStatus | 'ALL';

export interface ListThreadsParams {
  page?: number;
  pageSize?: number;
  status?: ConversationStatus;
  q?: string;
  assignedToMe?: boolean;
}

// --- AI configuration -------------------------------------------------------

export type AiTone = 'FRIENDLY' | 'PROFESSIONAL' | 'PLAYFUL' | 'CONCISE';

export interface WorkingHours {
  start: string;
  end: string;
  days: number[];
}

export interface AiConfiguration {
  id: string;
  storeId: string;
  isEnabled: boolean;
  tone: AiTone;
  languages: string[];
  businessContext: string | null;
  autoReplyEnabled: boolean;
  workingHours: WorkingHours | Record<string, never>;
  outOfOfficeBody: string | null;
  escalationKeywords: string[];
  primaryModel: string;
  fallbackModel: string;
  temperature: number | string;
  maxTokens: number;
  dailyTokenBudget: number;
  semanticCacheEnabled: boolean;
  confidenceThreshold: number | string;
  createdAt: string;
  updatedAt: string;
}

export interface AiConfigUpdateInput {
  isEnabled?: boolean;
  autoReplyEnabled?: boolean;
  tone?: AiTone;
  languages?: string[];
  businessContext?: string | null;
  outOfOfficeBody?: string | null;
  escalationKeywords?: string[];
  workingHours?: WorkingHours;
  confidenceThreshold?: number;
  primaryModel?: string;
  fallbackModel?: string;
}

export interface AiTestResult {
  intent: string;
  confidence: number;
  entities: Record<string, unknown>;
  language: string;
  withinSessionWindow: boolean;
  wouldEscalate: boolean;
  draftReply: string;
}

export interface AiIntent {
  id: string;
  storeId: string;
  name: string;
  keywords: string[];
  sampleUtterances: string[];
  cannedResponse: string | null;
  priority: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AiIntentInput {
  name: string;
  keywords: string[];
  sampleUtterances?: string[];
  cannedResponse?: string | null;
  priority?: number;
  isActive?: boolean;
}

export interface AiDraft {
  intent: string;
  language: string;
  groundedProducts: string[];
  draft: string;
  source: string;
  tone: AiTone;
}

export interface AiDetectResult {
  intent: string;
  confidence: number;
  matchedKeywords: string[];
  entities: Record<string, unknown>;
  language: string;
}

// --- escalations ------------------------------------------------------------

export type EscalationReason =
  | 'LOW_CONFIDENCE'
  | 'COMPLAINT'
  | 'REFUND_REQUEST'
  | 'PAYMENT_ISSUE'
  | 'CUSTOM_QUOTE'
  | 'HUMAN_REQUESTED'
  | 'NEGATIVE_SENTIMENT';

export type EscalationStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'DISMISSED';

export interface Escalation {
  id: string;
  storeId: string;
  threadId: string;
  messageId: string | null;
  reason: EscalationReason;
  status: EscalationStatus;
  notes: string | null;
  assignedUserId: string | null;
  resolvedById: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  thread: { waPhone: string; lastMessagePreview: string | null; customerId: string } | null;
}

export interface EscalationCreateInput {
  threadId: string;
  messageId?: string;
  reason: EscalationReason;
  notes?: string;
}

// --- stats ------------------------------------------------------------------

export interface MessageStats {
  totalThreads: number;
  activeThreads: number;
  botThreads: number;
  handledThreads: number;
  closedThreads: number;
  totalMessages: number;
  inboundMessages: number;
  outboundMessages: number;
  botReplies: number;
  humanReplies: number;
  openEscalations: number;
  avgResponseLatencyMs: number;
  aiResolutionRate: number;
  topIntents: Array<{ intent: string; count: number }>;
  messagesByDay: Array<{ date: string; count: number }>;
}
