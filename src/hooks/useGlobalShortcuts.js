import { useEffect, useRef } from 'react';
import { isTypingTarget } from '../features/pos/shortcuts';
import { resolveGoTarget, GO_WINDOW_MS } from './globalNav';

/**
 * Pintasan keyboard global (aktif di semua halaman di dalam Layout):
 *  - Ctrl/Cmd+K : buka palet perintah (juga saat mengetik di kolom isian, seperti aplikasi lain)
 *  - ?          : buka bantuan pintasan (kecuali di halaman kasir, yang punya bantuan sendiri)
 *  - g lalu huruf : pindah halaman (lihat GO_SHORTCUTS); hanya bila tidak sedang mengetik dan tidak ada dialog terbuka
 * Dialog yang terbuka (role=dialog/alertdialog) menonaktifkan pintasan satu-tombol.
 */
export function useGlobalShortcuts({ onOpenPalette, onOpenHelp, onNavigate, canAccess, pathname }) {
  const armedAt = useRef(0);
  const latest = useRef({});
  useEffect(() => { latest.current = { onOpenPalette, onOpenHelp, onNavigate, canAccess, pathname }; });

  useEffect(() => {
    const onKey = (e) => {
      const { onOpenPalette: openPalette, onOpenHelp: openHelp, onNavigate: go, canAccess: can, pathname: path } = latest.current;
      if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && String(e.key).toLowerCase() === 'k') {
        e.preventDefault();
        armedAt.current = 0;
        openPalette?.();
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (isTypingTarget(e.target)) { armedAt.current = 0; return; }
      if (document.querySelector('[role="dialog"][aria-modal="true"], [role="alertdialog"]')) { armedAt.current = 0; return; }

      if (e.key === '?') {
        if (path === '/pos') return; // halaman kasir menangani ? sendiri
        e.preventDefault();
        openHelp?.();
        return;
      }
      const now = Date.now();
      if (armedAt.current && now - armedAt.current < GO_WINDOW_MS) {
        armedAt.current = 0;
        const target = resolveGoTarget(e.key, can);
        if (target) { e.preventDefault(); go?.(target); }
        return;
      }
      if (e.key === 'g' && !e.shiftKey) armedAt.current = now;
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

export default useGlobalShortcuts;
