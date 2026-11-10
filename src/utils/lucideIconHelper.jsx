import React, { lazy, Suspense } from 'react';
import { FileQuestion } from 'lucide-react';
// Peta nama-ikon -> import() per ikon. Tiap ikon menjadi chunk kecil yang dimuat saat dibutuhkan,
// bukan seluruh ~1900 ikon di bundel utama (nama ikon menu disimpan di database, jadi harus dinamis).
import dynamicIconImports from 'lucide-react/dynamicIconImports.mjs';
import { toLucideKebab } from './lucideIconName';

// Cache komponen lazy agar tidak dibuat ulang di setiap render (itu akan me-remount ikon terus-menerus).
const lazyIcons = new Map();
const getLazyIcon = (kebab) => {
  let Icon = lazyIcons.get(kebab);
  if (!Icon) {
    Icon = lazy(dynamicIconImports[kebab]);
    lazyIcons.set(kebab, Icon);
  }
  return Icon;
};

export const renderLucideIcon = (iconName, className = 'w-6 h-6', title = '') => {
  if (!iconName) {
    return <FileQuestion className={className} />;
  }

  const kebab = toLucideKebab(iconName);
  if (kebab && Object.prototype.hasOwnProperty.call(dynamicIconImports, kebab)) {
    const Icon = getLazyIcon(kebab);
    return (
      // Placeholder seukuran ikon agar tata letak tidak bergeser saat ikon dimuat.
      <Suspense fallback={<span className={className} aria-hidden="true" />}>
        <Icon className={className} title={title || kebab} />
      </Suspense>
    );
  }

  if (typeof iconName === 'string' && iconName.trim()) {
    return <span className={className}>{iconName}</span>;
  }

  return <FileQuestion className={className} />;
};
