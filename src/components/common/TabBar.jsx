import React, { useRef } from 'react';

/**
 * Tab horizontal standar (WAI-ARIA tabs): panah kiri/kanan, Home/End, aktivasi otomatis.
 * tabs: [{ id, label, icon?: Component, badge?: ReactNode }]. Panel memakai `tabPanelProps(id)`.
 * Konten panel sebaiknya disembunyikan dengan `hidden` (bukan dilepas) agar isian form tidak hilang saat pindah tab.
 */
export const tabId = (prefix, id) => `${prefix}-tab-${id}`;
export const panelId = (prefix, id) => `${prefix}-panel-${id}`;
export const tabPanelProps = (prefix, id, active) => ({ role: 'tabpanel', id: panelId(prefix, id), 'aria-labelledby': tabId(prefix, id), hidden: active !== id });

export default function TabBar({ tabs, value, onChange, prefix = 'tabs', label = 'Bagian', className = '' }) {
  const refs = useRef({});
  const move = (i, dir) => {
    const n = tabs.length;
    const next = tabs[dir === 'home' ? 0 : dir === 'end' ? n - 1 : (i + dir + n) % n];
    onChange(next.id);
    refs.current[next.id]?.focus();
  };
  return (
    <div role="tablist" aria-label={label} className={`mb-4 flex gap-1 overflow-x-auto border-b border-gray-200 dark:border-zinc-700 ${className}`}>
      {tabs.map((t, i) => {
        const on = t.id === value;
        const Icon = t.icon;
        return (
          <button
            key={t.id} ref={(el) => { refs.current[t.id] = el; }} type="button" role="tab"
            id={tabId(prefix, t.id)} aria-selected={on} aria-controls={panelId(prefix, t.id)} tabIndex={on ? 0 : -1}
            onClick={() => onChange(t.id)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight') { e.preventDefault(); move(i, 1); }
              else if (e.key === 'ArrowLeft') { e.preventDefault(); move(i, -1); }
              else if (e.key === 'Home') { e.preventDefault(); move(i, 'home'); }
              else if (e.key === 'End') { e.preventDefault(); move(i, 'end'); }
            }}
            className={`-mb-px inline-flex shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${on ? 'border-blue-600 text-blue-700 dark:border-blue-400 dark:text-blue-300' : 'border-transparent text-gray-600 hover:border-gray-300 hover:text-gray-900 dark:text-zinc-400 dark:hover:text-zinc-100'}`}
          >
            {Icon && <Icon className="h-4 w-4" aria-hidden="true" />}{t.label}{t.badge}
          </button>
        );
      })}
    </div>
  );
}
