import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import Button from './ui/Button';
import i18n from '../config/i18n';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
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

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
          <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6 text-center">
            <div className="mb-4">
              <svg
                className="mx-auto h-12 w-12 text-red-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              {i18n.t('common.somethingWentWrong')}
            </h2>
            <p className="text-gray-600 mb-4">
              {this.state.error?.message || i18n.t('common.unexpectedError')}
            </p>
            <div className="flex gap-3 justify-center">
              <Button onClick={this.handleReset} variant="primary">
                {i18n.t('common.tryAgain')}
              </Button>
              <Button
                onClick={() => (window.location.href = '/')}
                variant="ghost"
              >
                {i18n.t('common.goHome')}
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
