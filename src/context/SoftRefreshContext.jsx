// Soft refresh provider
// Allows components to request targeted data refreshes instead of full page reloads
import React, { useCallback } from 'react';
import { registerSoftRefreshHandler } from '../utils/appRefresh';
import { SoftRefreshContext } from './SoftRefreshContextDef';

export const SoftRefreshProvider = ({ children }) => {
  const handleSoftRefresh = useCallback((context) => {
    // This handler gets populated by components that need targeted refreshes
    // For example, SalesListPage can register a handler to refresh just the sales data
    // or PosPage can register a handler to reset the cart
    
    // Dispatch custom event so interested components can react
    const event = new CustomEvent('softRefresh', { detail: { context } });
    window.dispatchEvent(event);
  }, []);

  // Register the handler globally so safeReload() can use it
  React.useEffect(() => {
    registerSoftRefreshHandler(handleSoftRefresh);
  }, [handleSoftRefresh]);

  const value = {
    triggerSoftRefresh: handleSoftRefresh
  };

  return (
    <SoftRefreshContext.Provider value={value}>
      {children}
    </SoftRefreshContext.Provider>
  );
};
