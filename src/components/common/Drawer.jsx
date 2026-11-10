import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

/**
 * Drawer responsif.
 * - `docked`=true  : isi dirender inline sebagai panel biasa (desktop). Tidak ada overlay.
 * - `docked`=false : isi menjadi drawer modal dari sisi `side` (mobile/tablet) dengan backdrop,
 *                    kunci scroll, fokus terkunci, Esc untuk menutup, dan fokus dikembalikan saat ditutup.
 * Drawer dirender lewat portal ke <body> agar tidak terpengaruh transform/backdrop-filter induknya.
 */
const Drawer = ({
  open,
  onClose,
  title,
  side = 'right',
  docked = false,
  dockedClassName = '',
  widthClassName = 'w-[min(92vw,26rem)]',
  children,
}) => {
  const panelRef = useRef(null);
  const returnFocusRef = useRef(null);
  // Simpan onClose terbaru di ref: pemanggil sering memberi fungsi baru tiap render, dan itu tidak boleh
  // memicu ulang efek (yang akan mengembalikan fokus ke pemicu dan mematikan penangan keyboard).
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; });

  useEffect(() => {
    if (docked || !open) return undefined;

    returnFocusRef.current = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    // Fokus ke panel (bukan ke kontrol pertama) agar keyboard virtual tidak muncul di layar sentuh.
    const focusPanel = () => { if (panelRef.current && !panelRef.current.contains(document.activeElement)) panelRef.current.focus(); };
    const raf = requestAnimationFrame(focusPanel);
    const retry = setTimeout(focusPanel, 250); // cadangan bila transisi visibility belum selesai

    const onKeyDown = (e) => {
      const panel = panelRef.current;
      if (!panel) return;
      const active = document.activeElement;
      // Dialog lain (mis. pelanggan, pembayaran) yang terbuka di atas drawer berhak atas keyboard.
      // Fokus yang masih di halaman di belakang drawer (mis. tombol pembuka) tetap ditangani drawer.
      const otherDialog = active && active.closest ? active.closest('[role="dialog"],[aria-modal="true"]') : null;
      if (otherDialog && otherDialog !== panel) return;

      if (e.key === 'Escape') {
        e.stopPropagation();
        onCloseRef.current?.();
        return;
      }
      if (e.key !== 'Tab') return;
      const items = [...panel.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null);
      if (items.length === 0) { e.preventDefault(); panel.focus(); return; }
      const first = items[0];
      const last = items[items.length - 1];
      if (!panel.contains(active)) { e.preventDefault(); (e.shiftKey ? last : first).focus(); }
      else if (e.shiftKey && (active === first || active === panel)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKeyDown, true);

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(retry);
      document.removeEventListener('keydown', onKeyDown, true);
      document.body.style.overflow = previousOverflow;
      const el = returnFocusRef.current;
      if (el && typeof el.focus === 'function' && document.contains(el)) el.focus();
    };
  }, [open, docked]);

  if (docked) {
    return <aside className={dockedClassName}>{children}</aside>;
  }

  const closedTransform = side === 'right' ? 'translate-x-full' : '-translate-x-full';
  const edge = side === 'right' ? 'right-0' : 'left-0';

  return createPortal(
    <>
      <div
        data-testid="drawer-backdrop"
        onClick={onClose}
        aria-hidden="true"
        className={`fixed inset-0 z-40 bg-black/40 transition-opacity duration-200 motion-reduce:transition-none ${open ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
      />
      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        inert={!open}
        className={`fixed inset-y-0 ${edge} z-50 flex flex-col ${widthClassName} bg-gray-100 shadow-2xl outline-none transition-[transform,visibility] duration-200 ease-out motion-reduce:transition-none dark:bg-zinc-950 ${open ? 'visible translate-x-0' : `invisible ${closedTransform}`}`}
      >
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-gray-200 bg-white px-4 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-base font-semibold text-gray-900 dark:text-zinc-100">{title}</h2>
          <button type="button" onClick={onClose} className="btn-icon btn-text" aria-label={`Tutup ${title}`}>
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto overscroll-contain p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="flex flex-col gap-4">{children}</div>
        </div>
      </aside>
    </>,
    document.body
  );
};

export default Drawer;
