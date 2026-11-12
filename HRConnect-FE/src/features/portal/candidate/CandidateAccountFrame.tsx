/**
 * @file CandidateAccountFrame.tsx
 * @description Candidate account pages (mockup 03/11): account menu on the left on desktop,
 * compact horizontal account switcher on mobile.
 */
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useSavedJobs } from '@/hooks/useSavedJobs';
import { candidateApplicationsApi } from '@/services/api/mf02Api';

export const CandidateAccountFrame: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { pathname } = useLocation();
  const { savedJobsCount } = useSavedJobs();
  const applications = useQuery({
    queryKey: ['candidate-menu', 'applications-count'],
    queryFn: async () => (await candidateApplicationsApi.list({ page: 1, pageSize: 1 })).total,
  });

  const items: { to: string; label: string; count?: number }[] = [
    { to: '/candidate/profile', label: 'Hồ sơ của tôi' },
    { to: '/candidate/applications', label: 'Đơn ứng tuyển', count: applications.data },
    { to: '/candidate/saved-jobs', label: 'Việc đã lưu', count: savedJobsCount },
    { to: '/candidate/cvs', label: 'Kho CV' },
    { to: '/candidate/settings/email-identities', label: 'Cài đặt email đăng nhập' },
  ];

  const isCurrent = (to: string) =>
    pathname === to ||
    pathname.startsWith(`${to}/`) ||
    (to === '/candidate/cvs' && pathname.startsWith('/candidate/affiliate-cvs'));

  return (
    <div className="flex flex-col gap-4 font-['Be_Vietnam_Pro',system-ui,sans-serif] text-[14px] text-[#1F2937] [line-height:normal] lg:flex-row lg:items-start lg:gap-5">
      {/* Mobile horizontal account nav */}
      <nav
        aria-label="Tài khoản di động"
        className="-mx-4 flex gap-1.5 overflow-x-auto border-0 border-b border-solid border-[#E5E7EB] bg-white px-4 py-2.5 sm:-mx-6 sm:px-6 lg:hidden"
      >
        {items.map((item) => {
          const current = isCurrent(item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
              aria-current={current ? 'page' : undefined}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] no-underline transition-all duration-200 ${
                current
                  ? 'bg-sky-50 font-bold text-sky-700 border border-sky-200'
                  : 'bg-[#F3F4F6] text-[#374151] hover:bg-[#E5E7EB]'
              }`}
            >
              <span>{item.label}</span>
              {Boolean(item.count) && (
                <span className={`text-[12px] ${current ? 'text-sky-700 font-bold' : 'text-[#6B7280]'}`}>{item.count}</span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Desktop left sidebar */}
      <nav
        aria-label="Tài khoản"
        className="hidden w-[238.3px] shrink-0 rounded-lg border border-solid border-[#E5E7EB] bg-white p-2 shadow-[0_1px_2px_rgba(15,23,42,0.03)] lg:sticky lg:top-[84px] lg:block"
      >
        {items.map((item) => {
          const current = isCurrent(item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
              aria-current={current ? 'page' : undefined}
              className={`flex items-center justify-between rounded-md px-3 py-2.5 no-underline transition-all duration-200 ${
                current
                  ? 'bg-sky-50 font-bold text-sky-700 border-l-2 border-sky-600 pl-2.5 hover:text-sky-700'
                  : 'text-[#1F2937] hover:bg-slate-50 hover:text-sky-700'
              }`}
            >
              <span>{item.label}</span>
              {Boolean(item.count) && <span className={current ? 'font-bold text-sky-700' : 'text-[#6B7280]'}>{item.count}</span>}
            </Link>
          );
        })}
      </nav>
      <div className="min-w-0 w-full flex-1">
        {children}
      </div>
    </div>
  );
};
