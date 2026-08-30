import { type CSSProperties } from 'react';
import { cn } from '../../lib/cn';
import { sem } from '../../lib/styles';
import { Avatar } from './Avatar';

/**
 * AvatarGroup — overlapping stack of avatars with a "more" overflow badge.
 */
export interface AvatarGroupProps {
  people: Array<{ name: string; src?: string; alt?: string }>;
  /** Max avatars shown before overflowing to "+N". */
  max?: number;
  size?: number;
  overlap?: number;
  className?: string;
  style?: CSSProperties;
}

export function AvatarGroup({ people, max = 4, size = 40, overlap = 10, className, style }: AvatarGroupProps) {
  const shown = people.slice(0, max);
  const rest = people.length - shown.length;

  return (
    <div className={cn('wco-avatar-group', className)} style={{ display: 'flex', alignItems: 'center', paddingLeft: overlap, ...style }}>
      {shown.map((p, i) => (
        <span key={i} style={{ marginLeft: i === 0 ? -overlap : -overlap, zIndex: shown.length - i, border: `2px solid ${sem('surface')}`, borderRadius: '50%', boxSizing: 'content-box' }}>
          <Avatar name={p.name} src={p.src} alt={p.alt} size={size} />
        </span>
      ))}
      {rest > 0 && (
        <span
          aria-label={`+${rest} more`}
          role="img"
          style={{
            marginLeft: -overlap,
            width: size,
            height: size,
            borderRadius: '50%',
            background: sem('bgSunken'),
            border: `2px solid ${sem('surface')}`,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 600,
            fontSize: size * 0.34,
            color: sem('textMuted'),
            boxSizing: 'content-box',
          }}
        >
          +{rest}
        </span>
      )}
    </div>
  );
}

export default AvatarGroup;
