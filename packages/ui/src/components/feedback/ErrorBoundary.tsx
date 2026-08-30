import { Component, type CSSProperties, type ErrorInfo, type ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { sem } from '../../lib/styles';

/**
 * ErrorBoundary — a class-based error boundary that catches render errors in
 * its subtree and shows a friendly fallback, optionally logging via `onError`.
 * Required for resilient commerce UIs.
 */
export interface ErrorBoundaryProps {
  children: ReactNode;
  /** Fallback UI. Receives the error for reset context. */
  fallback?: (error: Error, reset: () => void) => ReactNode;
  /** Called with error + info when a boundary is hit (logging hook). */
  onError?: (error: Error, info: ErrorInfo) => void;
  /** When these change after an error, the boundary resets (e.g. retry keys). */
  resetKeys?: unknown[];
  className?: string;
  style?: CSSProperties;
}

interface State {
  error: Error | null;
}

/** Class component — error boundaries must be classes in React. */
export class ErrorBoundary extends Component<ErrorBoundaryProps, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.props.onError?.(error, info);
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps) {
    if (this.props.resetKeys && prevProps.resetKeys !== this.props.resetKeys && this.state.error) {
      this.reset();
    }
  }

  reset = (): void => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    if (this.props.fallback) return this.props.fallback(error, this.reset);

    return (
      <div
        role="alert"
        className={cn('wco-error-boundary', this.props.className)}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
          padding: 40,
          textAlign: 'center',
          background: sem('surface'),
          border: `1px solid ${sem('border')}`,
          borderRadius: 12,
          ...this.props.style,
        }}
      >
        <div style={{ fontSize: 28 }} aria-hidden>⚠️</div>
        <div style={{ fontWeight: 600, fontSize: 16, color: sem('text') }}>Something went wrong</div>
        <p style={{ margin: 0, fontSize: 13, color: sem('textMuted'), maxWidth: 420, wordBreak: 'break-word' }}>{error.message}</p>
        <button
          type="button"
          onClick={this.reset}
          style={{
            marginTop: 8,
            padding: '8px 16px',
            borderRadius: 8,
            border: 'none',
            background: sem('primary'),
            color: sem('primaryFg'),
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Try again
        </button>
      </div>
    );
  }
}

export default ErrorBoundary;
