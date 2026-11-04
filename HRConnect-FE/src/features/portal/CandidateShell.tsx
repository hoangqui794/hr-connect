/**
 * @file CandidateShell.tsx
 * @description Persistent Candidate workspace with unified Navbar navigation matching homepage.
 */
import React, { Suspense } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Navbar } from '@/features/landing/components/Navbar';
import { AdminPageEnter, AdminPageSkeleton, AdminTopProgress } from '@/features/admin-console/AdminRouteProgress';
import '@/features/admin-console/admin-console.css';
import './candidate/candidate.css';

export const CandidateShell: React.FC = () => {
  const location = useLocation();

  const isCvBuilder = location.pathname.startsWith('/candidate/cv-builder');
  // Pages rebuilt from the 03/11 mockup bring their own frame and use its page width.
  const usesAccountFrame =
    ['/candidate/applications', '/candidate/cvs', '/candidate/profile', '/candidate/saved-jobs'].includes(location.pathname) ||
    /^\/candidate\/applications\/[^/]+(\/offers\/[^/]+)?$/.test(location.pathname);

  if (isCvBuilder) {
    return (
      <div className="candidate-console candidate-cv-builder-page flex h-screen min-h-0 flex-col overflow-hidden bg-[#f0f2f5] text-slate-900">
        <Navbar />
        <AdminTopProgress offsetLeft={0} />
        <div className="min-h-0 flex-1 flex flex-col h-full overflow-hidden">
          <Suspense fallback={<AdminPageSkeleton />}>
            <Outlet />
          </Suspense>
        </div>
      </div>
    );
  }

  return (
    <div className="candidate-console min-h-screen text-slate-900 bg-[#f8fafc]" style={usesAccountFrame ? { background: '#F7F8FA' } : undefined}>
      {/* Unified top Navbar matching Homepage & public portal */}
      <Navbar />
      <AdminTopProgress offsetLeft={0} />
      <main className={usesAccountFrame ? 'mx-auto w-full max-w-[1248px] px-4 pb-14 pt-6 sm:px-6' : 'candidate-main mx-auto w-full max-w-[1440px] px-4 py-6 pb-20 sm:px-6 lg:px-8 lg:py-8'}>
        <AdminPageEnter pathKey={location.pathname}>
          <Suspense fallback={<AdminPageSkeleton />}>
            <Outlet />
          </Suspense>
        </AdminPageEnter>
      </main>
    </div>
  );
};

export default CandidateShell;
