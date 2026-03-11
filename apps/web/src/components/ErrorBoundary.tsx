import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /** Optional section label shown in the error UI */
  section?: string;
  /** If true, renders a compact inline error instead of a full-page card */
  inline?: boolean;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[ErrorBoundary:${this.props.section ?? 'app'}]`, error, info.componentStack);
  }

  private reset = () => this.setState({ hasError: false, error: null });

  render() {
    if (!this.state.hasError) return this.props.children;

    const { section = 'This section', inline = false } = this.props;
    const msg = this.state.error?.message ?? 'Unknown error';

    if (inline) {
      return (
        <div className="flex items-center gap-3 bg-red-950/30 border border-red-700/40 rounded-lg px-4 py-3 text-sm">
          <span className="text-red-400 text-lg">⚠</span>
          <div>
            <span className="text-red-300 font-medium">{section} failed to load</span>
            <span className="text-slate-500 ml-2 text-xs font-mono truncate max-w-xs inline-block align-bottom">{msg}</span>
          </div>
          <button
            onClick={this.reset}
            className="ml-auto text-xs text-slate-400 hover:text-white transition-colors shrink-0"
          >
            Retry
          </button>
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center justify-center min-h-[320px] p-8">
        <div className="bg-slate-800 border border-red-700/40 rounded-xl p-8 max-w-md w-full text-center shadow-xl">
          <div className="text-4xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold text-white mb-2">Something went wrong</h2>
          <p className="text-slate-400 text-sm mb-1">
            <span className="font-medium text-slate-300">{section}</span> encountered an unexpected error.
          </p>
          <p className="text-xs text-slate-600 font-mono mb-6 break-all">{msg}</p>
          <button
            onClick={this.reset}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg transition-colors font-medium"
          >
            Try again
          </button>
          <p className="text-xs text-slate-600 mt-4">
            If this keeps happening, try refreshing the page or check the API status.
          </p>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
