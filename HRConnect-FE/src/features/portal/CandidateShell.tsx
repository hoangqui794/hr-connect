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

  if (isCvBuilder) {
    return (
      <div className="candidate-console min-h-screen bg-[#f0f2f5] text-slate-900">
        <Suspense fallback={<AdminPageSkeleton />}>
          <Outlet />
        </Suspense>
      </div>
    );
  }

  return (
    <div className="candidate-console min-h-screen text-slate-900 bg-[#f8fafc]">
      {/* Unified top Navbar matching Homepage & public portal */}
      <Navbar />
      <AdminTopProgress offsetLeft={0} />
      <main className="candidate-main mx-auto w-full max-w-[1440px] px-4 py-6 pb-20 sm:px-6 lg:px-8 lg:py-8">
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
