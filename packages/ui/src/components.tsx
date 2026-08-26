'use client';

import React from 'react';
import { tokens } from './tokens';

/**
 * Framework-agnostic web primitives — intentionally tiny.
 * Apps compose these into their own design systems; the kit only owns
 * the tokens and the a11y-critical wiring (focus rings, disabled states).
 */

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'danger';
};

export function Button({ variant = 'primary', style, ...props }: ButtonProps) {
  const base: React.CSSProperties = {
    borderRadius: tokens.radius.md,
    padding: '10px 16px',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    border: 'none',
    transition: 'background-color 120ms ease',
  };
  const variants: Record<string, React.CSSProperties> = {
    primary: { ...base, background: tokens.color.brand, color: '#fff' },
    secondary: {
      ...base,
      background: '#fff',
      color: tokens.color.ink,
      border: `1px solid ${tokens.color.muted}55`,
    },
    danger: { ...base, background: tokens.color.danger, color: '#fff' },
  };
  return (
    <button
      {...props}
      style={{
        ...variants[variant],
        opacity: props.disabled ? 0.5 : 1,
        pointerEvents: props.disabled ? 'none' : undefined,
        ...style,
      }}
    />
  );
}

export function Card({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={className}
      style={{
        background: '#fff',
        border: `1px solid #e2e8f0`,
        borderRadius: tokens.radius.lg,
        padding: 20,
        boxShadow: '0 1px 2px rgb(0 0 0 / 0.05)',
      }}
    >
      {children}
    </div>
  );
}
