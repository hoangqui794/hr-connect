import React, { useState } from 'react';
import { Segmented } from 'antd';
import { SearchOutlined, TableOutlined } from '@ant-design/icons';
import { useAuthStore } from '@/stores/authStore';
import { UserRole } from '@/types/roles';
import { JobListTable } from './JobListTable';
import { JobSearchPortal } from './JobSearchPortal';

export { JobListTable, JobSearchPortal };

export const JobBoard: React.FC = () => {
  const { role } = useAuthStore();

  // Candidates, affiliates and public visitors want the TopCV Job Search Portal
  const isCandidateOrAffiliate =
    !role ||
    role === UserRole.CANDIDATE ||
    role === UserRole.AFFILIATE;

  // Recruiter / Enterprise / Admin roles can toggle between TopCV Portal view and B2B Management Table
  const [activeTab, setActiveTab] = useState<'portal' | 'table'>(
    isCandidateOrAffiliate ? 'portal' : 'table'
  );

  if (isCandidateOrAffiliate) {
    return (
      <div className="w-full">
        <JobSearchPortal />
      </div>
    );
  }

  return (
    <div className="w-full space-y-4">
      {/* Switcher Header for Enterprise & Internal HR */}
      <div className="flex items-center justify-between flex-wrap gap-3 bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-2xs">
        <div>
          <h2 className="text-sm font-bold text-slate-900 m-0">Quản Lý &amp; Khám Phá Tuyển Dụng</h2>
          <p className="text-xs text-slate-500 m-0">
            {activeTab === 'portal'
              ? 'Xem trải nghiệm Ứng viên & Headhunter tìm kiếm việc làm (TopCV Standard Layout)'
              : 'Bảng quản lý tuyển dụng doanh nghiệp, số lượng ứng viên và tác vụ nội bộ'}
          </p>
        </div>
        <Segmented
          value={activeTab}
          onChange={(val) => setActiveTab(val as 'portal' | 'table')}
          options={[
            {
              value: 'portal',
              icon: <SearchOutlined />,
              label: <span className="font-semibold text-xs">Sàn Tuyển Dụng TopCV</span>,
            },
            {
              value: 'table',
              icon: <TableOutlined />,
              label: <span className="font-semibold text-xs">Bảng Quản Lý B2B</span>,
            },
          ]}
          className="bg-slate-100 p-0.5 rounded-xl font-medium"
        />
      </div>

      {activeTab === 'portal' ? <JobSearchPortal /> : <JobListTable />}
    </div>
  );
};

export default JobBoard;
