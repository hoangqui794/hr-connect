/**
 * @file CandidateShell.tsx
 * @description Persistent Candidate workspace with unified Navbar navigation matching homepage
 * and mobile bottom navigation bar (mockup 03/11, Pages 35 & 38).
 */
import React, { Suspense } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { Navbar } from '@/features/landing/components/Navbar';
import { AdminPageEnter, AdminPageSkeleton, AdminTopProgress } from '@/features/admin-console/AdminRouteProgress';
import '@/features/admin-console/admin-console.css';
import './candidate/candidate.css';

const MobileBottomNav: React.FC<{ pathname: string }> = ({ pathname }) => {
  const navItems = [
    {
      to: '/',
      label: 'Trang chủ',
      active: pathname === '/',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
          <path d="M3 10.5L12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-9.5z" />
        </svg>
      ),
    },
    {
      to: '/jobs',
      label: 'Việc làm',
      active: pathname.startsWith('/jobs') || pathname.startsWith('/candidate/jobs'),
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-3.5-3.5" />
        </svg>
      ),
    },
    {
      to: '/candidate/applications',
      label: 'Đơn ứng tuyển',
      active: pathname.startsWith('/candidate/applications'),
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
          <rect x="5" y="3" width="14" height="18" rx="2" />
          <path d="M9 8h6M9 12h6M9 16h4" />
        </svg>
      ),
    },
    {
      to: '/candidate/profile',
      label: 'Tài khoản',
      active:
        pathname.startsWith('/candidate/profile') ||
        pathname.startsWith('/candidate/cvs') ||
        pathname.startsWith('/candidate/affiliate-cvs') ||
        pathname.startsWith('/candidate/saved-jobs') ||
        pathname.startsWith('/candidate/settings'),
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
          <circle cx="12" cy="8" r="4" />
          <path d="M4 20c1.8-3.6 5-5.5 8-5.5s6.2 1.9 8 5.5" />
        </svg>
      ),
    },
  ];

  return (
    <nav
      aria-label="Điều hướng dưới cùng"
      className="fixed inset-x-0 bottom-0 z-40 flex h-16 items-center justify-around border-0 border-t border-solid border-[#E5E7EB] bg-white font-['Be_Vietnam_Pro',system-ui,sans-serif] lg:hidden"
    >
      {navItems.map((item) => (
        <Link
          key={item.to}
          to={item.to}
          aria-current={item.active ? 'page' : undefined}
          className={`flex flex-1 flex-col items-center justify-center gap-1 py-1.5 text-[11px] no-underline transition-colors duration-200 ${
            item.active ? 'font-semibold text-[#0369A1]' : 'font-normal text-[#4B5563] hover:text-[#075985]'
          }`}
        >
          {item.icon}
          <span>{item.label}</span>
        </Link>
      ))}
    </nav>
  );
};

export const CandidateShell: React.FC = () => {
  const location = useLocation();

  const isCvBuilder = location.pathname.startsWith('/candidate/cv-builder');
  // Pages rebuilt from the 03/11 mockup bring their own frame and use its page width.
  const usesAccountFrame =
    ['/candidate/applications', '/candidate/cvs', '/candidate/affiliate-cvs', '/candidate/profile', '/candidate/saved-jobs', '/candidate/settings/email-identities', '/candidate/notifications'].includes(location.pathname) ||
    /^\/candidate\/applications\/[^/]+(\/offers\/[^/]+|\/interviews\/[^/]+)?$/.test(location.pathname) ||
    /^\/candidate\/interviews\/[^/]+$/.test(location.pathname) ||
    /^\/candidate\/submission-consents\/[^/]+$/.test(location.pathname) ||
    /^\/candidate\/affiliate-cvs\/[^/]+$/.test(location.pathname);

  if (isCvBuilder) {
    const searchParams = new URLSearchParams(location.search);
    const stepParam = searchParams.get('step');
    const isEditorRoute =
      stepParam === 'editor' ||
      /^\/candidate\/cv-builder\/[^/]+$/.test(location.pathname) ||
      Boolean(searchParams.get('template'));

    return (
      <div className="candidate-console flex min-h-screen flex-col bg-[#F7F8FA] text-slate-900">
        {!isEditorRoute && <Navbar />}
        <AdminTopProgress offsetLeft={0} />
        <div className="flex min-h-0 flex-1 flex-col">
          <Suspense fallback={<AdminPageSkeleton />}>
            <Outlet />
          </Suspense>
        </div>
        <MobileBottomNav pathname={location.pathname} />
      </div>
    );
  }

  return (
    <div className="candidate-console flex min-h-screen flex-col text-slate-900 bg-[#f8fafc]" style={usesAccountFrame ? { background: '#F7F8FA' } : undefined}>
      {/* Unified top Navbar matching Homepage & public portal */}
      <Navbar />
      <AdminTopProgress offsetLeft={0} />
      <main className={usesAccountFrame ? 'mx-auto w-full max-w-[1248px] flex-1 px-4 pb-24 pt-4 sm:px-6 lg:pb-14 lg:pt-6' : 'candidate-main mx-auto w-full max-w-[1440px] flex-1 px-4 py-6 pb-24 sm:px-6 lg:px-8 lg:py-8'}>
        {usesAccountFrame ? (
          <Suspense fallback={<AdminPageSkeleton />}>
            <Outlet />
          </Suspense>
        ) : (
          <AdminPageEnter pathKey={location.pathname}>
            <Suspense fallback={<AdminPageSkeleton />}>
              <Outlet />
            </Suspense>
          </AdminPageEnter>
        )}
      </main>
      <MobileBottomNav pathname={location.pathname} />
    </div>
  );
};

export default CandidateShell;
