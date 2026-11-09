import React, { useState } from 'react';

/**
 * Shared visual shell for Material-style floating label fields.
 * The label sits inside the field at rest and floats up onto the
 * border line when the field is focused or has a value, so a page
 * full of these reads as a clean grid of bordered boxes (easy to scan)
 * instead of a stack of separate label+input pairs.
 */
const FloatingLabelShell = ({
  label,
  required,
  error,
  helper,
  icon: Icon,
  rightElement,
  isFloated,
  disabled,
  className = '',
  children,
}) => {
  const borderColor = error
    ? 'border-red-400 dark:border-red-500'
    : 'border-gray-300 dark:border-zinc-600';
  const labelColor = error
    ? 'text-red-500 dark:text-red-400'
    : isFloated
      ? 'text-blue-600 dark:text-blue-400'
      : 'text-gray-500 dark:text-zinc-400';

  return (
    <div className={`md-field ${className}`}>
      <div className={`relative rounded-xl border bg-white dark:bg-zinc-900 transition-colors duration-150 ${borderColor} ${disabled ? 'opacity-50' : ''}`}>
        {Icon && (
          <Icon className={`pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isFloated ? 'text-blue-500' : 'text-gray-400 dark:text-zinc-500'}`} />
        )}

        {children}

        {rightElement && (
          <div className="absolute right-1 top-1/2 -translate-y-1/2">{rightElement}</div>
        )}

        <label
          className={`absolute select-none pointer-events-none origin-left bg-white dark:bg-zinc-900 px-1 transition-all duration-150 ease-out
            ${Icon ? 'left-9' : 'left-3'}
            ${isFloated ? '-top-2 text-xs font-medium' : 'top-1/2 -translate-y-1/2 text-sm'}
            ${labelColor}`}
        >
          {label}
          {required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      </div>

      {(helper || error) && (
        <p className={`text-xs mt-1 ${error ? 'text-red-500 dark:text-red-400' : 'text-gray-500 dark:text-zinc-500'}`}>
          {error || helper}
        </p>
      )}
    </div>
  );
};

const baseFieldClasses = 'peer w-full bg-transparent text-sm text-gray-900 dark:text-zinc-100 focus:outline-none disabled:cursor-not-allowed';

export const FloatingLabelInput = React.forwardRef(({
  id,
  name,
  label,
  value,
  onChange,
  onFocus,
  onBlur,
  required = false,
  disabled = false,
  error,
  helper,
  icon,
  rightElement,
  className = '',
  inputClassName = '',
  ...rest
}, ref) => {
  const [isFocused, setIsFocused] = useState(false);
  const hasValue = value !== undefined && value !== null && String(value).length > 0;
  const isFloated = isFocused || hasValue;

  return (
    <FloatingLabelShell
      label={label}
      required={required}
      error={error}
      helper={helper}
      icon={icon}
      rightElement={rightElement}
      isFloated={isFloated}
      disabled={disabled}
      className={className}
    >
      <input
        ref={ref}
        id={id || name}
        name={name}
        value={value}
        onChange={onChange}
        required={required}
        disabled={disabled}
        onFocus={(e) => { setIsFocused(true); onFocus?.(e); }}
        onBlur={(e) => { setIsFocused(false); onBlur?.(e); }}
        className={`${baseFieldClasses} ${icon ? 'pl-9' : 'pl-3'} ${rightElement ? 'pr-10' : 'pr-3'} pt-5 pb-2 rounded-xl ${inputClassName}`}
        {...rest}
      />
    </FloatingLabelShell>
  );
});
FloatingLabelInput.displayName = 'FloatingLabelInput';

export const FloatingLabelTextarea = ({
  id,
  name,
  label,
  value,
  onChange,
  onFocus,
  onBlur,
  required = false,
  disabled = false,
  error,
  helper,
  rows = 3,
  className = '',
  inputClassName = '',
  ...rest
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const hasValue = value !== undefined && value !== null && String(value).length > 0;
  const isFloated = isFocused || hasValue;

  return (
    <FloatingLabelShell
      label={label}
      required={required}
      error={error}
      helper={helper}
      isFloated={isFloated}
      disabled={disabled}
      className={className}
    >
      <textarea
        id={id || name}
        name={name}
        value={value}
        onChange={onChange}
        required={required}
        disabled={disabled}
        rows={rows}
        onFocus={(e) => { setIsFocused(true); onFocus?.(e); }}
        onBlur={(e) => { setIsFocused(false); onBlur?.(e); }}
        className={`${baseFieldClasses} px-3 pt-5 pb-2 rounded-xl resize-y ${inputClassName}`}
        {...rest}
      />
    </FloatingLabelShell>
  );
};

export const FloatingLabelSelect = ({
  id,
  name,
  label,
  value,
  onChange,
  onFocus,
  onBlur,
  required = false,
  disabled = false,
  error,
  helper,
  icon,
  className = '',
  inputClassName = '',
  children,
  ...rest
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const hasValue = value !== undefined && value !== null && String(value).length > 0;
  const isFloated = isFocused || hasValue;

  return (
    <FloatingLabelShell
      label={label}
      required={required}
      error={error}
      helper={helper}
      icon={icon}
      isFloated={isFloated}
      disabled={disabled}
      className={className}
    >
      <select
        id={id || name}
        name={name}
        value={value}
        onChange={onChange}
        required={required}
        disabled={disabled}
        onFocus={(e) => { setIsFocused(true); onFocus?.(e); }}
        onBlur={(e) => { setIsFocused(false); onBlur?.(e); }}
        className={`${baseFieldClasses} ${icon ? 'pl-9 pr-8' : 'px-3 pr-8'} pt-5 pb-2 rounded-xl cursor-pointer appearance-none ${inputClassName}`}
        {...rest}
      >
        {children}
      </select>
      <svg className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-zinc-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </FloatingLabelShell>
  );
};
