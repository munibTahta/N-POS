// Utility to perform a safe application refresh.
// Preferred: app can set `window.__appHandleSoftRefresh = () => { ... }` to perform targeted refreshes.
export function safeReload(context) {
  try {
    // If app provides a soft refresh handler, use it
    if (typeof window.__appHandleSoftRefresh === 'function') {
      window.__appHandleSoftRefresh(context);
      return;
    }
  } catch (err) {
    console.warn('[safeReload] soft refresh failed, falling back to full reload', err);
  }

  // Fallback: full reload
  window.location.reload();
}

// Helper to allow app components to register a soft-refresh handler
export function registerSoftRefreshHandler(fn) {
  if (typeof fn === 'function') window.__appHandleSoftRefresh = fn;
}
