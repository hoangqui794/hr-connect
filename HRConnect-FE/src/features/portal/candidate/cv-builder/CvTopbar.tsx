import React, { useState, useRef, useEffect } from 'react';
import { Button, Tooltip, Checkbox } from 'antd';
import {
  ArrowLeftOutlined,
  EditOutlined,
  EyeOutlined,
  SaveOutlined,
  CheckOutlined,
  FilePdfOutlined,
} from '@ant-design/icons';

export interface CvTopbarProps {
  title: string;
  onTitleChange: (newTitle: string) => void;
  isPrimary: boolean;
  onPrimaryChange: (isPrimary: boolean) => void;
  onPreview: () => void;
  onSave: () => void;
  onSaveDraft: () => void;
  isSaving: boolean;
  draftStatus: 'idle' | 'saving' | 'saved' | 'error';
  onBack: () => void;
  completeness: number;
  mode: 'create' | 'edit';
}

export const CvTopbar: React.FC<CvTopbarProps> = ({
  title,
  onTitleChange,
  isPrimary,
  onPrimaryChange,
  onPreview,
  onSave,
  onSaveDraft,
  isSaving,
  draftStatus,
  onBack,
  completeness,
  mode,
}) => {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [tempTitle, setTempTitle] = useState(title);
  const titleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTempTitle(title);
  }, [title]);

  useEffect(() => {
    if (isEditingTitle) {
      titleInputRef.current?.focus();
      titleInputRef.current?.select();
    }
  }, [isEditingTitle]);

  const handleSaveTitle = () => {
    setIsEditingTitle(false);
    const trimmed = tempTitle.trim();
    if (trimmed) {
      onTitleChange(trimmed);
    } else {
      setTempTitle(title);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSaveTitle();
    } else if (e.key === 'Escape') {
      setTempTitle(title);
      setIsEditingTitle(false);
    }
  };

  return (
    <header className="h-16 w-full shrink-0 border-0 border-b border-solid border-slate-200 bg-white shadow-xs select-none z-30">
      <div className="mx-auto flex h-full w-full max-w-[1520px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        {/* Left: Back button & Title editor */}
        <div className="flex min-w-0 items-center gap-2.5">
        <Tooltip title="Quay lại Kho CV">
          <Button
            type="text"
            shape="circle"
            icon={<ArrowLeftOutlined className="text-slate-600 text-base" />}
            onClick={onBack}
            className="hover:bg-slate-100"
            aria-label="Quay lại danh sách CV"
          />
        </Tooltip>

        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <FilePdfOutlined className="text-base" />
          </div>

          {isEditingTitle ? (
            <div className="flex items-center gap-1.5">
              <input
                ref={titleInputRef}
                type="text"
                value={tempTitle}
                onChange={(e) => setTempTitle(e.target.value)}
                onBlur={handleSaveTitle}
                onKeyDown={handleKeyDown}
                maxLength={180}
                aria-label="Nhập tiêu đề CV"
                className="text-base font-bold text-slate-800 bg-white border border-blue-400 rounded-md px-2.5 py-1 focus:outline-none focus:ring-2 focus:ring-blue-100 min-w-[200px] sm:min-w-[320px]"
              />
              <Button
                type="primary"
                size="small"
                icon={<CheckOutlined />}
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleSaveTitle();
                }}
              />
            </div>
          ) : (
            <div
              className="flex items-center gap-2 cursor-pointer group py-1 px-2 rounded-lg hover:bg-slate-100 transition-colors min-w-0"
              onClick={() => setIsEditingTitle(true)}
              title="Nhấp để đổi tên CV"
            >
              <h1 className="text-base font-bold text-slate-900 truncate max-w-[240px] sm:max-w-[380px] m-0">
                {title || 'CV chưa đặt tên'}
              </h1>
              <EditOutlined className="text-slate-400 group-hover:text-blue-600 text-xs transition-colors shrink-0" />
            </div>
          )}

          <span className="hidden lg:inline-block text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 ml-1">
            {mode === 'edit' ? 'Chế độ sửa' : 'Tạo mới'}
          </span>
        </div>
        </div>

        {/* Right: Actions */}
        <div className="flex shrink-0 items-center gap-2">
        {/* Primary CV Checkbox */}
        <div className="hidden items-center xl:flex">
          <Checkbox
            checked={isPrimary}
            disabled={mode === 'edit' && isPrimary}
            onChange={(e) => onPrimaryChange(e.target.checked)}
            className="text-xs font-medium text-slate-600 select-none"
          >
            {mode === 'edit' && isPrimary ? 'Đang là CV chính' : 'Đặt làm CV chính'}
          </Checkbox>
        </div>

        {/* Completeness Badge */}
        <div className="hidden items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 lg:flex">
          <span className="text-[11px] text-slate-500 font-medium">Hoàn thiện:</span>
          <span className="text-xs font-bold text-blue-600">{completeness}%</span>
        </div>

        <div className="hidden min-w-[110px] items-center justify-end text-[11px] font-medium text-slate-500 2xl:flex" aria-live="polite">
          {draftStatus === 'saving' && 'Đang lưu nháp…'}
          {draftStatus === 'saved' && 'Đã tự lưu nháp'}
          {draftStatus === 'error' && <span className="text-red-600">Lưu nháp thất bại</span>}
        </div>

        <Button type="text" onClick={onSaveDraft} className="!rounded-lg !px-3 font-semibold text-slate-600 hover:!bg-slate-100">
          <span className="hidden xl:inline">Lưu nháp</span>
          <span className="xl:hidden">Nháp</span>
        </Button>

        {/* Preview Button */}
        <Button
          icon={<EyeOutlined />}
          onClick={onPreview}
          className="!rounded-lg font-medium text-slate-700 hover:text-blue-600 hover:border-blue-400 flex items-center gap-1.5"
        >
          <span className="hidden sm:inline">Xem trước</span>
        </Button>

        {/* Prominent Save Button */}
        <Button
          type="primary"
          icon={<SaveOutlined />}
          loading={isSaving}
          onClick={onSave}
          className="!rounded-lg !bg-blue-600 hover:!bg-blue-700 !font-bold !px-4 xl:!px-5 shadow-sm flex items-center gap-1.5"
        >
          <span className="hidden lg:inline">Xuất &amp; lưu CV</span>
          <span className="lg:hidden">Lưu CV</span>
        </Button>
        </div>
      </div>
    </header>
  );
};

export default CvTopbar;
