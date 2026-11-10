import React from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Plus } from 'lucide-react';

/**
 * Tombol aksi di header halaman. Mengikuti hierarki tombol sistem desain (docs/DESIGN_SYSTEM.md):
 *   - SATU aksi utama per halaman -> `btn-primary` (terisi). Otomatis untuk ikon Plus atau label berawalan
 *     Tambah/Buat/Baru/Simpan, atau `emphasis="primary"`.
 *   - Aksi sekunder (Export, Import, Template, Info, dst.) -> `btn-outlined` netral. Jangan memberi warna berbeda tiap tombol:
 *     warna hanya untuk makna (merah = merusak), bukan dekorasi.
 *   - Aksi merusak (`variant` red/rose/danger atau `emphasis="danger"`) -> `btn-danger-outlined`.
 * Prop `variant` lama (blue/emerald/purple/...) tetap diterima agar pemanggil lama tidak rusak, tetapi tidak lagi mewarnai tombol.
 *
 * Props: icon, label, onClick, to+isLink (react-router), href, disabled, loading, hideLabel (hanya ikon di layar kecil),
 *        title, className, emphasis ('primary' | 'secondary' | 'danger').
 */
const DANGER = new Set(['red', 'rose', 'danger']);
const PRIMARY_LABEL = /^(tambah|buat|baru|simpan|add|new|create)\b/i;

function resolveEmphasis({ emphasis, variant, label, icon }) {
  if (emphasis) return emphasis;
  if (DANGER.has(variant)) return 'danger';
  if (variant === 'primary' || icon === Plus || PRIMARY_LABEL.test(String(label || '').trim())) return 'primary';
  return 'secondary';
}

const CLASS_BY_EMPHASIS = { primary: 'btn-primary', secondary: 'btn-outlined', danger: 'btn-danger-outlined' };

export const HeaderActionButton = ({
  icon: Icon,
  label = '',
  variant = 'blue',
  emphasis,
  onClick,
  to,
  href,
  isLink = false,
  disabled = false,
  loading = false,
  title = '',
  className = '',
  hideLabel = false,
}) => {
  const level = resolveEmphasis({ emphasis, variant, label, icon: Icon });
  const classes = `${CLASS_BY_EMPHASIS[level]} ${className}`.trim();
  const accessibleName = title || label || undefined;
  const content = (
    <>
      {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : Icon ? <Icon className="h-4 w-4" aria-hidden="true" /> : null}
      {label && <span className={hideLabel ? 'hidden sm:inline' : 'inline'}>{label}</span>}
    </>
  );

  if (isLink && to) {
    return <Link to={to} title={accessibleName} aria-label={hideLabel ? accessibleName : undefined} className={classes}>{content}</Link>;
  }
  if (href && !isLink) {
    return <a href={href} title={accessibleName} aria-label={hideLabel ? accessibleName : undefined} className={classes}>{content}</a>;
  }
  return (
    <button type="button" onClick={onClick} disabled={disabled || loading} aria-busy={loading || undefined} title={accessibleName} aria-label={hideLabel ? accessibleName : undefined} className={classes}>
      {content}
    </button>
  );
};

export default HeaderActionButton;
