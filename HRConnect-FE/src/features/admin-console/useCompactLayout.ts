/**
 * @file useCompactLayout.ts
 * @description True below the lg breakpoint (1024px). Console shells use it to turn the fixed
 * sidebar into an off-canvas menu, so phones and tablets never scroll sideways.
 */
import { useEffect, useState } from 'react';

const QUERY = '(max-width: 1023px)';

export const useCompactLayout = (): boolean => {
  const [compact, setCompact] = useState(() => typeof window !== 'undefined' && window.matchMedia(QUERY).matches);

  useEffect(() => {
    const mq = window.matchMedia(QUERY);
    const sync = () => setCompact(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  return compact;
};
