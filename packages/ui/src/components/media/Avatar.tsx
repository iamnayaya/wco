import { useState, type CSSProperties } from 'react';
import { cn } from '../../lib/cn';
import { sem } from '../../lib/styles';

/**
 * Avatar — a circular initial/photo avatar with deterministic color fallback
 * when no image is present (or it fails to load).
 */
export interface AvatarProps {
  name: string;
  src?: string;
  alt?: string;
  /** In px (default 40). */
  size?: number;
  /** Show an online status dot. */
  status?: 'online' | 'offline' | 'away';
  className?: string;
  style?: CSSProperties;
}

const PALETTE = ['#059669', '#2563eb', '#d97706', '#dc2626', '#7c3aed', '#0891b2'];

function colorFor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function Avatar({ name, src, alt, size = 40, status, className, style }: AvatarProps) {
  const [failed, setFailed] = useState(false);
  const showImage = src && !failed;
  const bg = colorFor(name);

  return (
    <span className={cn('wco-avatar', className)} style={{ position: 'relative', display: 'inline-flex', flexShrink: 0, ...style }}>
      <span
        role="img"
        aria-label={alt ?? name}
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          overflow: 'hidden',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: showImage ? 'transparent' : bg,
          color: '#fff',
          fontWeight: 600,
          fontSize: size * 0.4,
          border: `1px solid ${sem('border')}`,
          userSelect: 'none',
        }}
      >
        {showImage ? (
          <img src={src} alt="" onError={() => setFailed(true)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          initials(name)
        )}
      </span>
      {status && (
        <span
          aria-label={status}
          title={status}
          style={{
            position: 'absolute',
            right: 0,
            bottom: 0,
            width: size * 0.28,
            height: size * 0.28,
            borderRadius: '50%',
            background: status === 'online' ? '#22c55e' : status === 'away' ? '#eab308' : '#9ca3af',
            border: `2px solid ${sem('surface')}`,
            boxSizing: 'border-box',
          }}
        />
      )}
    </span>
  );
}

export default Avatar;
