import React from 'react';
import { Modal, Button } from 'antd';
import { PrinterOutlined, DownloadOutlined, CloseOutlined } from '@ant-design/icons';
import { CvCanvas } from './CvCanvas';
import type { StructuredCvContent } from '@/types/api/cvBuilder';
import type { SectionVisibility } from './CvSidebarTools';

export interface CvPreviewModalProps {
  open: boolean;
  onClose: () => void;
  content: StructuredCvContent;
  accentColor: string;
  fontFamily: string;
  density: 'compact' | 'normal' | 'spacious';
  sectionVisibility: SectionVisibility;
  pdfUrl?: string | null;
  title: string;
}

export const CvPreviewModal: React.FC<CvPreviewModalProps> = ({
  open,
  onClose,
  content,
  accentColor,
  fontFamily,
  density,
  sectionVisibility,
  pdfUrl,
  title,
}) => {
  const handlePrint = () => {
    window.print();
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      width={880}
      style={{ top: 20 }}
      footer={
        <div className="flex items-center justify-between px-2">
          <div className="text-xs text-slate-500">
            Xem trước bố cục in ấn khổ giấy A4 chuẩn
          </div>
          <div className="flex items-center gap-2">
            <Button icon={<PrinterOutlined />} onClick={handlePrint}>
              In / Xuất PDF
            </Button>
            {pdfUrl && (
              <Button
                type="primary"
                icon={<DownloadOutlined />}
                href={pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                Tải file PDF từ hệ thống
              </Button>
            )}
            <Button onClick={onClose}>Đóng</Button>
          </div>
        </div>
      }
      title={
        <div className="flex items-center justify-between pr-6">
          <span className="font-bold text-slate-900 text-base">Xem trước CV: {title}</span>
        </div>
      }
    >
      <div className="max-h-[75vh] overflow-y-auto py-4 bg-slate-100 flex justify-center rounded-lg">
        <CvCanvas
          content={content}
          onChangeContent={() => {}}
          accentColor={accentColor}
          fontFamily={fontFamily}
          density={density}
          sectionVisibility={sectionVisibility}
          readOnly={true}
        />
      </div>
    </Modal>
  );
};

export default CvPreviewModal;
