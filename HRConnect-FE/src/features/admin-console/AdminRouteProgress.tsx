/**
 * @file AdminRouteProgress.tsx
 * @description Page-change feedback for the Admin console:
 *  - AdminTopProgress: thin emerald bar under the top edge while a page chunk or its data loads.
 *    It waits 150 ms before appearing so near-instant work never flashes a loader.
 *  - AdminPageSkeleton: Suspense fallback shaped like an admin page (hero + stats + table).
 *  - AdminPageEnter: fades/slides the new page in; disabled under prefers-reduced-motion.
 */
import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useIsFetching } from '@tanstack/react-query';
import './admin-console.css';

// ── Tiny store: how many route chunks are loading right now ─────────────────
let pendingChunks = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const usePendingChunks = () => useSyncExternalStore(subscribe, () => pendingChunks);

const SHOW_DELAY_MS = 150;
const FINISH_MS = 260;

type Phase = 'idle' | 'running' | 'finishing';

/** Top progress bar. `offsetLeft` keeps it beside the sidebar. */
export const AdminTopProgress: React.FC<{ offsetLeft: number }> = ({ offsetLeft }) => {
  const fetching = useIsFetching();
  const chunks = usePendingChunks();
  const busy = fetching > 0 || chunks > 0;
  const [phase, setPhase] = useState<Phase>('idle');
  const timer = useRef<number>();

  useEffect(() => {
    window.clearTimeout(timer.current);
    if (busy) {
      // Show only if the work outlasts the delay; restart cleanly if a finish was in flight.
      if (phase !== 'running') timer.current = window.setTimeout(() => setPhase('running'), phase === 'finishing' ? 0 : SHOW_DELAY_MS);
    } else if (phase === 'running') {
      setPhase('finishing');
      timer.current = window.setTimeout(() => setPhase('idle'), FINISH_MS + 200);
    }
    return () => window.clearTimeout(timer.current);
    // phase is intentionally read, not tracked: transitions are driven by `busy`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busy]);

  if (phase === 'idle') return null;
  return (
    <div className="pointer-events-none fixed right-0 top-0 z-40 h-[3px]" style={{ left: offsetLeft }} aria-hidden>
      <div className={`admin-progress-bar ${phase === 'finishing' ? 'admin-progress-bar--done' : ''}`} />
    </div>
  );
};

const Block: React.FC<{ className: string }> = ({ className }) => <div className={`admin-skeleton ${className}`} />;

/** Suspense fallback while a page's code chunk downloads. */
export const AdminPageSkeleton: React.FC = () => {
  useEffect(() => {
    pendingChunks += 1;
    emit();
    return () => {
      pendingChunks -= 1;
      emit();
    };
  }, []);

  return (
    <div className="admin-skeleton-wrap" aria-busy="true" aria-label="Đang tải trang" role="status">
      <Block className="mb-3 h-3 w-24" />
      <Block className="mb-3 h-7 w-72" />
      <Block className="mb-8 h-4 w-[28rem] max-w-full" />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="admin-surface p-5">
            <Block className="mb-3 h-3 w-20" />
            <Block className="h-7 w-14" />
          </div>
        ))}
      </div>
      <div className="admin-surface p-5">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-4 py-3">
            <Block className="h-9 w-9 !rounded-full" />
            <div className="flex-1">
              <Block className="mb-2 h-3.5 w-1/3" />
              <Block className="h-3 w-1/4" />
            </div>
            <Block className="h-3.5 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
};

/** Re-mounts on every path change so the incoming page eases in. */
export const AdminPageEnter: React.FC<{ pathKey: string; children: React.ReactNode }> = ({ pathKey, children }) => (
  <div key={pathKey} className="admin-page-enter">
    {children}
  </div>
);
