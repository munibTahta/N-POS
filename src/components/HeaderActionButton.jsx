import React from 'react';
import { Link } from 'react-router-dom';

/**
 * Header Action Button Component
 * Provides consistent, modular outline styling for header action buttons across all pages
 * Similar to ActionButton but optimized for page headers with label + icon
 * 
 * PROPS:
 * - icon: Icon component from lucide-react
 * - label: Button text
 * - variant: Color variant (default: 'blue')
 * - onClick: Click handler (for buttons)
 * - to: Route path (for react-router Links)
 * - isLink: true for react-router Link, false for button (default: false)
 * - loading: Show loading spinner
 * - disabled: Disable button
 * - hideLabel: Hide text on mobile, show only icon (use hideLabel={true} for responsive)
 * - title: Tooltip text
 * - className: Additional custom classes
 * 
 * VARIANTS (10 color options):
 * - blue, emerald, purple, red, yellow, orange, gray, indigo, teal, rose
 * 
 * EXAMPLES:
 * 
 * 1. Export Button:
 *    <HeaderActionButton
 *      icon={Download}
 *      label="Export Excel"
 *      variant="purple"
 *      onClick={handleExport}
 *      loading={isExporting}
 *      hideLabel={true}
 *    />
 * 
 * 2. Link Button (Navigation):
 *    <HeaderActionButton
 *      icon={ArrowUpDown}
 *      label="Transfer"
 *      variant="blue"
 *      to="/stok/transfer"
 *      isLink
 *      hideLabel={true}
 *    />
 * 
 * 3. Delete Button with full label on desktop:
 *    <HeaderActionButton
 *      icon={Trash2}
 *      label="Delete"
 *      variant="red"
 *      onClick={handleDelete}
 *      hideLabel={false}
 *    />
 * 
 * 4. Add new action:
 *    <HeaderActionButton
 *      icon={Plus}
 *      label="Tambah"
 *      variant="indigo"
 *      onClick={handleAdd}
 *    />
 * 
 * 5. Disabled button:
 *    <HeaderActionButton
 *      icon={Save}
 *      label="Simpan"
 *      variant="emerald"
 *      onClick={handleSave}
 *      disabled={!hasChanges}
 *    />
 */
export const HeaderActionButton = ({
  icon: Icon,
  label = '',
  variant = 'blue',
  onClick,
  to, // for react-router Link
  href, // for native anchor tag
  isLink = false, // true for react-router Link, false for button
  disabled = false,
  loading = false,
  title = '',
  className = '',
  hideLabel = false // Hide label on mobile (show only on sm and above)
}) => {
  const variants = {
    blue: {
      container: 'bg-blue-50 border border-blue-200 hover:bg-blue-100 focus:ring-blue-500',
      text: 'text-blue-700'
    },
    emerald: {
      container: 'bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 focus:ring-emerald-500',
      text: 'text-emerald-700'
    },
    purple: {
      container: 'bg-purple-50 border border-purple-200 hover:bg-purple-100 focus:ring-purple-500',
      text: 'text-purple-700'
    },
    red: {
      container: 'bg-red-50 border border-red-200 hover:bg-red-100 focus:ring-red-500',
      text: 'text-red-700'
    },
    yellow: {
      container: 'bg-yellow-50 border border-yellow-200 hover:bg-yellow-100 focus:ring-yellow-500',
      text: 'text-yellow-700'
    },
    orange: {
      container: 'bg-orange-50 border border-orange-200 hover:bg-orange-100 focus:ring-orange-500',
      text: 'text-orange-700'
    },
    gray: {
      container: 'bg-gray-50 border border-gray-200 hover:bg-gray-100 focus:ring-gray-500',
      text: 'text-gray-700'
    },
    indigo: {
      container: 'bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 focus:ring-indigo-500',
      text: 'text-indigo-700'
    },
    teal: {
      container: 'bg-teal-50 border border-teal-200 hover:bg-teal-100 focus:ring-teal-500',
      text: 'text-teal-700'
    },
    rose: {
      container: 'bg-rose-50 border border-rose-200 hover:bg-rose-100 focus:ring-rose-500',
      text: 'text-rose-700'
    }
  };

  const selectedVariant = variants[variant] || variants.blue;

  const baseClasses = `
    inline-flex items-center justify-center gap-2
    px-3 py-2 text-sm font-semibold rounded-lg
    transition-colors duration-200
    focus:outline-none focus:ring-2 focus:ring-offset-2
    disabled:opacity-50 disabled:cursor-not-allowed
    ${selectedVariant.container} ${selectedVariant.text} ${className}
  `.trim();

  const labelClasses = hideLabel ? 'hidden sm:inline' : 'inline';

  const buttonContent = (
    <>
      {loading ? (
        <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 2a10 10 0 0 1 0 20" />
        </svg>
      ) : Icon ? (
        <Icon className="w-4 h-4" />
      ) : null}
      {label && <span className={labelClasses}>{label}</span>}
    </>
  );

  // React Router Link
  if (isLink && to) {
    return (
      <Link
        to={to}
        title={title || label}
        className={baseClasses}
      >
        {buttonContent}
      </Link>
    );
  }

  // Native anchor tag
  if (href && !isLink) {
    return (
      <a
        href={href}
        title={title || label}
        className={baseClasses}
      >
        {buttonContent}
      </a>
    );
  }

  // Button
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      title={title || label}
      className={baseClasses}
    >
      {buttonContent}
    </button>
  );
};

export default HeaderActionButton;
