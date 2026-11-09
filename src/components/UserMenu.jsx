import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, Settings, Sun, Moon, Keyboard, LogOut } from 'lucide-react';

const initials = (name = '') => {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] || '?') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
};

/**
 * Menu pengguna (satu-satunya tempat identitas + aksi akun): avatar inisial, nama, peran; berisi Pengaturan, tema,
 * bantuan pintasan, dan Keluar. Pola ARIA menu: panah atas/bawah memindah fokus, Esc menutup dan mengembalikan fokus.
 */
export default function UserMenu({ name, roleLabel, branchName, theme, onToggleTheme, onOpenHelp, onLogout }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDown);
    menuRef.current?.querySelector('[role="menuitem"]')?.focus();
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const close = (returnFocus = true) => { setOpen(false); if (returnFocus) triggerRef.current?.focus(); };
  const act = (fn) => () => { setOpen(false); fn?.(); };

  const onMenuKey = (e) => {
    const items = [...menuRef.current.querySelectorAll('[role="menuitem"]')];
    const i = items.indexOf(document.activeElement);
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); items[(i + 1) % items.length]?.focus(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); items[(i - 1 + items.length) % items.length]?.focus(); }
    else if (e.key === 'Home') { e.preventDefault(); items[0]?.focus(); }
    else if (e.key === 'End') { e.preventDefault(); items[items.length - 1]?.focus(); }
    else if (e.key === 'Tab') setOpen(false);
  };

  const itemClass = 'flex min-h-[44px] w-full items-center gap-3 px-4 text-left text-sm text-gray-800 hover:bg-gray-100 focus:bg-gray-100 focus:outline-none dark:text-zinc-200 dark:hover:bg-zinc-800 dark:focus:bg-zinc-800';

  return (
    <div className="relative" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Menu pengguna: ${name}`}
        className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2 transition hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 dark:hover:bg-zinc-800 lg:pr-3"
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-800 dark:bg-blue-500/20 dark:text-blue-200" aria-hidden="true">{initials(name)}</span>
        <span className="hidden text-left lg:block">
          <span className="block max-w-[11rem] truncate text-sm font-medium leading-tight text-gray-900 dark:text-zinc-100">{name}</span>
          <span className="block text-xs leading-tight text-gray-600 dark:text-zinc-400">{roleLabel}</span>
        </span>
        <ChevronDown className={`h-4 w-4 text-gray-500 transition-transform dark:text-zinc-400 ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>

      {open && (
        <div ref={menuRef} role="menu" aria-label="Menu pengguna" onKeyDown={onMenuKey} className="absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-2xl border border-gray-200 bg-white py-1 shadow-lg dark:border-zinc-800 dark:bg-zinc-900">
          <div className="px-4 py-3" role="none">
            <p className="truncate text-sm font-semibold text-gray-900 dark:text-zinc-100">{name}</p>
            <p className="truncate text-xs text-gray-600 dark:text-zinc-400">{[roleLabel, branchName].filter(Boolean).join(' • ')}</p>
          </div>
          <div className="border-t border-gray-200 py-1 dark:border-zinc-800" role="none">
            <Link to="/pengaturan" role="menuitem" tabIndex={-1} onClick={act()} className={itemClass}>
              <Settings className="h-4 w-4 text-gray-500 dark:text-zinc-400" aria-hidden="true" /> Pengaturan
            </Link>
            <button type="button" role="menuitem" tabIndex={-1} onClick={act(onToggleTheme)} className={itemClass}>
              {theme === 'light' ? <Moon className="h-4 w-4 text-gray-500" aria-hidden="true" /> : <Sun className="h-4 w-4 text-gray-400" aria-hidden="true" />}
              {theme === 'light' ? 'Tema gelap' : 'Tema terang'}
            </button>
            <button type="button" role="menuitem" tabIndex={-1} onClick={act(onOpenHelp)} className={itemClass}>
              <Keyboard className="h-4 w-4 text-gray-500 dark:text-zinc-400" aria-hidden="true" /> Pintasan keyboard
              <kbd className="ml-auto rounded border border-gray-300 px-1.5 text-xs text-gray-600 dark:border-zinc-700 dark:text-zinc-400">?</kbd>
            </button>
          </div>
          <div className="border-t border-gray-200 py-1 dark:border-zinc-800" role="none">
            <button type="button" role="menuitem" tabIndex={-1} onClick={act(onLogout)} className={`${itemClass} text-red-700 dark:text-red-300`}>
              <LogOut className="h-4 w-4" aria-hidden="true" /> Keluar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
