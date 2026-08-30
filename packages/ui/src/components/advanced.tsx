/**
 * WCO UI — Advanced Component Library.
 *
 * The "Advanced" tier: richer composition surfaces built on top of the core
 * primitives. Everything here honors the same contract — themed via
 * `sem()`/tokens, keyboard & screen-reader accessible, RTL/i18n aware, and
 * zero runtime dependencies beyond React.
 */

// Category: Action
export { useActionMenu, type UseActionMenuOptions } from './action/useActionMenu';
export { ActionMenu, MenuItems, type ActionMenuProps, type ActionMenuItem } from './action/ActionMenu';
export { SplitButton, type SplitButtonProps } from './action/SplitButton';
export { FloatingActionButton, type FloatingActionButtonProps, type FloatingActionItem, type FabVariant } from './action/FloatingActionButton';
export { ToggleGroup, type ToggleGroupProps, type ToggleOption } from './action/ToggleGroup';
export { CommandPalette, type CommandPaletteProps, type CommandGroup } from './action/CommandPalette';

// Category: Form
export { DatePicker, CalendarMonth, type DatePickerProps } from './form/DatePicker';
export { TimePicker, TimeColumns, type TimePickerProps } from './form/TimePicker';
export { DateTimePicker, type DateTimePickerProps } from './form/DateTimePicker';
export { FileUpload, type FileUploadProps, type FileError } from './form/FileUpload';
export { FilePreview, type FilePreviewProps, type PreviewFile } from './form/FilePreview';
export { ColorPicker, type ColorPickerProps } from './form/ColorPicker';
export { FormSection, type FormSectionProps } from './form/FormSection';

// Category: Layout
export { Panel, type PanelProps, type PanelVariant } from './layout/Panel';
export { Spacer, type SpacerProps } from './layout/Spacer';

// Category: Navigation
export { Navbar, type NavbarProps, type NavbarVariant } from './nav/Navbar';
export { Sidebar, type SidebarProps, type SidebarItem, type SidebarGroup } from './nav/Sidebar';
export { TabBar, type TabBarProps, type TabBarItem } from './nav/TabBar';
export { LinkList, type LinkListProps, type LinkListItem } from './nav/LinkList';

// Category: Data display
export { Kanban, type KanbanProps, type KanbanColumn, type KanbanCard } from './data/Kanban';
export { InfoCard, type InfoCardProps } from './data/InfoCard';
export { ProfileCard, type ProfileCardProps } from './data/ProfileCard';

// Category: Media
export { Carousel, type CarouselProps, type CarouselSlide } from './media/Carousel';

// Category: Feedback
export { StatusIndicator, type StatusIndicatorProps, type StatusKind } from './feedback/StatusIndicator';
export { CompletionIndicator, type CompletionIndicatorProps, type CompletionStatus } from './feedback/CompletionIndicator';
export { Kbd, type KbdProps } from './feedback/Kbd';

// Category: AI
export { AIPrediction, type AIPredictionProps } from './ai/AIPrediction';
export { AIRecommendation, type AIRecommendationProps } from './ai/AIRecommendation';
export { AIChat, type AIChatProps, type AiChatStrings, type AiChatMessage } from './ai/AIChat';

// Category: WhatsApp
export { ChatHeader, type ChatHeaderProps } from './whatsapp/ChatHeader';
export { MessageReactions, type MessageReactionsProps, type Reaction } from './whatsapp/MessageReactions';
export {
  MessageAttachment,
  type MessageAttachmentProps,
  type MessageAttachmentType,
} from './whatsapp/MessageAttachment';
export { MessagePreview, type MessagePreviewProps } from './whatsapp/MessagePreview';

// Category: Mobile
export { TopNavigationBar, type TopNavigationBarProps } from './mobile/TopNavigationBar';
export { BottomNavigationBar, type BottomNavigationBarProps, type BottomNavItem } from './mobile/BottomNavigationBar';