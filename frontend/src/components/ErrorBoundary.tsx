import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-page flex items-center justify-center p-6">
          <div className="max-w-md text-center space-y-4">
            <div className="text-5xl">&#x1F30B;</div>
            <h1 className="text-xl font-bold text-heading">Something went wrong</h1>
            <p className="text-sub text-sm leading-relaxed">
              The world engine encountered an unexpected error. Try reloading the page.
            </p>
            <pre className="text-xs text-crimson-400/70 bg-surface rounded-lg p-3 text-left overflow-auto max-h-32">
              {this.state.error?.message}
            </pre>
            <button
              onClick={() => window.location.reload()}
              className="px-5 py-2.5 bg-moss-500 hover:bg-moss-500 text-white rounded-lg text-sm font-medium transition-colors"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
