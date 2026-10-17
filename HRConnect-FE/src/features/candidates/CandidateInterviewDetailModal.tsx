/**
 * @file CandidateInterviewDetailModal.tsx
 * @description Modal dialog wrapper for CandidateInterviewDetailView.
 */

import React from 'react';
import { Modal } from 'antd';
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
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width={760}
      destroyOnClose
      centered
      className="candidate-interview-detail-modal"
      title="Chi tiết buổi phỏng vấn"
    >
      <div className="py-2">
        <CandidateInterviewDetailView
          interviewId={interviewId || initialData?.interviewId || ''}
          initialData={initialData}
          onBack={onClose}
          showBackAction={false}
        />
      </div>
    </Modal>
  );
};

export default CandidateInterviewDetailModal;
