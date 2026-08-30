import { type CSSProperties, type ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { motion, sem } from '../../lib/styles';
import { shadows, radii } from '../../design-tokens/layout';
import { Avatar, type AvatarProps } from '../media/Avatar';

export interface ProfileCardProps {
  name: string;
  avatar?: Omit<AvatarProps, 'name'>;
  title?: string;
  bio?: string;
  /** Meta rows (location, joined, verifiedâ€¦). */
  meta?: readonly ReactNode[];
  /** Trailing actions (follow, message, moreâ€¦). */
  actions?: ReactNode;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}

/**
 * ProfileCard â€” merchant/person identity card. Layers avatar + name/role,
 * an optional bio, meta chips, actions and a custom footer slot. The default
 * `div class="wco-profile-card"` keeps it surface-adaptive in both themes.
 */
export function ProfileCard({ name, avatar, title, bio, meta, actions, className, style, children }: ProfileCardProps) {
  return (
    <div
      className={cn('wco-profile-card', className)}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        padding: '18px',
        background: sem('surface'),
        border: `1px solid ${sem('border')}`,
        borderRadius: radii.lg,
        boxShadow: shadows.card,
        width: '100%',
        boxSizing: 'border-box',
        transition: `box-shadow ${motion.fast}`,
        ...style,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Avatar name={name} size={48} {...avatar} />
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontWeight: 700, fontSize: 15, fontFamily: 'var(--font-inter, system-ui)', color: sem('text') }}>{name}</span>
          {title && <span style={{ display: 'block', fontSize: 13, color: sem('textMuted') }}>{title}</span>}
        </span>
        {actions}
      </div>
      {bio && <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: sem('textMuted') }}>{bio}</p>}
      {meta && meta.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {meta.map((item, i) => (
            <span
              key={i}
              style={{
                fontSize: 12,
                color: sem('textMuted'),
                background: sem('bgSunken'),
                borderRadius: 999,
                padding: '3px 10px',
              }}
            >
              {item}
            </span>
          ))}
        </div>
      )}
      {children}
    </div>
  );
}