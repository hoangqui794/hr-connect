/**
 * @file CandidateInterviewDetailModal.tsx
 * @description Dialog showing one interview from the application page (mockup 03/11).
 */

import React from 'react';
import { Modal } from 'antd';
import { DIALOG_ROOT, DIALOG_STYLES } from '@/features/portal/candidate/CandidateDialog';
import { CandidateInterviewDetailView } from './CandidateInterviewDetailView';
import type { CandidateInterviewDetailDto } from '@/types/api/candidateInterview';

export interface CandidateInterviewDetailModalProps {
  open: boolean;
  interviewId?: string;
  initialData?: CandidateInterviewDetailDto;
  onClose: () => void;
}

export const CandidateInterviewDetailModal: React.FC<CandidateInterviewDetailModalProps> = ({
  open,
  interviewId,
  initialData,
  onClose,
}) => {
  if (!interviewId && !initialData) return null;

  return (
    <Modal open={open} onCancel={onClose} footer={null} closable={false} width={700} destroyOnHidden centered title={null} aria-labelledby="interview-title" rootClassName={DIALOG_ROOT} styles={DIALOG_STYLES}>
      <CandidateInterviewDetailView
        interviewId={interviewId || initialData?.interviewId || ''}
        initialData={initialData}
        onBack={onClose}
        onClose={onClose}
      />
    </Modal>
  );
};

export default CandidateInterviewDetailModal;
