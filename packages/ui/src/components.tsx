/**
 * WCO UI — component library barrel.
 *
 * Re-exports every primitive plus a `FALLBACK_VARS` map (the `--fallback-*`
 * custom-property bridge used by hosts that haven't loaded the theme layer
 * yet — see `src/lib/styles.ts` for how the triple fallback chain works).
 */

// Action
export { Button, type ButtonProps, type ButtonVariant } from './components/Button';
export {
  IconButton,
  type IconButtonProps,
  type IconButtonVariant,
  iconButtonHover,
} from './components/IconButton';
export { ButtonGroup, GroupSeparator, groupRadius, type ButtonGroupProps } from './components/ButtonGroup';
export { SegmentedControl, type SegmentedControlProps, type Segment } from './components/SegmentedControl';

// Form
export { Field, type FieldProps } from './components/Field';
export { Input, type InputProps } from './components/Input';
export { TextArea, type TextAreaProps } from './components/TextArea';
export { Select, type SelectProps, type SelectOption } from './components/Select';
export { Checkbox, type CheckboxProps } from './components/Checkbox';
export { Radio, RadioGroup, type RadioGroupProps, type RadioProps } from './components/Radio';
export { Switch, type SwitchProps } from './components/Switch';
export { Slider, type SliderProps, type SliderMark } from './components/Slider';

// Feedback
export { Alert, type AlertProps } from './components/Alert';
export { Badge, type BadgeProps } from './components/Badge';
export { Spinner, type SpinnerProps } from './components/Spinner';
export { Progress, type ProgressProps } from './components/Progress';
export { Skeleton, type SkeletonProps } from './components/Skeleton';

// Icon
export { Icon, type IconProps, isIconName } from './components/Icon';

// Layout
export { Stack, HStack, VStack, gapValue, type StackProps } from './components/Stack';
export { Card, type CardProps } from './components/Card';
export { Divider, type DividerProps } from './components/Divider';

// Data display
export { StatCard, type StatCardProps } from './components/StatCard';
export { EmptyState, type EmptyStateProps } from './components/EmptyState';

// WhatsApp surfaces
export { MessageBubble, type MessageBubbleProps, type MessageStatus } from './components/MessageBubble';

// ─────────────────────────────────────────────────────────────────────────
// Advanced library — form orchestration
// ─────────────────────────────────────────────────────────────────────────
export { InputGroup, type InputGroupProps } from './components/InputGroup';
export { PasswordInput, estimatePasswordStrength, type PasswordInputProps } from './components/PasswordInput';
export { SearchInput, type SearchInputProps } from './components/SearchInput';
export { NumberInput, type NumberInputProps } from './components/NumberInput';
export { CurrencyInput, type CurrencyInputProps } from './components/CurrencyInput';
export { PhoneInput, type PhoneInputProps } from './components/PhoneInput';
export { OTPInput, type OTPInputProps } from './components/OTPInput';
export { RatingInput, type RatingInputProps } from './components/RatingInput';
export { TagInput, type TagInputProps } from './components/TagInput';
export { RangeSlider, type RangeSliderProps } from './components/RangeSlider';
export { Form, FormContext, useFormContext, validators, required, type FormProps } from './components/Form';
export { FormField, type FormFieldProps } from './components/FormField';
export { FormWizard, type FormWizardProps, type FormWizardStep } from './components/FormWizard';

// ── Layout
export { Container, type ContainerProps } from './components/layout/Container';
export { Grid, type GridProps } from './components/layout/Grid';
export { Flex, type FlexProps } from './components/layout/Flex';
export { Modal, Dialog, type ModalProps } from './components/layout/Modal';
export { Drawer, type DrawerProps, type DrawerSide } from './components/layout/Drawer';
export { Tooltip, type TooltipProps } from './components/layout/Tooltip';
export { Popover, type PopoverProps } from './components/layout/Popover';

// ── Navigation
export { Breadcrumb, type BreadcrumbProps, type BreadcrumbItem } from './components/nav/Breadcrumb';
export { Pagination, type PaginationProps } from './components/nav/Pagination';
export { Tabs, type TabsProps, type TabItem } from './components/nav/Tabs';
export { Stepper, type StepperProps, type Step } from './components/nav/Stepper';
export { SkipLink, type SkipLinkProps } from './components/nav/SkipLink';

// ── Data display
export { DataTable, type DataTableProps, type DataColumn } from './components/data/DataTable';
export { Timeline, type TimelineProps, type TimelineItem } from './components/data/Timeline';
export { List, type ListProps, type ListItem } from './components/data/List';

// ── Feedback
export { ToastProvider, Toast, useToast, type ToastApi, type ToastData, type ToastOptions, type ToastTone } from './components/feedback/Toast';
export { ProgressCircle, type ProgressCircleProps } from './components/feedback/ProgressCircle';
export { ErrorBoundary, type ErrorBoundaryProps } from './components/feedback/ErrorBoundary';
export { SkeletonText, type SkeletonTextProps } from './components/feedback/SkeletonText';

// ── Media
export { Avatar, type AvatarProps } from './components/media/Avatar';
export { AvatarGroup, type AvatarGroupProps } from './components/media/AvatarGroup';
export { Image, type ImageProps } from './components/media/Image';

// ── AI
export { AISuggestion, type AISuggestionProps } from './components/ai/AISuggestion';
export { AIInsight, type AIInsightProps } from './components/ai/AIInsight';

// ── WhatsApp
export { MessageInput, type MessageInputProps } from './components/whatsapp/MessageInput';
export { MessageThread, type MessageThreadProps } from './components/whatsapp/MessageThread';
export { ChatList, type ChatListProps } from './components/whatsapp/ChatList';
export {
  type Message,
  type MessageSender,
  type MessageStatus as WcoMessageStatus,
  type Conversation,
  useConversationMessages,
} from './components/whatsapp/message-model';

// ── Mobile
export { BottomSheet, type BottomSheetProps } from './components/mobile/BottomSheet';
export { PullToRefresh, type PullToRefreshProps } from './components/mobile/PullToRefresh';
export { Swipeable, type SwipeableProps } from './components/mobile/Swipeable';
export { SafeArea, type SafeAreaProps } from './components/mobile/SafeArea';

// ─────────────────────────────────────────────────────────────────────────
// Advanced library — composition surfaces
// ─────────────────────────────────────────────────────────────────────────
export * from './components/advanced';

import { designTokens } from './design-tokens';

/** Constant fallbacks referenced by the CSS var chain (see components). */
export const FALLBACK_VARS: Record<string, string> = {
  '--fallback-primary': designTokens.color.systemLight.primary,
  '--fallback-primary-fg': designTokens.color.systemLight.primaryFg,
  '--fallback-primary-soft': designTokens.color.systemLight.primarySoft,
  '--fallback-primary-hover': designTokens.color.systemLight.primaryHover,
  '--fallback-secondary': designTokens.color.systemLight.secondary,
  '--fallback-secondary-fg': designTokens.color.systemLight.secondaryFg,
  '--fallback-accent': designTokens.color.systemLight.accent,
  '--fallback-accent-strong': designTokens.color.systemLight.accentStrong,
  '--fallback-accent-fg': designTokens.color.systemLight.accentFg,
  '--fallback-text': designTokens.color.systemLight.text,
  '--fallback-text-muted': designTokens.color.systemLight.textMuted,
  '--fallback-text-faint': designTokens.color.systemLight.textFaint,
  '--fallback-text-inverse': designTokens.color.systemLight.textInverse,
  '--fallback-border': designTokens.color.systemLight.border,
  '--fallback-border-strong': designTokens.color.systemLight.borderStrong,
  '--fallback-outline': designTokens.color.systemLight.outline,
  '--fallback-surface': designTokens.color.systemLight.surface,
  '--fallback-surface-hover': designTokens.color.systemLight.surfaceHover,
  '--fallback-surface-active': designTokens.color.systemLight.surfaceActive,
  '--fallback-bg': designTokens.color.systemLight.bg,
  '--fallback-bg-raised': designTokens.color.systemLight.bgRaised,
  '--fallback-bg-sunken': designTokens.color.systemLight.bgSunken,
  '--fallback-danger': designTokens.color.systemLight.dangerText,
  '--fallback-danger-text': designTokens.color.systemLight.dangerText,
  '--fallback-danger-bg': designTokens.color.systemLight.dangerBg,
  '--fallback-success-text': designTokens.color.systemLight.successText,
  '--fallback-success-bg': designTokens.color.systemLight.successBg,
  '--fallback-warning-text': designTokens.color.systemLight.warningText,
  '--fallback-warning-bg': designTokens.color.systemLight.warningBg,
  '--fallback-info-text': designTokens.color.systemLight.infoText,
  '--fallback-info-bg': designTokens.color.systemLight.infoBg,
  '--fallback-ring': designTokens.color.systemLight.ring,
};