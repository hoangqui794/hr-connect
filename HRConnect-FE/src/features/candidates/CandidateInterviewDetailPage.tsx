/**
 * @file CandidateInterviewDetailPage.tsx
 * @description Dedicated full page for Candidate Interview Detail (mockup 03/11, Page 11)
 * on /candidate/interviews/:interviewId and /candidate/applications/:applicationId/interviews/:interviewId.
 */

import React from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useCandidateInterviewDetail } from '@/hooks/useCandidateInterviewDetail';
import { CandidateInterviewDetailView } from './CandidateInterviewDetailView';

const FONT = "font-['Be_Vietnam_Pro',system-ui,sans-serif]";
const LINK = 'text-[#0369A1] no-underline transition-colors duration-200 hover:text-[#075985] hover:underline';

export const CandidateInterviewDetailPage: React.FC = () => {
  const { interviewId = '', applicationId } = useParams<{ interviewId: string; applicationId?: string }>();
  const navigate = useNavigate();
  const { interview } = useCandidateInterviewDetail(interviewId);

  const resolvedAppId = applicationId || interview?.applicationId;
  const backHref = resolvedAppId ? `/candidate/applications/${resolvedAppId}` : '/candidate/applications';
  const backLabel = interview?.jobTitle
    ? `‹ Quay lại đơn ứng tuyển ${[interview.jobTitle, interview.companyName].filter(Boolean).join(' – ')}`
    : '‹ Quay lại đơn ứng tuyển';

  const handleBack = () => {
    navigate(backHref);
  };

  return (
    <div className={`${FONT} mx-auto flex max-w-[780px] flex-col gap-3 text-[14px] text-[#1F2937] [line-height:normal] animate-[admin-page-in_220ms_cubic-bezier(0.2,0.8,0.2,1)_both]`}>
      <div>
        <Link to={backHref} className={`inline-flex items-center text-[13.5px] font-medium ${LINK}`}>
          {backLabel}
        </Link>
      </div>

      <CandidateInterviewDetailView
        interviewId={interviewId}
        initialData={interview}
        onBack={handleBack}
        showBackAction={false}
      />
    </div>
  );
};

export default CandidateInterviewDetailPage;
