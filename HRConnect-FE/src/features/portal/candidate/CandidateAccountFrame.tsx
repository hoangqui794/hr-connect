/**
 * @file CandidateAccountFrame.tsx
 * @description Candidate account pages (mockup 03/11): account menu on the left, the page on the right.
 * Below the lg breakpoint the menu is hidden; the same links stay in the header's account menu.
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
    { to: '/candidate/cv-builder', label: 'CV Builder' },
    { to: '/candidate/settings/email-identities', label: 'Cài đặt email đăng nhập' },
  ];

  return (
    <div className="flex items-start gap-5 font-['Be_Vietnam_Pro',system-ui,sans-serif] text-[14px] text-[#1F2937] [line-height:normal]">
      <nav aria-label="Tài khoản" className="hidden w-[238.3px] shrink-0 rounded-lg border border-solid border-[#E5E7EB] bg-white p-2 lg:block">
        {items.map((item) => {
          const current = pathname === item.to || pathname.startsWith(`${item.to}/`);
          return (
            <Link
              key={item.to}
              to={item.to}
              aria-current={current ? 'page' : undefined}
              className={`flex justify-between rounded-md px-3 py-2.5 no-underline ${current ? 'bg-[#E0F2FE] font-semibold text-[#075985] hover:text-[#075985]' : 'text-[#1F2937] hover:bg-[#F3F4F6] hover:text-[#1F2937]'}`}
            >
              {item.label}
              {Boolean(item.count) && <span className={current ? undefined : 'text-[#6B7280]'}>{item.count}</span>}
            </Link>
          );
        })}
      </nav>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
};
