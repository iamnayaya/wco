import { useState, type CSSProperties, type ImgHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';
import { sem } from '../../lib/styles';

/**
 * Image — a lazy-loading, aspect-ratio-fixed, fallback-capable image with a
 * built-in shimmer placeholder and graceful error state.
 */
export interface ImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'onError'> {
  /** Maintain an aspect ratio (e.g. '16 / 9', 1, 0.75) until loaded. */
  ratio?: number | string;
  /** Fallback rendered when the source fails. */
  fallback?: React.ReactNode;
  className?: string;
  style?: CSSProperties;
}

export function Image({ ratio, src, alt, fallback, className, style, loading = 'lazy', ...props }: ImageProps) {
  const [state, setState] = useState<'loading' | 'loaded' | 'error'>('loading');

  return (
    <div
      className={cn('wco-image', className)}
      style={{
        position: 'relative',
        width: '100%',
        overflow: 'hidden',
        aspectRatio: ratio !== undefined ? ratio : undefined,
        background: sem('bgSunken'),
        ...style,
      }}
    >
      {state === 'loading' && (
        <div aria-hidden style={{ position: 'absolute', inset: 0, background: `linear-gradient(90deg, ${sem('bgSunken')} 25%, ${sem('surfaceHover')} 50%, ${sem('bgSunken')} 75%)`, animation: 'wco-img-shimmer 1.4s ease-in-out infinite', backgroundSize: '200% 100%' }}>
          <style>{`@keyframes wco-img-shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>
        </div>
      )}
      {state !== 'error' ? (
        <img
          src={src}
          alt={alt}
          loading={loading}
          onLoad={() => setState('loaded')}
          onError={() => setState('error')}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: state === 'loaded' ? 1 : 0, transition: 'opacity 200ms ease' }}
          {...props}
        />
      ) : (
        fallback ?? (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: sem('textFaint') }}>
            <svg viewBox="0 0 24 24" width={32} height={32} fill="none" stroke="currentColor" strokeWidth={1.5}><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" /></svg>
          </div>
        )
      )}
    </div>
  );
}

export default Image;
