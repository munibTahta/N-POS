import React, { useEffect, useId, useRef, useState } from 'react';
import { MoreHorizontal } from 'lucide-react';

/**
 * Menu "Lainnya" untuk aksi sekunder di header halaman (Export, Import, Template, Info, ...).
 * Pola halaman daftar: SATU tombol utama (Tambah) + SATU menu ini, bukan deretan tombol ikon yang sulit ditebak.
 * items: [{ id, label, icon?: Component, onClick, disabled? }]. ARIA menu: panah atas/bawah, Home/End, Esc menutup dan
 * mengembalikan fokus ke tombol, klik di luar menutup.
 */
export default function HeaderActionMenu({ items = [], label = 'Lainnya', className = '' }) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef(null);
  const listRef = useRef(null);
  const uid = useId();

  useEffect(() => {
    if (!open) return undefined;
    listRef.current?.querySelector('[role="menuitem"]:not([disabled])')?.focus();
    const onDown = (e) => { if (!listRef.current?.contains(e.target) && !btnRef.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const close = (refocus = true) => { setOpen(false); if (refocus) btnRef.current?.focus(); };
  const onKey = (e) => {
    const els = [...listRef.current.querySelectorAll('[role="menuitem"]:not([disabled])')];
    const i = els.indexOf(document.activeElement);
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); els[(i + 1) % els.length]?.focus(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); els[(i - 1 + els.length) % els.length]?.focus(); }
    else if (e.key === 'Home') { e.preventDefault(); els[0]?.focus(); }
    else if (e.key === 'End') { e.preventDefault(); els[els.length - 1]?.focus(); }
    else if (e.key === 'Tab') setOpen(false);
  };

  if (items.length === 0) return null;
  return (
    <div className={`relative ${className}`}>
      <button ref={btnRef} type="button" className="btn-outlined" aria-label={label} aria-haspopup="menu" aria-expanded={open} aria-controls={`${uid}-menu`} onClick={() => setOpen((v) => !v)}>
        <MoreHorizontal className="h-4 w-4" aria-hidden="true" /><span className="hidden sm:inline">{label}</span>
      </button>
      {open && (
        <div ref={listRef} id={`${uid}-menu`} role="menu" aria-label={label} onKeyDown={onKey} className="absolute right-0 z-40 mt-2 w-52 overflow-hidden rounded-2xl border border-gray-200 bg-white py-1 shadow-lg dark:border-zinc-800 dark:bg-zinc-900">
          {items.map((it) => {
            const Icon = it.icon;
            return (
              <button key={it.id || it.label} type="button" role="menuitem" disabled={it.disabled} tabIndex={-1}
                onClick={() => { close(false); it.onClick?.(); }}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-gray-800 hover:bg-gray-100 focus:bg-gray-100 focus:outline-none disabled:opacity-50 dark:text-zinc-100 dark:hover:bg-zinc-800 dark:focus:bg-zinc-800">
                {Icon && <Icon className="h-4 w-4 text-gray-500 dark:text-zinc-400" aria-hidden="true" />}{it.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
