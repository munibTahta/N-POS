import { useRef, useEffect } from 'react';

/**
 * Hook that returns a ref indicating if component is mounted
 * Useful for preventing state updates after unmount in async operations
 * 
 * Usage:
 * const isMounted = useIsMounted();
 * 
 * useEffect(() => {
 *   fetchData().then(result => {
 *     if (isMounted.current) {
 *       setState(result); // Won't warn about state update on unmounted component
 *     }
 *   });
 * }, [isMounted]);
 */
export const useIsMounted = () => {
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  return isMountedRef;
};

export default useIsMounted;
