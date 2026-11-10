import { useEffect, useState } from 'react';

/** Mengikuti media query secara reaktif (mis. '(min-width: 1024px)'). Aman untuk SSR/tes.
 *  Nilai awal dibaca sekali; `query` diharapkan konstan selama komponen hidup. */
export function useMediaQuery(query) {
  const get = () => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(query).matches : false);
  const [matches, setMatches] = useState(get);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const mql = window.matchMedia(query);
    const onChange = (e) => setMatches(e.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}

export default useMediaQuery;
