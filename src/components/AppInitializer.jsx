import React, { useEffect, useState } from 'react';
import { useOfflineInitialization } from '../hooks/useOfflineInitialization';
import { useSync } from '../context/SyncContext';
import offlineDataSync from '../services/offlineDataSync';
import posService from '../services/posService';
import InitializationIndicator from './InitializationIndicator';

/**
 * App Initializer Component
 * - Initializes offline storage on app load in background
 * - Preloads all master data (products, categories, units, payment methods, customers)
 * - Auto-syncs products (SQLite-based) when online
 * - Shows minimal initialization indicator (top-right corner)
 * - Renders app immediately, no blocking loading screen
 * - Handles offline/online status
 */
const AppInitializer = ({ children }) => {
  const { isInitializing } = useOfflineInitialization();
  const { isOnline } = useSync();
  const [isReady, setIsReady] = useState(false);

  // Preload offline data on app start (background, no blocking)
  useEffect(() => {
    const preloadData = async () => {
      try {
        // Initialize and run product sync (this loads from API if not yet synced)
        const syncResult = await offlineDataSync.initialize();
        // Load master data from offline.db
        await offlineDataSync.loadMasterDataFromDb();
        
        // Recover any failed offline transactions
        const recoveryResult = await posService.recoverFailedTransactions();
        if (recoveryResult.recovered > 0) {
        }
        if (recoveryResult.failed > 0) {
          console.warn(`⚠️ ${recoveryResult.failed} transactions still failed recovery`);
        }
        
        const readiness = await offlineDataSync.getOfflineReadiness();
        setIsReady(true);
      } catch (error) {
        console.error('⚠️ Error preloading offline data:', error);
        // Continue anyway - data will load on demand
        setIsReady(true);
      }
    };

    preloadData();
  }, []);

  // Auto-sync products when coming online (for incremental updates)
  useEffect(() => {
    if (isOnline && !isInitializing && isReady) {
      offlineDataSync.syncProductsToDb()
        .catch(err => console.warn('⚠️ Incremental product sync failed:', err));
    }
  }, [isOnline, isInitializing, isReady]);

  // Always render children immediately + indicator overlay
  return (
    <>
      <InitializationIndicator />
      {children}
    </>
  );
};

export default AppInitializer;
