import React, { useState } from 'react';
import { CalendarClock } from 'lucide-react';
import { setSaleDueDate } from '../../services/api';
import { useNotifications } from '../../hooks/useNotifications';
import DueDatePicker from '../../features/pos/components/DueDatePicker';

/** Tombol kecil "Atur jatuh tempo" untuk piutang yang sudah tercatat: buka pemilih, simpan ke server, lalu panggil `onSaved`. */
export default function DueDateEditor({ saleId, current = '', onSaved, className = '' }) {
  const { success: showSuccess, error: showError } = useNotifications();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(current || '');
  const [saving, setSaving] = useState(false);

  if (!saleId) return null;

  const save = async () => {
    setSaving(true);
    try {
      await setSaleDueDate(saleId, value || null);
      showSuccess(value ? 'Jatuh tempo disimpan' : 'Jatuh tempo dihapus');
      setOpen(false);
      onSaved?.(value || null);
    } catch (err) {
      showError(err?.response?.data?.message || err?.message || 'Gagal menyimpan jatuh tempo');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => { setValue(current || ''); setOpen((v) => !v); }}
        aria-expanded={open}
        className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:text-blue-900 touch-manipulation"
      >
        <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
        {current ? 'Ubah jatuh tempo' : 'Atur jatuh tempo'}
      </button>
      {open && (
        <div className="mt-2 max-w-sm">
          <DueDatePicker value={value} onChange={setValue} />
          <div className="mt-2 flex gap-2">
            <button type="button" disabled={saving} onClick={save} className="btn-primary btn-sm">{saving ? 'Menyimpan...' : 'Simpan'}</button>
            <button type="button" disabled={saving} onClick={() => setOpen(false)} className="btn-text btn-sm">Batal</button>
          </div>
        </div>
      )}
    </div>
  );
}
