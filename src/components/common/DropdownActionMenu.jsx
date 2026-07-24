import React, { useState, useRef, useEffect } from 'react';
import { MoreVertical } from 'lucide-react';
import ActionButton from '../ActionButton';

export const DropdownActionMenu = ({ actions = [], item, onActionClick }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [openUpward, setOpenUpward] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const activeActions = actions.filter(action => {
    if (action.show === false) return false;
    if (typeof action.show === 'function') return action.show(item);
    return true;
  });

  if (activeActions.length === 0) return null;

  if (activeActions.length === 1) {
    const action = activeActions[0];
    const titleVal = typeof action.title === 'function' ? action.title(item) : action.title;
    const variantVal = typeof action.variant === 'function' ? action.variant(item) : (action.variant || 'primary');
    return (
      <div onClick={(e) => e.stopPropagation()}>
        <ActionButton
          onClick={(e) => {
            e.stopPropagation();
            if (onActionClick) onActionClick(action.key, item);
            action.onClick && action.onClick(item);
          }}
          icon={action.icon}
          title={titleVal}
          variant={variantVal}
          size={action.size || 'sm'}
          disabled={action.disabled && (typeof action.disabled === 'function' ? action.disabled(item) : action.disabled)}
          className={action.className || ''}
        />
      </div>
    );
  }

  const handleToggle = (e) => {
    e.stopPropagation();
    if (!isOpen && menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const spaceBelow = viewportHeight - rect.bottom;
      const spaceAbove = rect.top;
      
      const approxHeight = (activeActions.length * 36) + 16;
      
      if (spaceBelow < approxHeight && spaceAbove > spaceBelow) {
        setOpenUpward(true);
      } else {
        setOpenUpward(false);
      }
    }
    setIsOpen(!isOpen);
  };

  return (
    <div className="relative inline-block text-left" ref={menuRef} onClick={(e) => e.stopPropagation()}>
      <button
        onClick={handleToggle}
        className="inline-flex items-center justify-center w-8 h-8 text-slate-400 dark:text-zinc-500 hover:text-slate-600 dark:hover:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200"
        title="Pilihan Aksi"
      >
        <MoreVertical className="w-5 h-5" />
      </button>

      {isOpen && (
        <div className={`absolute right-0 w-44 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl shadow-2xl z-50 py-1 focus:outline-none ${
          openUpward ? 'bottom-full mb-1 origin-bottom-right' : 'top-full mt-1 origin-top-right'
        }`}>
          {activeActions.map((action, index) => {
            const isDisabled = action.disabled && (typeof action.disabled === 'function' ? action.disabled(item) : action.disabled);
            const Icon = action.icon;
            const titleVal = typeof action.title === 'function' ? action.title(item) : (action.title || action.label || 'Aksi');
            const variantVal = typeof action.variant === 'function' ? action.variant(item) : (action.variant || 'gray');
            
            const variantColors = {
              danger: 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 disabled:text-red-300 dark:disabled:text-red-900',
              primary: 'text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/20 disabled:text-blue-300 dark:disabled:text-blue-900',
              success: 'text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-950/20 disabled:text-green-300 dark:disabled:text-green-900',
              warning: 'text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/20 disabled:text-amber-300 dark:disabled:text-amber-900',
              orange: 'text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-950/20 disabled:text-orange-300 dark:disabled:text-orange-900',
              purple: 'text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/20 disabled:text-purple-300 dark:disabled:text-purple-900',
              indigo: 'text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/20 disabled:text-indigo-300 dark:disabled:text-indigo-900',
              gray: 'text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800/40 disabled:text-slate-300 dark:disabled:text-zinc-700'
            };
            const colorClass = variantColors[variantVal] || 'text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800/40 disabled:text-slate-300 dark:disabled:text-zinc-700';

            return (
              <button
                key={index}
                disabled={isDisabled}
                onClick={() => {
                  setIsOpen(false);
                  if (onActionClick) onActionClick(action.key, item);
                  action.onClick && action.onClick(item);
                }}
                className={`w-full text-left px-4 py-2 text-sm flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${colorClass}`}
              >
                {Icon && <Icon className="w-4 h-4 flex-shrink-0" />}
                <span>{titleVal}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default DropdownActionMenu;
