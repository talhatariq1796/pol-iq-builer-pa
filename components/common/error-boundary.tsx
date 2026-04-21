'use client';

import React from 'react';
import { AlertTriangle, RotateCw, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallbackTitle?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  showDetails: boolean;
}

interface ErrorFallbackUIProps {
  title: string;
  error: Error | null;
  showDetails: boolean;
  onToggleDetails: () => void;
  onReload: () => void;
  onReturnToDashboard: () => void;
}

function ErrorFallbackUI({ title, error, showDetails, onToggleDetails, onReload, onReturnToDashboard }: ErrorFallbackUIProps) {
  return (
    <div className="flex items-center justify-center min-h-[400px] p-6">
      <Card className="max-w-2xl w-full">
        <CardContent className="pt-6">
          <div className="flex flex-col items-center text-center">
            <div className="rounded-full bg-red-100 p-3 mb-4">
              <AlertTriangle className="h-8 w-8 text-red-600" />
            </div>

            <h2 className="text-2xl font-semibold text-gray-900 mb-2">
              {title}
            </h2>

            <p className="text-gray-600 mb-6 max-w-md">
              An unexpected error occurred while loading this page. You can try reloading
              the page or return to the dashboard.
            </p>

            <div className="flex flex-wrap gap-3 justify-center mb-4">
              <Button
                onClick={onReload}
                className="gap-2"
              >
                <RotateCw className="h-4 w-4" />
                Reload Page
              </Button>
              <Button
                onClick={onReturnToDashboard}
                variant="outline"
                className="gap-2"
              >
                <Home className="h-4 w-4" />
                Return to Dashboard
              </Button>
            </div>

            <button
              onClick={onToggleDetails}
              className="text-sm text-gray-500 hover:text-gray-700 mt-2"
            >
              {showDetails ? 'Hide' : 'Show'} error details
            </button>

            {showDetails && error && (
              <div className="mt-4 w-full">
                <div className="bg-gray-50 rounded-lg p-4 text-left">
                  <div className="mb-3">
                    <h3 className="text-sm font-semibold text-gray-700 mb-1">
                      Error Message:
                    </h3>
                    <p className="text-sm text-red-600 font-mono">
                      {error.message}
                    </p>
                  </div>

                  {error.stack && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 mb-1">
                        Stack Trace:
                      </h3>
                      <pre className="text-xs text-gray-600 overflow-auto max-h-48 p-2 bg-white rounded border border-gray-200">
                        {error.stack}
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Error boundary component to catch runtime errors and display recovery UI.
 * Wraps tool pages to prevent crashes from blanking the entire app.
 */
class ErrorBoundaryClass extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, showDetails: false };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);
  }

  handleReload = (): void => {
    window.location.reload();
  };

  handleReturnToDashboard = (): void => {
    window.location.href = '/political-ai';
  };

  toggleDetails = (): void => {
    this.setState((prev: ErrorBoundaryState) => ({ ...prev, showDetails: !prev.showDetails }));
  };

  render(): React.ReactNode {
    if (this.state.hasError) {
      const title = this.props.fallbackTitle || 'Something went wrong';
      const { error, showDetails } = this.state;

      return (
        <ErrorFallbackUI
          title={title}
          error={error}
          showDetails={showDetails}
          onToggleDetails={this.toggleDetails}
          onReload={this.handleReload}
          onReturnToDashboard={this.handleReturnToDashboard}
        />
      );
    }

    return this.props.children;
  }
}

// Export a wrapper function component that avoids JSX type issues
export function ErrorBoundary({ children, fallbackTitle }: ErrorBoundaryProps): JSX.Element {
  return React.createElement(
    ErrorBoundaryClass,
    { fallbackTitle },
    children
  ) as JSX.Element;
}

export default ErrorBoundary;
