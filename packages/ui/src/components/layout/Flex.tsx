import { cn } from '../../lib/cn';
import { box, type BoxBaseProps } from '../../lib/polymorphic';

/**
 * Flex — a flexbox layout primitive with the full flex shorthand set.
 * Pass `as` to render another element (div/article/nav/ol…).
 */
export interface FlexProps extends BoxBaseProps {
  inline?: boolean;
  column?: boolean;
  wrap?: boolean;
  /** main-axis alignment. */
  justify?: 'start' | 'center' | 'end' | 'space-between' | 'space-around' | 'space-evenly';
  /** cross-axis alignment. */
  align?: 'start' | 'center' | 'end' | 'stretch' | 'baseline';
  gap?: number | string;
}

export const Flex = box<FlexProps>(({ as: Tag = 'div', inline = false, column = false, wrap = false, justify, align, gap, style, className, children }, ref) => (
  <Tag
    ref={ref}
    className={cn('wco-flex', className)}
    style={{
      display: inline ? 'inline-flex' : 'flex',
      flexDirection: column ? 'column' : 'row',
      flexWrap: wrap ? 'wrap' : 'nowrap',
      justifyContent: justify,
      alignItems: align,
      gap,
      minWidth: 0,
      ...style,
    }}
  >
    {children}
  </Tag>
));
Flex.displayName = 'Flex';

export default Flex;
