import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Global error boundary that catches unhandled React render errors
 * and presents a recovery UI instead of a blank white screen.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary] Uncaught render error:", error, info.componentStack);
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  handleGoHome = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = "/";
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-lg w-full p-8 text-center space-y-4">
          <div className="mx-auto h-14 w-14 rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertTriangle className="h-7 w-7 text-destructive" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Something went wrong</h1>
          <p className="text-sm text-muted-foreground">
            An unexpected error occurred while rendering this page.
            Your data is safe — try refreshing or go back to the home page.
          </p>
          {this.state.error && (
            <pre className="text-xs text-left bg-muted rounded-lg p-3 overflow-auto max-h-32 text-muted-foreground">
              {this.state.error.message}
            </pre>
          )}
          <div className="flex gap-3 justify-center pt-2">
            <Button onClick={this.handleReload} className="gap-2">
              <RefreshCw className="h-4 w-4" /> Reload page
            </Button>
            <Button onClick={this.handleGoHome} variant="outline" className="gap-2">
              <Home className="h-4 w-4" /> Go home
            </Button>
          </div>
        </Card>
      </div>
    );
  }
}
