import React, { useEffect, useState } from 'react';
import { formatRelativeDate, formatFullDate, parseFlexibleDate } from '../../utils/dateRange';

/**
 * Tanggal relatif ("Hari ini, 14.30", "Kemarin", "3 hari lalu", "12 Okt") dengan tooltip tanggal lengkap.
 * Memakai <time datetime> agar semantik. Menyegarkan diri tiap menit hanya bila tampil dalam rentang menit/jam
 * (agar "5 menit lalu" tidak basi).
 */
export default function RelativeDate({ value, withTime = true, className = '' }) {
  const [now, setNow] = useState(() => new Date());
  const d = parseFlexibleDate(value);
  const valid = !!d;
  const isRecent = valid && Math.abs(now.getTime() - d.getTime()) < 6 * 3600 * 1000;

  useEffect(() => {
    if (!isRecent) return undefined;
    const id = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(id);
  }, [isRecent]);

  if (!valid) return <span className={className}>-</span>;
  return (
    <time dateTime={d.toISOString()} title={formatFullDate(d)} className={className}>
      {formatRelativeDate(d, now, { withTime })}
    </time>
  );
}
