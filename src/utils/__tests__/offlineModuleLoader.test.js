/**
 * Test: Offline Module Loading
 * Verifies all pages are cached and accessible offline
 */
/* global global */

import { 
  preloadAllPages, 
  getModuleWithOfflineFallback, 
  getCachedModule, 
  getModuleCacheStats 
} from '../src/utils/offlineModuleLoader';

describe('Offline Module Loading', () => {
  beforeEach(async () => {
    // Pre-load all pages
    await preloadAllPages();
  });

  test('Should cache all 40+ pages on startup', async () => {
    const stats = getModuleCacheStats();
    expect(stats.cachedModules).toBeGreaterThanOrEqual(40);
  });

  test('Should return cached module instantly', () => {
    const PosPageModule = getCachedModule('PosPage');
    expect(PosPageModule).toBeDefined();
    expect(PosPageModule.default).toBeDefined();
  });

  test('Should handle offline navigation', async () => {
    // Simulate offline
    Object.defineProperty(window.navigator, 'onLine', {
      writable: true,
      value: false,
    });

    // Should use cache
    const module = await getModuleWithOfflineFallback(
      () => import('../pages/StockPage'),
      'StockPage'
    );
    expect(module).toBeDefined();
    expect(module.default).toBeDefined();
  });

  test('Should fallback to cache on fetch error', async () => {
    // Simulate network error
    global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

    const module = await getModuleWithOfflineFallback(
      async () => {
        throw new Error('Simulated fetch error');
      },
      'MenuPage'
    );

    // Should use cache instead
    expect(module).toBeDefined();
  });

  test('Cache should contain all critical pages', () => {
    const criticalPages = [
      'PosPage',
      'MenuPage',
      'StockPage',
      'ProductsPage',
      'CustomersPage'
    ];

    criticalPages.forEach(pageName => {
      const cached = getCachedModule(pageName);
      expect(cached).toBeDefined();
    });
  });

  test('Should provide cache statistics', () => {
    const stats = getModuleCacheStats();
    expect(stats).toHaveProperty('cachedModules');
    expect(stats).toHaveProperty('modules');
    expect(stats).toHaveProperty('isPreloading');
    expect(Array.isArray(stats.modules)).toBe(true);
  });
});

describe('Offline Mode - E2E', () => {
  beforeEach(async () => {
    await preloadAllPages();
  });

  test('Should navigate POS page while offline', async () => {
    // Set offline
    Object.defineProperty(window.navigator, 'onLine', {
      writable: true,
      value: false,
    });

    const PosPage = getCachedModule('PosPage');
    expect(PosPage).toBeDefined();
    expect(PosPage.default).toBeDefined();
    
    // Component should render
    const component = PosPage.default();
    expect(component).toBeDefined();
  });

  test('Should access multiple pages offline', async () => {
    Object.defineProperty(window.navigator, 'onLine', {
      writable: true,
      value: false,
    });

    const pages = ['PosPage', 'StockPage', 'MenuPage', 'ProductsPage'];
    
    pages.forEach(pageName => {
      const module = getCachedModule(pageName);
      expect(module).toBeDefined();
      expect(module.default).toBeDefined();
    });
  });

  test('Cache should not have gaps after preload', async () => {
    const stats = getModuleCacheStats();
    const { cachedModules, modules } = stats;
    
    // All modules should have cached entries
    expect(cachedModules).toEqual(modules.length);
  });
});
