// src/utils/bundleOptimizer.js

import React from 'react';

import { lazy } from 'react';

// Bundle optimization utilities

// Lazy load with error boundary and loading fallback
export const lazyLoad = (importFn, _fallback = null) => {
  return lazy(() =>
    importFn().catch(error => {
      console.error('Failed to load component:', error);
      // Return a fallback component
      return {
        default: () => React.createElement('div', {
          className: 'error-fallback'
        }, 'Failed to load component')
      };
    })
  );
};

// Preload critical routes
export const preloadRoute = (importFn) => {
  // Preload on user interaction hints
  const preload = () => importFn();
  return preload;
};

// Bundle splitting configuration
export const createBundleGroups = () => {
  // Group components by feature for better code splitting
  return {
    // Core POS functionality
    pos: {
      PosPage: () => import('../pages/PosPage.jsx'),
      PaymentMethodSelector: () => import('../components/PaymentMethodSelector.jsx'),
      ReceiptContent: () => import('../components/ReceiptContent.jsx'),
      BarcodeScanner: () => import('../components/CameraBarcodeScanner.jsx')
    },

    // Product management
    products: {
      ProductsPage: () => import('../pages/ProductsPage.jsx'),
      AddProductPage: () => import('../pages/AddProductPage.jsx'),
      EditProductPage: () => import('../pages/EditProductPage.jsx'),
      CategoriesPage: () => import('../pages/CategoriesPage.jsx')
    },

    // Customer management
    customers: {
      CustomersPage: () => import('../pages/CustomersPage.jsx'),
      CustomerDetailPage: () => import('../pages/CustomerDetailPage.jsx'),
      PencarianPelanggan: () => import('../components/PencarianPelanggan.jsx')
    },

    // Admin features
    admin: {
      AdminReconciliationPage: () => import('../pages/AdminReconciliationPage.jsx'),
      AuditTrailPage: () => import('../pages/AuditTrailPage.jsx'),
      BranchesPage: () => import('../pages/BranchesPage.jsx'),
      MenuManagementPage: () => import('../pages/MenuManagementPage.jsx'),
      PaymentMethodsPage: () => import('../pages/PaymentMethodsPage.jsx'),
      LoyaltyTiersPage: () => import('../pages/LoyaltyTiersPage.jsx')
    },

    // Reports and analytics
    reports: {
      PaymentsPage: () => import('../pages/PaymentsPage.jsx'),
      PurchaseCreatePage: () => import('../pages/PurchaseCreatePage.jsx'),
      PurchaseFormPage: () => import('../pages/PurchaseFormPage.jsx')
    },

    // Utilities and modals
    modals: {
      // Unified printer modal replaces PrintModal, PurchasePrintModal, BarcodePrintModal
      UniversalPrintModal: () => import('../components/UniversalPrintModal.jsx'),
      PaymentHistoryModal: () => import('../components/PaymentHistoryModal.jsx'),
      TransactionSuccessModal: () => import('../components/TransactionSuccessModal.jsx'),
      SyncModal: () => import('../components/SyncModal.jsx')
    }
  };
};

// Dynamic import with caching
class ImportCache {
  constructor() {
    this.cache = new Map();
  }

  async load(importFn, cacheKey) {
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    try {
      const module = await importFn();
      this.cache.set(cacheKey, module);
      return module;
    } catch (error) {
      console.error(`Failed to load module ${cacheKey}:`, error);
      throw error;
    }
  }

  clear() {
    this.cache.clear();
  }
}

export const importCache = new ImportCache();

// Progressive loading hook
export const useProgressiveLoad = () => {
  const [loadingState, setLoadingState] = React.useState({
    isLoading: false,
    progress: 0,
    currentModule: null
  });

  const loadModule = React.useCallback(async (importFn, moduleName) => {
    setLoadingState({
      isLoading: true,
      progress: 0,
      currentModule: moduleName
    });

    try {
      // Simulate progress for better UX
      const progressInterval = setInterval(() => {
        setLoadingState(prev => ({
          ...prev,
          progress: Math.min(prev.progress + 10, 90)
        }));
      }, 100);

      const module = await importFn();

      clearInterval(progressInterval);
      setLoadingState({
        isLoading: false,
        progress: 100,
        currentModule: null
      });

      return module;
    } catch (error) {
      setLoadingState({
        isLoading: false,
        progress: 0,
        currentModule: null
      });
      throw error;
    }
  }, []);

  return { loadingState, loadModule };
};

// Service worker for caching
export const registerServiceWorker = async () => {
  // Only register service worker in production
  if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      // Handle updates
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', async () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New version available
              try {
                const { safeReload } = await import('../utils/appRefresh');
                safeReload('bundleOptimizer');
              } catch (_e) {
                window.location.reload();
              }
            }
          });
        }
      });

      return registration;
    } catch (error) {
      console.error('Service Worker registration failed:', error);
    }
  } else if (import.meta.env.DEV) {
    if (import.meta.env.DEV) {
    }
  }
};

// Bundle size monitoring
export const monitorBundleSize = () => {
  // Monitor chunk loading performance
  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      if (entry.entryType === 'resource' && entry.name.includes('.js')) {
        if (import.meta.env.DEV) {
        }
      }
    }
  });

  try {
    observer.observe({ entryTypes: ['resource'] });
  } catch (error) {
    console.warn('Performance observer not supported:', error);
  }

  return () => observer.disconnect();
};

// Critical resource preloader
export const preloadCriticalResources = async (resources) => {
  const promises = resources.map(async (resource) => {
    try {
      if (resource.type === 'script') {
        await loadScript(resource.url);
      } else if (resource.type === 'style') {
        await loadStyle(resource.url);
      } else if (resource.type === 'font') {
        await loadFont(resource.url);
      }
    } catch (error) {
      console.warn(`Failed to preload ${resource.type}: ${resource.url}`, error);
    }
  });

  await Promise.allSettled(promises);
};

const loadScript = (url) => {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.onload = resolve;
    script.onerror = reject;
    script.src = url;
    document.head.appendChild(script);
  });
};

const loadStyle = (url) => {
  return new Promise((resolve, reject) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.onload = resolve;
    link.onerror = reject;
    link.href = url;
    document.head.appendChild(link);
  });
};

const loadFont = (url) => {
  return new Promise((resolve, reject) => {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'font';
    link.onload = resolve;
    link.onerror = reject;
    link.href = url;
    document.head.appendChild(link);
  });
};

// WebP image support detection and fallback
export const supportsWebP = () => {
  return new Promise((resolve) => {
    const webP = new Image();
    webP.onload = webP.onerror = () => {
      resolve(webP.height === 2);
    };
    webP.src = 'data:image/webp;base64,UklGRjoAAABXRUJQVlA4IC4AAACyAgCdASoCAAIALmk0mk0iIiIiIgBoSygABc6WWgAA/veff/0PP8bA//LwYAAA';
  });
};

// Optimize images based on device capabilities
export const getOptimizedImageUrl = (baseUrl, options = {}) => {
  const {
    width,
    height,
    quality = 80,
    format = 'auto'
  } = options;

  // Use WebP if supported, fallback to original
  const params = new URLSearchParams({
    w: width || '',
    h: height || '',
    q: quality,
    f: format
  });

  return `${baseUrl}?${params.toString()}`;
};

// Intersection Observer for lazy loading
export const createIntersectionObserver = (callback, options = {}) => {
  const defaultOptions = {
    root: null,
    rootMargin: '50px',
    threshold: 0.1,
    ...options
  };

  return new IntersectionObserver(callback, defaultOptions);
};

// Lazy load images with intersection observer
export const lazyLoadImage = (imgElement, src) => {
  const observer = createIntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const img = entry.target;
        img.src = src;
        img.classList.add('loaded');
        observer.unobserve(img);
      }
    });
  });

  observer.observe(imgElement);
};

// Bundle analysis utilities
export const analyzeBundle = () => {
  // Analyze webpack bundle in development
  if (import.meta.env.DEV && window.__webpack_chunk_load__) {
    const originalLoad = window.__webpack_chunk_load__;

    window.__webpack_chunk_load__ = function(_chunkId) {
      const start = performance.now();
      return originalLoad.apply(this, arguments).then(() => {
        const _duration = performance.now() - start;
        if (import.meta.env.DEV) void 0 && (`Chunk loaded in ${_duration}ms`);
      });
    };
  }
};

// Initialize bundle optimization
export const initializeBundleOptimization = () => {
  // Register service worker for caching
  registerServiceWorker();

  // Monitor bundle sizes
  monitorBundleSize();

  // Analyze bundle in development
  analyzeBundle();

  // Preload critical resources
  const criticalResources = [
    // Add critical resources here
  ];

  if (criticalResources.length > 0) {
    preloadCriticalResources(criticalResources);
  }
};