import { type CSSProperties } from 'react';
import { cn } from '../../lib/cn';
import { motion, sem } from '../../lib/styles';
import { radii } from '../../design-tokens/layout';
import { useWcoI18n } from '../../lib/i18n';
import { Icon } from '../Icon';
import type { IconName, IconSize } from '../../design-tokens/icons';

export type MessageAttachmentType = 'image' | 'video' | 'voice' | 'file';

export interface MessageAttachmentProps {
  type: MessageAttachmentType;
  /** File name (voice messages use a transcript/label). */
  name?: string;
  /** Human-readable size, e.g. "1.2 MB". */
  size?: string;
  /** Playback duration for voice/video. */
  duration?: string;
  /** Preview thumbnail/cover URL (image/video). */
  previewUrl?: string;
  fileType?: string;
  /** Primary action (open/download/play). */
  onAction?: () => void;
  /** Action label; defaulting to an icon glyph with the matching string. */
  actionLabel?: string;
  /** Download progress % (0â€“100) â€” shows a determinate bar. */
  progress?: number;
  error?: boolean;
  className?: string;
  style?: CSSProperties;
}

function glyph(type: MessageAttachmentType): { icon: IconName; size: IconSize } {
  switch (type) {
    case 'image':
      return { icon: 'image', size: 'lg' };
    case 'video':
      return { icon: 'video', size: 'lg' };
    case 'voice':
      return { icon: 'mic', size: 'lg' };
    default:
      return { icon: 'file', size: 'lg' };
  }
}

/**
 * MessageAttachment â€” a media/file card inside a chat thread: cover or
 * glyph tile, name + meta, error/download states, and a single action
 * button. `progress` renders a determinate progress region.
 */
export function MessageAttachment({
  type,
  name,
  size,
  duration,
  previewUrl,
  fileType,
  onAction,
  actionLabel,
  progress,
  error = false,
  className,
  style,
}: MessageAttachmentProps) {
  const { t } = useWcoI18n();
  const { icon, size: iconSize } = glyph(type);
  const downloading = progress !== undefined && progress < 100;

  return (
    <div
      role="group"
      aria-label={name ?? type}
      className={cn('wco-msg-attachment', className)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: 10,
        border: `1px solid ${error ? sem('dangerText') : sem('border')}`,
        borderRadius: radii.md,
        background: sem('surface'),
        maxWidth: 320,
        width: '100%',
        boxSizing: 'border-box',
        ...style,
      }}
    >
      {previewUrl && (type === 'image' || type === 'video') ? (
        <span
          aria-hidden
          style={{
            width: 52,
            height: 52,
            borderRadius: radii.sm,
            overflow: 'hidden',
            flexShrink: 0,
            background: sem('bgSunken'),
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <img src={previewUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </span>
      ) : (
        <span
          aria-hidden
          style={{
            width: 52,
            height: 52,
            borderRadius: radii.sm,
            flexShrink: 0,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: error ? `${sem('dangerText')}1f` : sem('bgSunken'),
            color: error ? sem('dangerText') : sem('textMuted'),
          }}
        >
          <Icon name={icon} size={iconSize} />
        </span>
      )}

      <span style={{ flex: 1, minWidth: 0 }}>
        <span
          style={{
            display: 'block',
            fontSize: 13.5,
            fontWeight: 600,
            color: sem('text'),
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {name ?? type}
        </span>
        <span style={{ display: 'block', marginTop: 2, fontSize: 11.5, color: error ? sem('dangerText') : sem('textFaint'), lineHeight: 1.4 }}>
          {[size, duration, fileType].filter(Boolean).join(' Â· ')}
          {error ? ` Â· ${t.failure}` : ''}
        </span>
        {downloading && (
          <span
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress)}
            aria-label={name ?? type}
            style={{ display: 'block', marginTop: 6, height: 4, borderRadius: 999, background: sem('bgSunken'), overflow: 'hidden' }}
          >
            <span
              style={{
                display: 'block',
                height: '100%',
                width: `${progress}%`,
                background: sem('primary'),
                borderRadius: 999,
                transition: `width ${motion.base}`,
              }}
            />
          </span>
        )}
      </span>

      <button
        type="button"
        aria-label={actionLabel ?? t.upload}
        onClick={onAction}
        disabled={downloading}
        style={{
          width: 36,
          height: 36,
          borderRadius: '50%',
          border: 'none',
          background: sem('primarySoft'),
          color: sem('primary'),
          cursor: downloading ? 'default' : 'pointer',
          opacity: downloading ? 0.5 : 1,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          padding: 0,
        }}
      >
        <Icon name={downloading ? 'download' : type === 'voice' ? 'chevronRight' : type === 'file' ? 'external' : 'download'} size="sm" aria-hidden />
      </button>
    </div>
  );
}