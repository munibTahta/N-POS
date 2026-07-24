import { useEffect, useRef } from 'react';
import RoutePreloader from './useRoutePreloader';

/**
 * useAppRoutePreloading Hook
 * Handles route preloading strategy for offline-first app
 * - Preloads critical routes on app init
 * - Manages component caching
 * - Follows offline-first principle
 */
export const useAppRoutePreloading = (routeImports, options = {}) => {
  const { 
    enabled = true,
    autoStartOnMount = true
  } = options;
  
  const preloadingStartedRef = useRef(false);

  useEffect(() => {
    if (!enabled || !autoStartOnMount || preloadingStartedRef.current) {
      return;
    }

    preloadingStartedRef.current = true;

    // Start preloading in background after app is ready
    const timeoutId = setTimeout(async () => {
      try {
        const preloadFn = RoutePreloader.preloadRoutesByPriority(routeImports);
        await preloadFn();
      } catch (error) {
        console.error('Route preloading failed:', error);
      }
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [enabled, autoStartOnMount, routeImports]);

  return {
    preloadComponent: RoutePreloader.preloadComponent,
    routeDataCache: RoutePreloader.routeDataCache,
    navigationPrefetch: RoutePreloader.navigationPrefetch
  };
};

export default useAppRoutePreloading;
