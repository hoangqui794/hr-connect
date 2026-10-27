import React from 'react';
import { Modal } from 'antd';
import { CheckCircleFilled, LayoutOutlined } from '@ant-design/icons';

export interface CvTemplateModalProps {
  open: boolean;
  onClose: () => void;
  selectedTemplateCode: 'STANDARD' | 'MODERN_TWO_COL';
  onSelectTemplate: (code: 'STANDARD' | 'MODERN_TWO_COL') => void;
}

export const CvTemplateModal: React.FC<CvTemplateModalProps> = ({
  open,
  onClose,
  selectedTemplateCode,
  onSelectTemplate,
}) => {
  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width={720}
      title={
        <div className="flex items-center gap-2 text-slate-800">
          <LayoutOutlined className="text-blue-600 text-lg" />
          <span className="font-bold text-base">Chọn Mẫu CV Chuẩn TopCV</span>
        </div>
      }
      className="cv-template-modal"
    >
      <div className="py-4 space-y-4">
        <p className="text-xs text-slate-500 m-0">
          Chọn cấu trúc trình bày phù hợp nhất với ngành nghề và kinh nghiệm của bạn. Tất cả dữ liệu của bạn sẽ được giữ nguyên khi đổi mẫu.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Template 1: Tiêu chuẩn (1 Cột) */}
          <div
            onClick={() => {
              onSelectTemplate('STANDARD');
              onClose();
            }}
            className={`rounded-2xl border-2 p-4 cursor-pointer transition-all flex flex-col justify-between relative overflow-hidden group hover:shadow-md ${
              selectedTemplateCode === 'STANDARD'
                ? 'border-blue-600 bg-blue-50/30'
                : 'border-slate-200 hover:border-blue-300 bg-white'
            }`}
          >
            {selectedTemplateCode === 'STANDARD' && (
              <div className="absolute top-3 right-3 text-blue-600">
                <CheckCircleFilled className="text-lg" />
              </div>
            )}

            {/* Wireframe thumbnail */}
            <div className="w-full h-44 rounded-xl bg-slate-50 border border-slate-200/80 p-3 flex flex-col gap-2 mb-3 shadow-2xs group-hover:bg-white transition-colors">
              <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                <div className="w-7 h-7 rounded-full bg-slate-300 shrink-0" />
                <div className="space-y-1 flex-1">
                  <div className="h-2.5 bg-blue-600 rounded w-1/2" />
                  <div className="h-1.5 bg-slate-300 rounded w-1/3" />
                </div>
              </div>
              <div className="h-3 bg-slate-200/90 rounded w-full flex items-center px-1">
                <span className="text-[7px] font-bold text-slate-600 uppercase">MỤC TIÊU NGHỀ NGHIỆP</span>
              </div>
              <div className="h-1.5 bg-slate-200 rounded w-4/5" />
              <div className="h-3 bg-slate-200/90 rounded w-full flex items-center px-1">
                <span className="text-[7px] font-bold text-slate-600 uppercase">KINH NGHIỆM LÀM VIỆC</span>
              </div>
              <div className="space-y-1">
                <div className="h-1.5 bg-slate-300 rounded w-3/4" />
                <div className="h-1.5 bg-slate-200 rounded w-full" />
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-bold text-sm text-slate-900 m-0">Mẫu 1: Tiêu Chuẩn</h4>
                <span className="bg-emerald-50 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-200">
                  Chuẩn ATS
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1 mb-0 leading-relaxed">
                Bố cục 1 cột dọc tuần tự, thanh lịch. Khuyên dùng cho sinh viên mới tốt nghiệp hoặc ứng viên ít kinh nghiệm.
              </p>
            </div>
          </div>

          {/* Template 2: Hai Cột Hiện Đại */}
          <div
            onClick={() => {
              onSelectTemplate('MODERN_TWO_COL');
              onClose();
            }}
            className={`rounded-2xl border-2 p-4 cursor-pointer transition-all flex flex-col justify-between relative overflow-hidden group hover:shadow-md ${
              selectedTemplateCode === 'MODERN_TWO_COL'
                ? 'border-blue-600 bg-blue-50/30'
                : 'border-slate-200 hover:border-blue-300 bg-white'
            }`}
          >
            {selectedTemplateCode === 'MODERN_TWO_COL' && (
              <div className="absolute top-3 right-3 text-blue-600">
                <CheckCircleFilled className="text-lg" />
              </div>
            )}

            {/* Wireframe thumbnail */}
            <div className="w-full h-44 rounded-xl bg-slate-50 border border-slate-200/80 p-3 flex flex-col gap-2 mb-3 shadow-2xs group-hover:bg-white transition-colors">
              <div className="flex items-center gap-2 border-b-2 border-blue-600 pb-1.5">
                <div className="w-7 h-7 rounded bg-slate-300 shrink-0" />
                <div className="space-y-1 flex-1">
                  <div className="h-2.5 bg-slate-900 rounded w-1/2" />
                  <div className="h-1.5 bg-blue-600 rounded w-1/3" />
                </div>
              </div>
              <div className="grid grid-cols-5 gap-2 flex-1">
                <div className="col-span-2 space-y-1.5 border-r border-slate-200 pr-1">
                  <div className="h-2 bg-slate-300 rounded w-3/4" />
                  <div className="h-1 bg-slate-200 rounded w-full" />
                  <div className="h-1 bg-slate-200 rounded w-5/6" />
                  <div className="h-2 bg-slate-300 rounded w-2/3 mt-2" />
                  <div className="h-1 bg-slate-200 rounded w-full" />
                </div>
                <div className="col-span-3 space-y-1.5 pl-1">
                  <div className="h-2 bg-blue-600 rounded w-2/3" />
                  <div className="h-1 bg-slate-200 rounded w-full" />
                  <div className="h-2 bg-blue-600 rounded w-3/4 mt-2" />
                  <div className="h-1 bg-slate-200 rounded w-full" />
                  <div className="h-1 bg-slate-200 rounded w-4/5" />
                </div>
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-bold text-sm text-slate-900 m-0">Mẫu 2: Hai Cột Hiện Đại</h4>
                <span className="bg-blue-50 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-blue-200">
                  Phổ biến nhất
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1 mb-0 leading-relaxed">
                Bố cục 2 cột thanh lịch: Thông tin liên hệ & Kỹ năng bên trái, Kinh nghiệm & Dự án timeline bên phải.
              </p>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default CvTemplateModal;
