import { forwardRef, useEffect, useRef, type CSSProperties, type TextareaHTMLAttributes } from 'react';
import { cn } from '../lib/cn';
import { controlSize, controlBorderRadius, focusRing, sem, type ControlSize } from '../lib/styles';

export interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  size?: ControlSize;
  error?: boolean;
  /** Grow with content up to `maxRows`. */
  autoResize?: boolean;
}

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(function TextArea(
  { size = 'md', error = false, autoResize = false, className, style, rows = 4, ...props },
  ref,
) {
  const s = controlSize[size];
  const innerRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!autoResize) return;
    const el = ref && typeof ref === 'function' ? null : innerRef.current;
    const target = (typeof ref === 'object' && ref?.current) || el;
    if (!target) return;
    target.style.height = 'auto';
    target.style.height = `${target.scrollHeight}px`;
  });

  const base: CSSProperties = {
    width: '100%',
    paddingInline: s.px,
    paddingBlock: s.gap,
    minHeight: s.height * 1.6,
    fontSize: s.fontSize,
    lineHeight: 1.5,
    fontFamily: 'var(--font-inter, system-ui)',
    color: sem('text'),
    background: sem('surface'),
    border: `1px solid ${error ? sem('dangerText') : sem('borderStrong')}`,
    borderRadius: controlBorderRadius[size],
    resize: 'vertical',
    transition: 'border-color 120ms ease',
    ...style,
  };

  return (
    <textarea
      ref={ref ?? innerRef}
      rows={rows}
      aria-invalid={error || undefined}
      className={cn('wco-textarea', className)}
      style={base}
      {...props}
    />
  );
});