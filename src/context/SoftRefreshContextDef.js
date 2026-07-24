// Soft refresh context definition
// Allows components to request targeted data refreshes instead of full page reloads
import React from 'react';

export const SoftRefreshContext = React.createContext(null);

export const useSoftRefresh = () => {
  const context = React.useContext(SoftRefreshContext);
  if (!context) {
    throw new Error('useSoftRefresh must be used within SoftRefreshProvider');
  }
  return context;
};
