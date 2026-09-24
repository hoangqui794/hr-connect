/**
 * @file ReferralModal.tsx
 * @description Quick Referral Modal popup for Headhunter / Affiliate.
 * Can be opened directly from /affiliate/jobs or Job Details drawer.
 */
import React from 'react';
import { Modal } from 'antd';
import { ReferralForm } from './ReferralForm';

export interface ReferralModalProps {
  open: boolean;
  onClose: () => void;
  jobId?: string;
  jobTitle?: string;
}

export const ReferralModal: React.FC<ReferralModalProps> = ({
  open,
  onClose,
  jobId,
  jobTitle,
}) => {
  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width={900}
      destroyOnClose
      style={{ top: 30 }}
      title={
        <div style={{ paddingBottom: 8, borderBottom: '1px solid #f1f5f9' }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: '#0f172a' }}>
            Giới thiệu ứng viên {jobTitle ? `— ${jobTitle}` : ''}
          </div>
          <div style={{ fontSize: 12, color: '#64748b', fontWeight: 400 }}>
            Chọn ứng viên từ Kho hệ thống (Talent Pool) hoặc tải lên CV ứng viên bên ngoài.
          </div>
        </div>
      }
    >
      <div style={{ marginTop: 12 }}>
        <ReferralForm
          initialJobId={jobId}
          onSuccess={() => {
            // keep open brief moment for feedback or auto close
          }}
          isModal={true}
        />
      </div>
    </Modal>
  );
};
