/**
 * @file useCompactLayout.ts
 * @description True below the lg breakpoint (1024px). Console shells use it to turn the fixed
 * sidebar into an off-canvas menu, so phones and tablets never scroll sideways.
 */
import { useEffect, useState } from 'react';

const QUERY = '(max-width: 1023px)';

/** `query` lets a shell with a wider top menu switch to the off-canvas menu earlier; the default stays at lg. */
export const useCompactLayout = (query: string = QUERY): boolean => {
  const [compact, setCompact] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches);

  useEffect(() => {
    const mq = window.matchMedia(query);
    const sync = () => setCompact(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, [query]);

  return compact;
};
