import { Component, type ErrorInfo, type ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[BdSL error boundary]", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="runtime-fallback" role="alert">
          <h1>BdSL Vision</h1>
          <p>Demo encountered a runtime error. Reload the page and try again.</p>
          <button type="button" onClick={() => window.location.reload()}>
            Reload demo
          </button>
        </main>
      );
    }

    return this.props.children;
  }
}
