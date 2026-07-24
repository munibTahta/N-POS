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
    return (
      <div onClick={(e) => e.stopPropagation()}>
        <ActionButton
          onClick={(e) => {
            e.stopPropagation();
            if (onActionClick) onActionClick(action.key, item);
            action.onClick && action.onClick(item);
          }}
          icon={action.icon}
          title={action.title}
          variant={action.variant || 'primary'}
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
      
      // Calculate how many actions we have. Approx height is 36px per item + 8px padding
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
        className="inline-flex items-center justify-center w-8 h-8 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200"
        title="Pilihan Aksi"
      >
        <MoreVertical className="w-5 h-5" />
      </button>

      {isOpen && (
        <div className={`absolute right-0 w-40 bg-white border border-slate-200 rounded-lg shadow-xl z-50 py-1 focus:outline-none ${
          openUpward ? 'bottom-full mb-1 origin-bottom-right' : 'top-full mt-1 origin-top-right'
        }`}>
          {activeActions.map((action, index) => {
            const isDisabled = action.disabled && (typeof action.disabled === 'function' ? action.disabled(item) : action.disabled);
            const Icon = action.icon;
            
            // Map variants to text colors for the dropdown items
            const variantColors = {
              danger: 'text-red-600 hover:bg-red-50 disabled:text-red-300',
              primary: 'text-blue-600 hover:bg-blue-50 disabled:text-blue-300',
              success: 'text-green-600 hover:bg-green-50 disabled:text-green-300',
              warning: 'text-yellow-600 hover:bg-yellow-50 disabled:text-yellow-300',
              orange: 'text-orange-600 hover:bg-orange-50 disabled:text-orange-300',
              purple: 'text-purple-600 hover:bg-purple-50 disabled:text-purple-300',
              indigo: 'text-indigo-600 hover:bg-indigo-50 disabled:text-indigo-300',
              gray: 'text-slate-600 hover:bg-slate-50 disabled:text-slate-300'
            };
            const colorClass = variantColors[action.variant] || 'text-slate-700 hover:bg-slate-50 disabled:text-slate-300';

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
                <span>{action.title || action.label || 'Aksi'}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default DropdownActionMenu;
