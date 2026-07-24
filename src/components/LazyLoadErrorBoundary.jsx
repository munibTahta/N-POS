import React from 'react';
import { logger } from '../utils/logger';

class LazyLoadErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    logger.error('Lazy load error caught by boundary:', {
      error: error?.message,
      stack: error?.stack,
      componentStack: errorInfo?.componentStack
    });
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <h3 className="text-red-800 font-semibold mb-2">Failed to load component</h3>
          <p className="text-red-700 text-sm mb-4">
            {this.state.error?.message || 'An error occurred while loading this component'}
          </p>
          <button
            onClick={this.handleRetry}
            className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 text-sm"
          >
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default LazyLoadErrorBoundary;
