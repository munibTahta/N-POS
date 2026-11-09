import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X, Search, Settings, ShoppingCart, Users, CreditCard, Printer, Keyboard, Lightbulb } from 'lucide-react';
import { SHORTCUT_GROUPS, SHORTCUT_TIPS } from '../features/pos/shortcuts';

const ICONS = { Settings, Search, ShoppingCart, Users, CreditCard, Printer };
const IS_MAC = typeof navigator !== 'undefined' && /mac|iphone|ipad/i.test(navigator.platform || navigator.userAgent || '');
const keyLabel = (k) => (k === 'Mod' ? (IS_MAC ? '⌘' : 'Ctrl') : k);

function Keys({ combos }) {
  return (
    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
      {combos.map((combo, i) => (
        <React.Fragment key={combo.join('+')}>
          {i > 0 && <span className="text-xs text-gray-400">atau</span>}
          <span className="inline-flex items-center gap-1">
            {combo.map((k, j) => (
              <React.Fragment key={`${k}-${j}`}>
                {j > 0 && <span className="text-gray-400 text-xs">+</span>}
                <kbd className="min-w-[1.75rem] rounded-md border border-gray-300 border-b-2 bg-white px-1.5 py-0.5 text-center text-xs font-semibold text-gray-800 shadow-sm">{keyLabel(k)}</kbd>
              </React.Fragment>
            ))}
          </span>
        </React.Fragment>
      ))}
    </span>
  );
}

const flat = (combos) => combos.map((c) => c.map(keyLabel).join('+')).join(' ');

/** Bantuan pintasan keyboard: dapat dicari, dialog aksesibel (Esc, jebakan fokus, fokus kembali). */
export default function ShortcutModal({ onClose }) {
  const [query, setQuery] = useState('');
  const dialogRef = useRef(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  useEffect(() => {
    const previous = document.activeElement;
    const onKey = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); onCloseRef.current?.(); return; }
      if (e.key !== 'Tab' || !dialogRef.current) return;
      const f = dialogRef.current.querySelectorAll('button, input, [href], [tabindex]:not([tabindex="-1"])');
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      if (previous && typeof previous.focus === 'function') previous.focus();
    };
  }, []);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return SHORTCUT_GROUPS;
    return SHORTCUT_GROUPS
      .map((g) => ({ ...g, items: g.items.filter((it) => it.description.toLowerCase().includes(q) || flat(it.keys).toLowerCase().includes(q)) }))
      .filter((g) => g.items.length > 0);
  }, [query]);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4" onClick={onClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcut-title"
        className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl sm:rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-gray-200 px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-blue-600"><Keyboard className="h-5 w-5" aria-hidden="true" /></span>
            <div>
              <h2 id="shortcut-title" className="text-lg font-semibold text-gray-900">Pintasan keyboard</h2>
              <p className="text-sm text-gray-500">Tekan <kbd className="rounded border border-gray-300 bg-gray-50 px-1 text-xs">?</kbd> kapan saja untuk membuka bantuan ini.</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="btn-icon btn-text text-gray-500" aria-label="Tutup bantuan pintasan">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-5 pt-4">
          <label htmlFor="shortcut-search" className="sr-only">Cari pintasan</label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
            <input
              id="shortcut-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari pintasan, mis. bayar, diskon, F2"
              className="w-full rounded-xl border border-gray-300 py-2.5 pl-9 pr-3 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              autoFocus
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {groups.length > 0 ? (
            <div className="grid gap-5 sm:grid-cols-2">
              {groups.map((g) => {
                const Icon = ICONS[g.icon] || Keyboard;
                return (
                  <section key={g.group} aria-label={g.group}>
                    <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-900">
                      <Icon className="h-4 w-4 text-blue-600" aria-hidden="true" />{g.group}
                    </h3>
                    <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200">
                      {g.items.map((it) => (
                        <li key={flat(it.keys)} className="flex flex-col gap-1 px-3 py-2">
                          <Keys combos={it.keys} />
                          <span className="text-sm text-gray-600">{it.description}</span>
                        </li>
                      ))}
                    </ul>
                  </section>
                );
              })}
            </div>
          ) : (
            <p className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">Tidak ada pintasan yang cocok dengan &quot;{query}&quot;.</p>
          )}

          {!query && (
            <section className="mt-5 rounded-xl bg-amber-50 p-4" aria-label="Tips">
              <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-amber-900"><Lightbulb className="h-4 w-4" aria-hidden="true" />Tips</h3>
              <ul className="list-disc space-y-1 pl-5 text-sm text-amber-900">
                {SHORTCUT_TIPS.map((t) => <li key={t}>{t}</li>)}
              </ul>
            </section>
          )}
        </div>

        <div className="border-t border-gray-200 px-5 py-3">
          <button type="button" onClick={onClose} className="btn-primary btn-block">Mengerti</button>
        </div>
      </div>
    </div>
  );
}
