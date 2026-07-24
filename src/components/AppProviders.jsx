import React from 'react';
import { AuthProvider } from '../context/AuthProvider';
import { SettingsProvider } from '../context/SettingsContext';
import { RoleProvider } from '../context/RoleContext.jsx';
import { MenuProvider } from '../context/MenuContext.jsx';
import { SyncProvider } from '../context/SyncContext';
import { SoftRefreshProvider } from '../context/SoftRefreshContext';

// Provider wrapper component for better organization
export const AppProviders = ({ children }) => (
  <AuthProvider>
    <SettingsProvider>
      <RoleProvider>
        <MenuProvider>
          <SyncProvider>
            <SoftRefreshProvider>
              {children}
            </SoftRefreshProvider>
          </SyncProvider>
        </MenuProvider>
      </RoleProvider>
    </SettingsProvider>
  </AuthProvider>
);