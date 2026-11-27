import { Component, type ErrorInfo, type ReactNode } from 'react';
import { RotateCcw, ShieldAlert } from 'lucide-react';

interface Props {
  children: ReactNode;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
}

/**
 * Accessible runtime error boundary preventing blank screens while never
 * logging user text or PII to the browser console.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(_error: Error, _info: ErrorInfo): void {
    // Intentionally silent: never emit workspace text or PII to console/telemetry.
  }

  private handleReset = (): void => {
    this.setState({ hasError: false });
    this.props.onReset?.();
  };

  render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 p-6 text-slate-200">
        <div
          role="alert"
          aria-live="assertive"
          className="w-full max-w-md rounded-xl border border-red-500/40 bg-zinc-950 p-6 shadow-2xl"
        >
          <div className="flex items-center gap-3">
            <div className="rounded-md border border-red-500/40 bg-red-500/10 p-2 text-red-400">
              <ShieldAlert aria-hidden="true" className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-sm font-semibold text-slate-100">
                Workspace Recovery Needed
              </h1>
              <p className="text-xs text-slate-400">
                An unexpected rendering error occurred locally. No data left this browser tab.
              </p>
            </div>
          </div>

          <div className="mt-5 flex justify-end">
            <button
              type="button"
              onClick={this.handleReset}
              className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/50 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-200 hover:bg-emerald-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
            >
              <RotateCcw aria-hidden="true" className="h-3.5 w-3.5" />
              Reset Workspace
            </button>
          </div>
        </div>
      </div>
    );
  }
}
