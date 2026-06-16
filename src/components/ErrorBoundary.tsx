import { Component, type ErrorInfo, type ReactNode } from "react";
import { apiClient } from "../services/apiClient";

interface Props { children: ReactNode; }
interface State { error: Error | null; }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
    apiClient.reportError({
      message: error.message,
      stack: `${error.stack ?? ""}\n\nComponent:\n${info.componentStack ?? ""}`,
      url: window.location.href,
    }).catch(() => undefined);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="error-boundary">
          <div className="error-boundary-card">
            <div className="error-boundary-icon">⚠</div>
            <h2>Щось пішло не так</h2>
            <p className="error-boundary-msg">{this.state.error.message}</p>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => window.location.reload()}
            >
              Перезавантажити
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => this.setState({ error: null })}
            >
              Спробувати знову
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
