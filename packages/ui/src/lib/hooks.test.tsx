import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useControllableState, useCounter, usePrevious, useId } from './hooks';

describe('useId', () => {
  it('returns a scoped, colon-free id', () => {
    const { result } = renderHook(() => useId('field'));
    expect(result.current).toMatch(/^field-/);
    expect(result.current).not.toContain(':');
  });
});

describe('useControllableState', () => {
  it('uses the default value when uncontrolled', () => {
    const { result } = renderHook(() => useControllableState<number>({ defaultValue: 5 }));
    expect(result.current[0]).toBe(5);
  });

  it('updates internal state on set without onChange (uncontrolled)', () => {
    const { result } = renderHook(() => useControllableState<number>({ defaultValue: 0 }));
    act(() => result.current[1](10));
    expect(result.current[0]).toBe(10);
  });

  it('calls onChange with the new value', () => {
    const onChange = vi.fn();
    const { result } = renderHook(() => useControllableState<number>({ defaultValue: 0, onChange }));
    act(() => result.current[1](3));
    expect(onChange).toHaveBeenCalledWith(3);
  });

  it('does not notify when the value is unchanged', () => {
    const onChange = vi.fn();
    const { result } = renderHook(() => useControllableState<number>({ defaultValue: 7, onChange }));
    act(() => result.current[1](7));
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('useCounter', () => {
  it('starts at the default', () => {
    const { result } = renderHook(() => useCounter({ defaultValue: 4 }));
    expect(result.current.value).toBe(4);
  });

  it('increments respecting max', () => {
    const { result } = renderHook(() => useCounter({ defaultValue: 4, max: 5, step: 1 }));
    act(() => result.current.increment());
    expect(result.current.value).toBe(5);
    act(() => result.current.increment());
    expect(result.current.value).toBe(5);
  });

  it('decrements respecting min', () => {
    const { result } = renderHook(() => useCounter({ defaultValue: 1, min: 0 }));
    act(() => result.current.decrement());
    expect(result.current.value).toBe(0);
    act(() => result.current.decrement());
    expect(result.current.value).toBe(0);
  });
});

describe('usePrevious', () => {
  it('returns undefined initially then the prior value', () => {
    const { result, rerender } = renderHook(({ v }) => usePrevious(v), { initialProps: { v: 'a' } });
    expect(result.current).toBeUndefined();
    rerender({ v: 'b' });
    expect(result.current).toBe('a');
  });
});
