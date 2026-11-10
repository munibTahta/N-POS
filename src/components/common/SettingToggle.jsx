import React, { useId } from 'react';

/**
 * Baris pengaturan on/off yang ringkas: judul + keterangan di kiri, saklar di kanan.
 * Memakai <input type="checkbox" role="switch"> sungguhan sehingga `name`/`onChange` form lama tetap bekerja dan
 * dapat dioperasikan dengan keyboard (Spasi) serta dibaca pembaca layar ("saklar, aktif").
 */
export default function SettingToggle({ name, label, desc, checked, onChange, disabled = false }) {
  const id = useId();
  return (
    <label htmlFor={id} className={`flex items-center justify-between gap-4 py-3 ${disabled ? 'opacity-60' : 'cursor-pointer'}`}>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-gray-900 dark:text-zinc-100">{label}</span>
        {desc && <span className="mt-0.5 block text-xs text-gray-500 dark:text-zinc-400">{desc}</span>}
      </span>
      <span className="relative inline-flex shrink-0">
        <input id={id} type="checkbox" role="switch" name={name} checked={!!checked} onChange={onChange} disabled={disabled} className="peer sr-only" />
        <span aria-hidden="true" className="h-6 w-11 rounded-full bg-gray-300 transition-colors peer-checked:bg-blue-600 peer-focus-visible:ring-2 peer-focus-visible:ring-blue-600 peer-focus-visible:ring-offset-2 dark:bg-zinc-600 dark:peer-focus-visible:ring-offset-zinc-900" />
        <span aria-hidden="true" className="pointer-events-none absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
      </span>
    </label>
  );
}
