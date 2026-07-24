// src/hooks/usePerformance.js
import React, { useEffect, useRef, useCallback } from 'react';

export const usePerformance = (componentName = 'Component') => {
  const renderCount = useRef(0);
  const mountTime = useRef(null);
  const lastRenderTime = useRef(null);

  useEffect(() => {
    // Initialize timestamps on first mount
    if (mountTime.current === null) {
      mountTime.current = Date.now();
      lastRenderTime.current = Date.now();
    }

    renderCount.current += 1;
    const now = Date.now();
    const renderTime = now - lastRenderTime.current;

    // Log slow renders (> 16ms = 60fps)
    if (renderTime > 16) {
      console.warn(`${componentName} slow render: ${renderTime}ms (render #${renderCount.current})`);
    }

    lastRenderTime.current = now;

    // Log component mount
    if (renderCount.current === 1) {
      if (import.meta.env.DEV) {
      }
    }
  });

  const measureAsync = useCallback(async (operationName, asyncFn) => {
    const startTime = performance.now();
    try {
      const result = await asyncFn();
      return result;
    } catch (error) {
      const duration = performance.now() - startTime;
      console.error(`${operationName} failed after ${duration.toFixed(2)}ms:`, error);
      throw error;
    }
  }, []);

  const measureSync = useCallback((operationName, syncFn) => {
    const startTime = performance.now();
    try {
      const result = syncFn();
      const duration = performance.now() - startTime;
      if (duration > 10) { // Log operations taking more than 10ms
        if (import.meta.env.DEV) {
        }
      }
      return result;
    } catch (error) {
      const duration = performance.now() - startTime;
      console.error(`${operationName} failed after ${duration.toFixed(2)}ms:`, error);
      throw error;
    }
  }, []);

  const getRenderCount = useCallback(() => renderCount.current, []);

  return {
    getRenderCount,
    measureAsync,
    measureSync
  };
};

// Enhanced performance monitoring hook
export const usePerformanceMonitor = () => {
  const metricsRef = useRef({
    renderCount: 0,
    lastRenderTime: 0,
    averageRenderTime: 0,
    memoryUsage: null,
    slowRenders: 0,
    totalRenderTime: 0
  });

  const startTimeRef = useRef(0);

  useEffect(() => {
    startTimeRef.current = performance.now();
  });

  useEffect(() => {
    const endTime = performance.now();
    const renderTime = endTime - startTimeRef.current;

    const metrics = metricsRef.current;
    metrics.renderCount++;
    metrics.lastRenderTime = renderTime;
    metrics.totalRenderTime += renderTime;
    metrics.averageRenderTime = metrics.totalRenderTime / metrics.renderCount;

    // Track slow renders (>16ms for 60fps)
    if (renderTime > 16) {
      metrics.slowRenders++;
    }

    // Log performance issues in development
    if (import.meta.env.DEV && renderTime > 50) {
      console.warn(`Slow render detected: ${renderTime.toFixed(2)}ms`);
    }

    // Memory usage monitoring (if available)
    if (performance.memory) {
      metrics.memoryUsage = {
        used: performance.memory.usedJSHeapSize,
        total: performance.memory.totalJSHeapSize,
        limit: performance.memory.jsHeapSizeLimit
      };
    }
  });

  const getMetrics = useCallback(() => ({
    ...metricsRef.current,
    memoryUsagePercent: metricsRef.current.memoryUsage
      ? (metricsRef.current.memoryUsage.used / metricsRef.current.memoryUsage.limit) * 100
      : null
  }), []);

  const resetMetrics = useCallback(() => {
    metricsRef.current = {
      renderCount: 0,
      lastRenderTime: 0,
      averageRenderTime: 0,
      memoryUsage: null,
      slowRenders: 0,
      totalRenderTime: 0
    };
  }, []);

  return { getMetrics, resetMetrics };
};

// Memory cleanup utility
export const useMemoryCleanup = () => {
  const cleanupFunctionsRef = useRef([]);

  const addCleanupFunction = useCallback((cleanupFn) => {
    cleanupFunctionsRef.current.push(cleanupFn);
  }, []);

  const cleanup = useCallback(() => {
    cleanupFunctionsRef.current.forEach(fn => {
      try {
        fn();
      } catch (error) {
        console.warn('Cleanup function failed:', error);
      }
    });
    cleanupFunctionsRef.current = [];
  }, []);

  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  return { addCleanupFunction, cleanup };
};

// Debounced state updates for better performance
export const useDebouncedState = (initialValue, delay = 300) => {
  const [value, setValue] = React.useState(initialValue);
  const timeoutRef = React.useRef(null);

  const debouncedSetValue = React.useCallback((newValue) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      setValue(newValue);
    }, delay);
  }, [delay]);

  React.useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return [value, debouncedSetValue, setValue];
};

// Virtual scrolling hook for large lists
export const useVirtualScroll = (items, itemHeight = 50, containerHeight = 400) => {
  const [scrollTop, setScrollTop] = React.useState(0);
  const [visibleRange, setVisibleRange] = React.useState({ start: 0, end: 0 });

  const totalHeight = items.length * itemHeight;
  const visibleCount = Math.ceil(containerHeight / itemHeight) + 2; // Add buffer

  React.useEffect(() => {
    const start = Math.floor(scrollTop / itemHeight);
    const end = Math.min(start + visibleCount, items.length);
    setVisibleRange({ start, end });
  }, [scrollTop, itemHeight, visibleCount, items.length]);

  const visibleItems = React.useMemo(() => {
    return items.slice(visibleRange.start, visibleRange.end).map((item, index) => ({
      ...item,
      virtualIndex: visibleRange.start + index,
      style: {
        position: 'absolute',
        top: (visibleRange.start + index) * itemHeight,
        height: itemHeight,
        width: '100%'
      }
    }));
  }, [items, visibleRange, itemHeight]);

  const handleScroll = React.useCallback((event) => {
    setScrollTop(event.target.scrollTop);
  }, []);

  return {
    visibleItems,
    totalHeight,
    onScroll: handleScroll,
    scrollTop
  };
};

// Resource preloader for critical assets
export const useResourcePreloader = () => {
  const preloadImage = React.useCallback((src) => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(src);
      img.onerror = reject;
      img.src = src;
    });
  }, []);

  const preloadScript = React.useCallback((src) => {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.onload = () => resolve(src);
      script.onerror = reject;
      script.src = src;
      document.head.appendChild(script);
    });
  }, []);

  const preloadResources = React.useCallback(async (resources) => {
    const promises = resources.map(resource => {
      if (resource.type === 'image') {
        return preloadImage(resource.src);
      } else if (resource.type === 'script') {
        return preloadScript(resource.src);
      }
      return Promise.resolve();
    });

    try {
      await Promise.all(promises);
    } catch (error) {
      console.warn('Some resources failed to preload:', error);
    }
  }, [preloadImage, preloadScript]);

  return { preloadResources };
};

// Connection quality monitor
export const useConnectionQuality = () => {
  const [quality, setQuality] = React.useState('unknown');
  const [metrics, setMetrics] = React.useState({
    latency: null,
    bandwidth: null,
    isOnline: navigator.onLine
  });

  const measureLatency = React.useCallback(async () => {
    const start = performance.now();
    try {
      // Simple ping to API
      await fetch('/api/health', { method: 'HEAD' });
      const latency = performance.now() - start;

      setMetrics(prev => ({ ...prev, latency }));

      // Determine quality based on latency
      let newQuality = 'excellent';
      if (latency > 1000) newQuality = 'poor';
      else if (latency > 500) newQuality = 'fair';
      else if (latency > 200) newQuality = 'good';

      setQuality(newQuality);
    } catch (_error) {
      setQuality('offline');
      setMetrics(prev => ({ ...prev, latency: null }));
    }
  }, []);

  React.useEffect(() => {
    const handleOnline = () => {
      setMetrics(prev => ({ ...prev, isOnline: true }));
      measureLatency();
    };

    const handleOffline = () => {
      setMetrics(prev => ({ ...prev, isOnline: false }));
      setQuality('offline');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial measurement
    if (navigator.onLine) {
      measureLatency();
    }

    // Periodic checks
    const interval = setInterval(() => {
      if (navigator.onLine) {
        measureLatency();
      }
    }, 30000); // Check every 30 seconds

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, [measureLatency]);

  return { quality, metrics };
};