import * as LucideIcons from 'lucide-react';

const normalizeLucideIconName = (iconName) => {
  if (!iconName) return '';

  const cleaned = iconName.trim();
  if (!cleaned) return '';

  const spaced = cleaned
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .trim();

  const parts = spaced
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 0) return '';

  return parts
    .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join('');
};

export const renderLucideIcon = (iconName, className = 'w-6 h-6', title = '') => {
  if (!iconName) {
    return <span className={className}>📄</span>;
  }

  const trimmedName = String(iconName).trim();
  const directIcon = LucideIcons[trimmedName];
  const normalizedName = normalizeLucideIconName(trimmedName);
  const IconComponent = directIcon || LucideIcons[normalizedName];

  if (IconComponent) {
    return <IconComponent className={className} title={title || normalizedName} />;
  }

  if (typeof iconName === 'string' && iconName.trim()) {
    return <span className={className}>{iconName}</span>;
  }

  return <span className={className}>📄</span>;
};
