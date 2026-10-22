/**
 * @file CandidateInterviewDetailPage.tsx
 * @description Dedicated full page for Candidate Interview Detail (/candidate/interviews/:interviewId).
 */

import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Breadcrumb, Button } from 'antd';
import { ArrowLeftOutlined, HomeOutlined, SolutionOutlined, CalendarOutlined } from '@ant-design/icons';
import { CandidateInterviewDetailView } from './CandidateInterviewDetailView';

export const CandidateInterviewDetailPage: React.FC = () => {
  const { interviewId, applicationId } = useParams<{ interviewId: string; applicationId?: string }>();
  const navigate = useNavigate();

  const handleBack = () => {
    if (applicationId) {
      navigate(`/candidate/applications/${applicationId}`);
    } else {
      navigate('/candidate/applications');
    }
  };

  return (
    <div className="candidate-page candidate-interview-detail-page space-y-5">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <Breadcrumb
          items={[
            {
              title: (
                <span
                  className="cursor-pointer flex items-center gap-1 text-slate-500 hover:text-blue-600"
                  onClick={() => navigate('/candidate/dashboard')}
                >
                  <HomeOutlined /> Trang chủ
                </span>
              ),
            },
            {
              title: (
                <span
                  className="cursor-pointer flex items-center gap-1 text-slate-500 hover:text-blue-600"
                  onClick={() => navigate('/candidate/applications')}
                >
                  <SolutionOutlined /> Đơn ứng tuyển
                </span>
              ),
            },
            ...(applicationId
              ? [
                  {
                    title: (
                      <span
                        className="cursor-pointer text-slate-500 hover:text-blue-600"
                        onClick={() => navigate(`/candidate/applications/${applicationId}`)}
                      >
                        Chi tiết đơn
                      </span>
                    ),
                  },
                ]
              : []),
            {
              title: (
                <span className="flex items-center gap-1 text-slate-800 font-semibold">
                  <CalendarOutlined className="text-blue-600" /> Chi tiết lịch phỏng vấn
                </span>
              ),
            },
          ]}
        />

        <Button icon={<ArrowLeftOutlined />} onClick={handleBack} className="text-slate-600">
          Quay lại đơn ứng tuyển
        </Button>
      </div>

      {/* Main View */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm">
        <CandidateInterviewDetailView
          interviewId={interviewId || ''}
          onBack={handleBack}
          showBackAction={true}
        />
      </div>
    </div>
  );
};

export default CandidateInterviewDetailPage;
