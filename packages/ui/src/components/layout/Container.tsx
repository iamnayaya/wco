import { cn } from '../../lib/cn';
import { box, type BoxBaseProps } from '../../lib/polymorphic';
import { containers, type Container as ContainerType } from '../../design-tokens/layout-system';

/**
 * Container — a max-width centered "page rail" with responsive gutters.
 * Choose a rail via `width` (narrow/prose/app/wide, defaults to `app`), or
 * override with an explicit `maxWidth`.
 */
export interface ContainerProps extends BoxBaseProps {
  /** Predefined page rail from the layout system. */
  variant?: ContainerType;
  /** Explicit max-width, overrides `variant`. */
  maxWidth?: number | string;
  /** Horizontal gutter (px). Defaults to the grid's mobile margin. */
  px?: number;
}

export const Container = box<ContainerProps>(({ as: Tag = 'div', variant = 'app', maxWidth, px = 16, style, className, children }, ref) => (
  <Tag
    ref={ref}
    className={cn('wco-container', className)}
    style={{
      width: '100%',
      marginInline: 'auto',
      maxWidth: maxWidth ?? containers[variant],
      paddingInline: px,
      ...style,
    }}
  >
    {children}
  </Tag>
));
Container.displayName = 'Container';

export default Container;
