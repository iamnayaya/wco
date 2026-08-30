import { useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { cn } from '../lib/cn';
import { sem } from '../lib/styles';
import { useControllableState } from '../lib/hooks';

/**
 * TagInput — enter/format tags from free text; renders removable chips with
 * keyboard support (Enter to add, Backspace on empty to remove last, Escape to
 * clear the draft).
 */
export interface TagInputProps {
  value?: string[];
  defaultValue?: string[];
  onChange?: (tags: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  error?: boolean;
  /** What characters split a pasted/typed list (default comma+Enter). */
  separators?: string[];
  maxTags?: number;
  /** Normalize tags (e.g. trim + lowercase). */
  normalize?: (tag: string) => string;
  className?: string;
  style?: CSSProperties;
  'aria-label'?: string;
  id?: string;
}

export const TagInput = (props: TagInputProps) => {
  const {
    value,
    defaultValue = [],
    onChange,
    placeholder = 'Type and press Enter',
    disabled = false,
    error = false,
    separators = [','],
    maxTags,
    normalize = (t) => t.trim(),
    className,
    style,
    'aria-label': ariaLabel = 'Tags',
    id,
  } = props;
  const [tags, setTags] = useControllableState<string[]>({ value, defaultValue, onChange });
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const commit = (raw: string) => {
    const trimmed = normalize(raw);
    if (!trimmed) return;
    let next = [...tags];
    const parts = trimmed.split(new RegExp(`[${separators.map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('')}]`, 'g')).map(normalize).filter(Boolean);
    for (const p of parts) {
      if (next.length === maxTags) break;
      if (!next.includes(p)) next = [...next, p];
    }
    setTags(next);
    setDraft('');
  };

  const remove = (idx: number) => {
    const next = tags.filter((_, i) => i !== idx);
    setTags(next);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commit(draft);
    } else if (e.key === 'Backspace' && !draft && tags.length) {
      remove(tags.length - 1);
    } else if (e.key === 'Escape') {
      setDraft('');
      (e.target as HTMLInputElement).blur();
    } else if (separators.includes(e.key)) {
      e.preventDefault();
      commit(draft);
    }
  };

  return (
    <div
      className={cn('wco-tag', className)}
      tabIndex={disabled ? -1 : 0}
      onClick={() => inputRef.current?.focus()}
      id={id}
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 6,
        alignItems: 'center',
        padding: '6px 8px',
        background: sem('surface'),
        border: `1px solid ${error ? sem('dangerText') : sem('borderStrong')}`,
        borderRadius: 10,
        cursor: 'text',
        ...style,
      }}
    >
      {tags.map((t, i) => (
        <span
          key={`${t}-${i}`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '2px 8px',
            background: sem('accent'),
            color: sem('accentFg'),
            borderRadius: 999,
            fontSize: 13,
            fontWeight: 500,
          }}
        >
          {t}
          <button
            type="button"
            aria-label={`Remove ${t}`}
            tabIndex={-1}
            onClick={(e) => {
              e.stopPropagation();
              remove(i);
            }}
            style={{ border: 'none', background: 'transparent', color: 'inherit', cursor: 'pointer', padding: 0, display: 'inline-flex' }}
          >
            <svg viewBox="0 0 24 24" width={12} height={12} fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
          </button>
        </span>
      ))}
      <input
        ref={inputRef}
        value={draft}
        disabled={disabled}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => draft && commit(draft)}
        placeholder={tags.length === 0 ? placeholder : ''}
        aria-label={ariaLabel}
        style={{
          flex: '1 1 120px',
          minWidth: 120,
          border: 'none',
          outline: 'none',
          background: 'transparent',
          fontFamily: 'var(--font-inter, system-ui)',
          fontSize: 14,
          color: sem('text'),
        }}
      />
    </div>
  );
};
