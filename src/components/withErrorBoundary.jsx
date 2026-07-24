/**
 * Protected Page Component
 * Wraps page components with Error Boundary + Performance monitoring
 * 
 * Usage:
 * export default withErrorBoundary(ProductsPage, 'ProductsPage');
 */

import React from 'react';
import PosErrorBoundary from './PosErrorBoundary';
import ErrorBoundary from './ErrorBoundary';

/**
 * HOC to wrap page components with error boundaries
 * @param {React.Component} PageComponent - The page to wrap
 * @param {string} pageName - Name for error logging
 * @param {boolean} usePosBoundary - Use POS-specific error boundary (default: false)
 * @returns {React.Component} Wrapped component
 */
export const withErrorBoundary = (PageComponent, pageName, usePosBoundary = false) => {
  const BoundaryComponent = usePosBoundary ? PosErrorBoundary : ErrorBoundary;
  
  const WrappedComponent = (props) => (
    <BoundaryComponent context={`Page: ${pageName}`}>
      <PageComponent {...props} />
    </BoundaryComponent>
  );
  
  WrappedComponent.displayName = `withErrorBoundary(${pageName})`;
  
  return WrappedComponent;
};

export default withErrorBoundary;
