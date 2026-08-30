import { type CSSProperties, type ElementType, type ReactNode } from 'react';

/**
 * Polymorphic helper — a tiny, dependency-free analogue of `styled-components'`
 * polymorphic `as` prop. `box()` takes a render function whose first argument
 * includes `as` (the element to render) and forwards a ref.
 */

export interface BoxBaseProps {
  as?: ElementType;
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

/**
 * Create a polymorphic component. The returned component accepts:
 * - `as` — element/component to render as (default `div`)
 * - `style`/`className`/`children`
 * - any additional props (spread onto the rendered element)
 *
 * Types are intentionally pragmatic to avoid deep-generic blowups while still
 * giving autocomplete on `as` and the common box props.
 */
export function box<P extends object = object>(
  render: (props: BoxBaseProps & P, ref: React.Ref<unknown>) => ReactNode,
): React.ForwardRefExoticComponent<BoxBaseProps & P> {
  const Comp = (props: BoxBaseProps & P, ref: React.Ref<unknown>): ReactNode => {
    const { as: Tag = 'div', style, className, children, ...rest } = props;
    return render({ as: Tag, style, className, children, ...(rest as P) }, ref);
  };
  Comp.displayName = 'PolyBox';
  return Comp as React.ForwardRefExoticComponent<BoxBaseProps & P>;
}
