import React from 'react';
import { Button, Drawer, Tag } from 'antd';
import { CheckCircleFilled, LayoutOutlined } from '@ant-design/icons';
import type { CvLayoutStyle, CvTemplateDto } from '@/types/api/cvBuilder';

export const templateLayoutFromCode = (template?: CvTemplateDto): CvLayoutStyle => {
  if (template?.templateConfig?.layout) return template.templateConfig.layout;
  const code = (template?.code || '').toUpperCase();
  if (code.includes('MODERN')) return 'modern';
  if (code.includes('COMPACT')) return 'compact';
  if (code.includes('EXECUTIVE')) return 'executive';
  if (code.includes('ELEGANT')) return 'elegant';
  if (code.includes('MINIMAL')) return 'minimal';
  return 'classic';
};

const templateUseCase = (layout: CvLayoutStyle): string => ({
  ats: 'Mọi ngành nghề', classic: 'Hành chính · Kinh doanh', modern: 'Công nghệ · Sản phẩm',
  compact: 'Nhiều kinh nghiệm', executive: 'Quản lý · Cấp cao', elegant: 'Dịch vụ · Sáng tạo',
  minimal: 'Tối giản · Quốc tế',
})[layout];

interface TemplateCardProps { template?: CvTemplateDto; selected: boolean; onSelect: () => void; }

const TemplateCard: React.FC<TemplateCardProps> = ({ template, selected, onSelect }) => {
  const layout = template ? templateLayoutFromCode(template) : 'ats';
  const accent = template?.templateConfig?.accentColor || '#2563eb';
  return (
    <button type="button" onClick={onSelect} aria-pressed={selected} className={`cv-template-gallery-card ${selected ? 'is-selected' : ''}`}>
      <div className={`cv-template-sheet cv-template-sheet--${layout}`} style={{ '--cv-template-accent': accent } as React.CSSProperties} aria-hidden="true">
        <div className="cv-template-sheet__header"><i /><b /><span /></div>
        <div className="cv-template-sheet__body"><aside><strong /><i /><i /><strong /><i /></aside><main><strong /><i /><i /><strong /><i /><i /></main></div>
      </div>
      <div className="cv-template-gallery-card__copy">
        <div className="flex items-center justify-between gap-2"><strong className="text-sm text-slate-900">{template?.name || 'Chuẩn ATS'}</strong>{selected && <CheckCircleFilled className="text-blue-600" />}</div>
        <Tag color={layout === 'ats' ? 'green' : 'blue'} className="!mx-0 !mt-2 !text-[10px]">{layout === 'ats' ? 'Dễ đọc ATS' : templateUseCase(layout)}</Tag>
        <p>{template?.description || 'Bố cục một cột rõ ràng, thân thiện với hệ thống lọc hồ sơ.'}</p>
      </div>
    </button>
  );
};

export interface CvTemplateModalProps {
  open: boolean; onClose: () => void; templates: CvTemplateDto[];
  selectedTemplateId: string | null; onSelectTemplate: (templateId: string | null) => void;
}

export const CvTemplateModal: React.FC<CvTemplateModalProps> = ({ open, onClose, templates, selectedTemplateId, onSelectTemplate }) => (
  <Drawer open={open} onClose={onClose} width={780} destroyOnHidden className="cv-template-drawer"
    title={<div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-blue-600"><LayoutOutlined /></span><div><h2 className="m-0 text-base font-bold text-slate-900">Chọn mẫu CV</h2><p className="m-0 mt-0.5 text-xs font-normal text-slate-500">Đổi bố cục mà không làm mất nội dung đã nhập.</p></div></div>}
    extra={<Button onClick={onClose}>Đóng</Button>}>
    <div className="mb-5 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-xs leading-5 text-blue-900">Mẫu ATS phù hợp khi nộp qua hệ thống tuyển dụng. Mẫu hai cột và mẫu nổi bật phù hợp khi gửi trực tiếp cho nhà tuyển dụng.</div>
    <div className="grid grid-cols-2 gap-4 xl:grid-cols-3">
      <TemplateCard selected={selectedTemplateId === null} onSelect={() => { onSelectTemplate(null); onClose(); }} />
      {templates.map((template) => <TemplateCard key={template.cvTemplateId} template={template} selected={selectedTemplateId === template.cvTemplateId} onSelect={() => { onSelectTemplate(template.cvTemplateId); onClose(); }} />)}
    </div>
  </Drawer>
);

export default CvTemplateModal;
