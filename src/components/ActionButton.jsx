import React, { useMemo, useCallback } from 'react';

/**
 * Unified Action Button Component
 * Provides consistent styling across all pages
 *
 * Usage - Icon Only (default):
 * <ActionButton
 *   icon={EditIcon}
 *   variant="primary"
 *   title="Edit item"
 *   onClick={() => handleEdit()}
 * />
 *
 * Usage - Icon + Label:
 * <ActionButton
 *   icon={EditIcon}
 *   label="Edit"
 *   variant="primary"
 *   title="Edit item"
 *   onClick={() => handleEdit()}
 * />
 */
export const ActionButton = React.memo(({
  icon: Icon,
  label = '',
  title = '',
  variant = 'primary',
  onClick,
  disabled = false,
  className = '',
  size = 'sm',
  showLabel = false  // Controls whether label is shown
}) => {
  // Memoize variant styles
  const selectedVariant = useMemo(() => {
    const variants = {
      primary: {
        container: 'bg-blue-50 border border-blue-200 hover:bg-blue-100 focus:ring-blue-500',
        text: 'text-blue-700'
      },
      success: {
        container: 'bg-green-50 border border-green-200 hover:bg-green-100 focus:ring-green-500',
        text: 'text-green-700'
      },
      danger: {
        container: 'bg-red-50 border border-red-200 hover:bg-red-100 focus:ring-red-500',
        text: 'text-red-700'
      },
      warning: {
        container: 'bg-yellow-50 border border-yellow-200 hover:bg-yellow-100 focus:ring-yellow-500',
        text: 'text-yellow-700'
      },
      orange: {
        container: 'bg-orange-50 border border-orange-200 hover:bg-orange-100 focus:ring-orange-500',
        text: 'text-orange-700'
      },
      purple: {
        container: 'bg-purple-50 border border-purple-200 hover:bg-purple-100 focus:ring-purple-500',
        text: 'text-purple-700'
      },
      indigo: {
        container: 'bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 focus:ring-indigo-500',
        text: 'text-indigo-700'
      },
      gray: {
        container: 'bg-gray-50 border border-gray-200 hover:bg-gray-100 focus:ring-gray-500',
        text: 'text-gray-700'
      }
    };
    return variants[variant] || variants.primary;
  }, [variant]);

  // Memoize size classes
  const sizeClasses = useMemo(() => {
    const classes = {
      xs: 'w-6 h-6 text-xs',
      sm: 'w-8 h-8 text-sm',
      md: 'w-10 h-10 text-base',
      lg: 'w-12 h-12 text-lg'
    };
    return classes[size] || classes.sm;
  }, [size]);

  const labelSizeClasses = useMemo(() => {
    const classes = {
      xs: 'px-2 py-1 text-xs gap-1',
      sm: 'px-2 py-1 text-xs sm:text-sm gap-1',
      md: 'px-3 py-2 text-sm gap-2',
      lg: 'px-4 py-2 text-base gap-2'
    };
    return classes[size] || classes.sm;
  }, [size]);

  // Memoized click handler
  const handleClick = useCallback((e) => {
    if (onClick && !disabled) {
      onClick(e);
    }
  }, [onClick, disabled]);

  // If showing label, use flexible width with padding
  if (showLabel && label) {
    return (
      <button
        onClick={handleClick}
        disabled={disabled}
        title={title || label}
        className={`inline-flex items-center font-medium rounded-full transition-colors
          focus:outline-none focus:ring-2 focus:ring-offset-2
          disabled:opacity-50 disabled:cursor-not-allowed
          ${selectedVariant.container} ${selectedVariant.text} ${labelSizeClasses} ${className}`}
      >
        {Icon && <Icon className="w-4 h-4" />}
        <span>{label}</span>
      </button>
    );
  }

  // Default: Icon only
  return (
    <button
      onClick={handleClick}
      disabled={disabled}
      title={title || label}
      className={`inline-flex items-center justify-center font-medium rounded-full transition-colors
        focus:outline-none focus:ring-2 focus:ring-offset-2
        disabled:opacity-50 disabled:cursor-not-allowed
        ${selectedVariant.container} ${selectedVariant.text} ${sizeClasses} ${className}`}
    >
      {Icon && <Icon className="w-4 h-4" />}
    </button>
  );
});

ActionButton.displayName = 'ActionButton';

export default ActionButton;
