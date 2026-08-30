import { useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { motion, sem } from '../../lib/styles';
import { radii } from '../../design-tokens/layout';
import { mergeStrings, useWcoI18n, type CoreStrings } from '../../lib/i18n';
import { Icon } from '../Icon';

export interface FileError {
  code: 'size' | 'type';
  message: string;
  fileName: string;
}

export interface FileUploadProps {
  onFiles?: (files: File[]) => void;
  onError?: (errors: FileError[]) => void;
  multiple?: boolean;
  accept?: string;
  /** Max per-file size in bytes. */
  maxSize?: number;
  disabled?: boolean;
  /** Heading inside the dropzone. */
  label?: string;
  /** Helper line under the heading. */
  hint?: string;
  icon?: ReactNode;
  className?: string;
  style?: CSSProperties;
  strings?: Partial<CoreStrings>;
}

function formatSize(bytes: number): string {
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${bytes} B`;
}

function validateFiles(files: readonly File[], accept: string | undefined, maxSize: number | undefined): File[] {
  const allowed = accept?.split(',').map((a) => a.trim()).filter(Boolean) ?? null;
  const matchesType = (file: File): boolean => {
    if (!allowed || allowed.length === 0) return true;
    return allowed.some((rule) => {
      if (rule.endsWith('/*')) return file.type.startsWith(rule.slice(0, -1));
      return file.type === rule || file.name.toLowerCase().endsWith(rule.toLowerCase());
    });
  };
  return files.filter((file) => (maxSize === undefined || file.size <= maxSize) && matchesType(file));
}

/**
 * FileUpload â€” accessible drag-and-drop target. Mouse, touch, keyboard and a
 * hidden native picker all converge on the same typed validation pipeline
 * (`accept` + `maxSize`), with failures routed to `onError` for in-form surfacing.
 */
export function FileUpload({
  onFiles,
  onError,
  multiple = false,
  accept,
  maxSize,
  disabled = false,
  label,
  hint,
  icon,
  className,
  style,
  strings,
}: FileUploadProps) {
  const { t } = useWcoI18n();
  const ui = mergeStrings(t, strings);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragging, setDragging] = useState(false);

  const handleFiles = (incoming: readonly File[]) => {
    if (incoming.length === 0) return;
    const valid = validateFiles(incoming, accept, maxSize);
    const rejected = incoming.filter((f) => !valid.includes(f));
    if (rejected.length > 0) {
      onError?.(
        rejected.map((file) => ({
          code: file.size > (maxSize ?? Infinity) ? 'size' : 'type',
          message: file.size > (maxSize ?? Infinity) ? `"${file.name}" exceeds ${formatSize(maxSize ?? 0)}` : `"${file.name}" isn't an allowed file type`,
          fileName: file.name,
        })),
      );
    }
    if (valid.length > 0) onFiles?.(multiple ? valid : valid.slice(0, 1));
  };

  const openPicker = () => inputRef.current?.click();

  const dropzone: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: '28px 24px',
    border: `2px dashed ${dragging ? sem('primary') : sem('borderStrong')}`,
    borderRadius: radii.lg,
    background: dragging ? sem('primarySoft') : sem('bgSunken'),
    color: sem('textMuted'),
    cursor: disabled ? 'default' : 'pointer',
    textAlign: 'center',
    transition: `border-color ${motion.fast}, background-color ${motion.fast}`,
    ...style,
  };

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled || undefined}
      aria-label={label ?? ui.upload}
      onClick={() => !disabled && openPicker()}
      onKeyDown={(e) => {
        if (disabled) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openPicker();
        }
      }}
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        if (disabled) return;
        handleFiles(Array.from(e.dataTransfer.files));
      }}
      className={cn('wco-file-upload', className)}
      style={dropzone}
    >
      <input
        ref={inputRef}
        type="file"
        multiple={multiple}
        accept={accept}
        disabled={disabled}
        style={{ display: 'none' }}
        aria-hidden
        tabIndex={-1}
        onChange={(e) => {
          const picked = Array.from(e.target.files ?? []);
          e.target.value = '';
          handleFiles(picked);
        }}
      />
      <span aria-hidden style={{ color: dragging ? sem('primary') : sem('textFaint') }}>
        {icon ?? <Icon name="upload" size="lg" />}
      </span>
      <span style={{ fontWeight: 600, color: sem('text'), fontFamily: 'var(--font-inter, system-ui)' }}>
        {label ?? ui.dropFile}
      </span>
      {hint && <span style={{ fontSize: 13 }}>{hint}</span>}
      <span style={{ fontSize: 13, color: sem('primary'), fontWeight: 600 }}>{ui.chooseFile}</span>
    </div>
  );
}