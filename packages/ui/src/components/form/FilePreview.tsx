import { type CSSProperties } from 'react';
import { cn } from '../../lib/cn';
import { motion, sem } from '../../lib/styles';
import { radii } from '../../design-tokens/layout';
import { useWcoI18n } from '../../lib/i18n';
import { Icon } from '../Icon';

export interface PreviewFile {
  name: string;
  size: number;
  type?: string;
  /** Object URL or remote src â€” renders as an image thumbnail. */
  url?: string;
}

export interface FilePreviewProps {
  file: PreviewFile;
  onRemove?: () => void;
  size?: 'sm' | 'md';
  className?: string;
  style?: CSSProperties;
}

function formatSize(bytes: number): string {
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${bytes} B`;
}

function kindIcon(type: string | undefined): string {
  if (!type) return 'file';
  if (type.startsWith('image/')) return 'image';
  if (type.startsWith('video/')) return 'video';
  if (type.startsWith('audio/')) return 'voice';
  if (type.includes('pdf')) return 'file';
  return 'file';
}

/**
 * FilePreview â€” a thumbnail chip for a staged upload. Shows an image
 * thumbnail when `url` + `image/*`, otherwise the file type icon, name,
 * formatted size and a remove affordance. Locale-aware size via Intl-free
 * helpers (KB/MB printed per size).
 */
export function FilePreview({ file, onRemove, size = 'md', className, style }: FilePreviewProps) {
  const { t } = useWcoI18n();
  const isImage = Boolean(file.type?.startsWith('image/') && file.url);
  const parent: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: size === 'sm' ? '6px 10px' : '8px 12px',
    background: sem('surface'),
    border: `1px solid ${sem('border')}`,
    borderRadius: radii.md,
    width: '100%',
    transition: `border-color ${motion.fast}, box-shadow ${motion.fast}`,
    ...style,
  };

  return (
    <div className={cn('wco-file-preview', className)} style={parent}>
      {isImage ? (
        <img
          src={file.url}
          alt=""
          width={34}
          height={34}
          style={{ borderRadius: radii.sm, objectFit: 'cover', flexShrink: 0 }}
        />
      ) : (
        <span
          aria-hidden
          style={{
            width: 34,
            height: 34,
            flexShrink: 0,
            borderRadius: radii.sm,
            background: sem('bgSunken'),
            color: sem('textFaint'),
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name={kindIcon(file.type)} />
        </span>
      )}
      <span style={{ flex: 1, minWidth: 0 }}>
        <span
          style={{
            display: 'block',
            fontSize: 14,
            fontWeight: 600,
            fontFamily: 'var(--font-inter, system-ui)',
            color: sem('text'),
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {file.name}
        </span>
        <span style={{ display: 'block', fontSize: 12, color: sem('textMuted') }}>
          {file.type ? `${file.type.split('/')[0]} â€¢ ` : ''}
          {formatSize(file.size)}
        </span>
      </span>
      {onRemove && (
        <button
          type="button"
          aria-label={`${t.remove} ${file.name}`}
          onClick={onRemove}
          style={{
            border: 'none',
            background: 'transparent',
            color: sem('textFaint'),
            cursor: 'pointer',
            display: 'inline-flex',
            padding: 4,
            flexShrink: 0,
          }}
        >
          <Icon name="close" aria-hidden />
        </button>
      )}
    </div>
  );
}