import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Search, CornerDownLeft } from 'lucide-react';
import { filterCommands } from '../../utils/commandSearch';

const RECENT_KEY = 'cmd_recent';
const readRecent = () => { try { const v = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); return Array.isArray(v) ? v.slice(0, 8) : []; } catch (_e) { return []; } };
const pushRecent = (id) => { try { localStorage.setItem(RECENT_KEY, JSON.stringify([id, ...readRecent().filter((x) => x !== id)].slice(0, 8))); } catch (_e) { /* abaikan */ } };

/**
 * Palet perintah (Ctrl/Cmd+K): lompat ke halaman atau jalankan aksi dengan mengetik.
 * items: [{ id, label, group, hint?, keywords?, icon?, run() }]. Pola ARIA combobox + listbox; Esc menutup; fokus dikembalikan.
 */
export default function CommandPalette({ open, onClose, items }) {
  if (!open) return null;
  return <PaletteBody onClose={onClose} items={items} />;
}

function PaletteBody({ onClose, items }) {
  const uid = useId();
  const listId = `${uid}-list`;
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const recent = useMemo(() => readRecent(), []);
  const results = useMemo(() => filterCommands(items, query, recent), [items, query, recent]);
  const safeActive = Math.min(active, Math.max(0, results.length - 1));

  useEffect(() => {
    const previous = document.activeElement;
    inputRef.current?.focus();
    return () => { if (previous && typeof previous.focus === 'function') previous.focus(); };
  }, []);

  useEffect(() => {
    listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [safeActive, results]);

  const choose = (item) => {
    if (!item) return;
    pushRecent(item.id);
    onClose();
    // jalankan setelah dialog tertutup agar fokus/navigasi tidak berebut
    setTimeout(() => item.run && item.run(), 0);
  };

  const onKeyDown = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onClose(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((safeActive + 1) % Math.max(1, results.length)); return; }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActive((safeActive - 1 + results.length) % Math.max(1, results.length)); return; }
    if (e.key === 'Home') { e.preventDefault(); setActive(0); return; }
    if (e.key === 'End') { e.preventDefault(); setActive(Math.max(0, results.length - 1)); return; }
    if (e.key === 'Enter') { e.preventDefault(); choose(results[safeActive]); return; }
    if (e.key === 'Tab') { e.preventDefault(); } // fokus tetap di kolom isian (satu-satunya kontrol)
  };

  // kelompokkan tetapi pertahankan urutan hasil (indeks aktif = indeks datar)
  const rows = [];
  let lastGroup = null;
  results.forEach((it, i) => {
    if (it.group !== lastGroup) { rows.push({ type: 'group', label: it.group || 'Lainnya', key: `g-${it.group}-${i}` }); lastGroup = it.group; }
    rows.push({ type: 'item', it, i, key: it.id });
  });

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center bg-black/50 p-4 pt-[10vh]" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Pencarian cepat"
        className="w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/5 dark:bg-zinc-900 dark:ring-white/10"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-gray-200 px-4 dark:border-zinc-800">
          <Search className="h-5 w-5 shrink-0 text-gray-500 dark:text-zinc-400" aria-hidden="true" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setActive(0); }}
            onKeyDown={onKeyDown}
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-activedescendant={results[safeActive] ? `${uid}-opt-${safeActive}` : undefined}
            aria-label="Cari halaman atau aksi"
            placeholder="Cari halaman atau aksi..."
            autoComplete="off"
            spellCheck="false"
            className="h-14 w-full min-w-0 bg-transparent text-base text-gray-900 outline-none placeholder:text-gray-500 dark:text-zinc-100 dark:placeholder:text-zinc-400"
          />
          <kbd className="hidden rounded-md border border-gray-300 px-1.5 py-0.5 text-xs text-gray-600 sm:block dark:border-zinc-700 dark:text-zinc-400">Esc</kbd>
        </div>

        <ul id={listId} ref={listRef} role="listbox" aria-label="Hasil" className="max-h-[52vh] overflow-y-auto p-2">
          {results.length === 0 && (
            <li role="presentation" className="px-3 py-8 text-center text-sm text-gray-600 dark:text-zinc-400">Tidak ada hasil untuk &quot;{query}&quot;.</li>
          )}
          {rows.map((r) => r.type === 'group' ? (
            <li key={r.key} role="presentation" className="px-3 pb-1 pt-3 text-xs font-semibold uppercase tracking-wide text-gray-500 first:pt-1 dark:text-zinc-400">{r.label}</li>
          ) : (
            <li
              key={r.key}
              id={`${uid}-opt-${r.i}`}
              role="option"
              aria-selected={r.i === safeActive}
              onMouseMove={() => setActive(r.i)}
              onClick={() => choose(r.it)}
              className={`flex min-h-[44px] cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-sm ${r.i === safeActive ? 'bg-blue-50 text-blue-900 dark:bg-blue-500/15 dark:text-blue-100' : 'text-gray-800 dark:text-zinc-200'}`}
            >
              {r.it.icon && <span className="flex h-5 w-5 items-center justify-center" aria-hidden="true">{r.it.icon}</span>}
              <span className="min-w-0 flex-1 truncate">{r.it.label}</span>
              {r.it.hint && <kbd className="rounded-md border border-gray-300 px-1.5 py-0.5 text-xs text-gray-600 dark:border-zinc-700 dark:text-zinc-400">{r.it.hint}</kbd>}
              {r.i === safeActive && <CornerDownLeft className="h-4 w-4 shrink-0 text-gray-500 dark:text-zinc-400" aria-hidden="true" />}
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-4 border-t border-gray-200 px-4 py-2 text-xs text-gray-600 dark:border-zinc-800 dark:text-zinc-400">
          <span><kbd className="font-sans">↑↓</kbd> pilih</span>
          <span><kbd className="font-sans">Enter</kbd> buka</span>
          <span><kbd className="font-sans">Esc</kbd> tutup</span>
        </div>
      </div>
    </div>
  );
}
