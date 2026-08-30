import { cn } from '../../lib/cn';
import { box, type BoxBaseProps } from '../../lib/polymorphic';
import { grid as gridTokens } from '../../design-tokens/layout-system';

/**
 * Grid — a responsive CSS-grid layout system backed by the WCO grid scale
 * (4/8/12/16 columns, 16px gutter). Items span via `col` props.
 */
export interface GridItemProps {
  /** Column span for default/base. */
  span?: number;
  col?: number;
}

export interface GridProps extends BoxBaseProps {
  /** Base column count (defaults to the token grid). */
  columns?: number;
  /** Gap (px). Defaults to the token gutter (16). */
  gap?: number;
  rowGap?: number;
  columnGap?: number;
  /** Align items. */
  align?: 'start' | 'center' | 'end' | 'stretch';
  /** Template areas (string) e.g. '"a b" "a c"'. */
  areas?: string;
}

export const Grid = box<GridProps>(({ as: Tag = 'div', columns = 12, gap, rowGap, columnGap, align = 'stretch', areas, style, className, children }, ref) => (
  <Tag
    ref={ref}
    className={cn('wco-grid', className)}
    style={{
      display: 'grid',
      gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
      gap,
      rowGap,
      columnGap,
      alignItems: align,
      gridTemplateAreas: areas,
      ...style,
    }}
  >
    {children}
  </Tag>
));
Grid.displayName = 'Grid';

export default Grid;
