// src/hooks/useTimeout.js
import { useEffect, useRef } from 'react';

/**
 * Custom hook for setTimeout with automatic cleanup
 * Prevents memory leaks when component unmounts
 *
 * @param {Function} callback - Function to execute after delay
 * @param {number|null} delay - Delay in milliseconds, null to cancel
 * @returns {Function} Function to clear the timeout manually
 */
export const useTimeout = (callback, delay) => {
  const callbackRef = useRef(callback);
  const timeoutRef = useRef();

  // Update callback ref when callback changes
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  // Set up timeout when delay changes
  useEffect(() => {
    if (delay !== null) {
      timeoutRef.current = setTimeout(() => callbackRef.current(), delay);

      return () => {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
      };
    }
  }, [delay]);

  // Return function to clear timeout manually
  const clear = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  return clear;
};

export default useTimeout;