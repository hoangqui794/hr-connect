/**
 * @file CandidateDialog.tsx
 * @description Dialog frame of the Candidate pages (mockup 03/11): title and close on top, content, buttons below.
 */
import React from 'react';
import { Modal } from 'antd';

export const DIALOG_FONT = "font-['Be_Vietnam_Pro',system-ui,sans-serif]";
export const DIALOG_CANCEL = `${DIALOG_FONT} h-11 cursor-pointer rounded-md border border-solid border-[#D1D5DB] bg-white px-[18px] text-[14px] font-medium text-[#1F2937] hover:bg-[#F9FAFB]`;
export const DIALOG_PRIMARY = `${DIALOG_FONT} h-11 cursor-pointer rounded-md border-0 bg-[#0C4A6E] px-[22px] text-[14px] font-semibold text-white hover:bg-[#075985] disabled:cursor-not-allowed disabled:bg-[#9CA3AF]`;
export const DIALOG_DANGER = `${DIALOG_FONT} h-11 cursor-pointer rounded-md border-0 bg-[#B91C1C] px-[22px] text-[14px] font-semibold text-white hover:bg-[#991B1B] disabled:cursor-not-allowed disabled:bg-[#9CA3AF]`;

/** The shared modal CSS adds a border, large corners and its own shadow, so the mockup's are forced here. */
export const DIALOG_ROOT = '[&_.ant-modal-content]:!rounded-[10px] [&_.ant-modal-content]:!border-0 [&_.ant-modal-content]:![box-shadow:0_20px_48px_rgba(15,23,42,.25)]';
export const DIALOG_STYLES = { content: { padding: 0 }, mask: { background: 'rgba(15,23,42,.55)' } };

export const CandidateDialog: React.FC<{
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: React.ReactNode;
  width?: number;
  footer?: React.ReactNode;
  children: React.ReactNode;
}> = ({ open, onClose, title, subtitle, width = 520, footer, children }) => (
  <Modal open={open} onCancel={onClose} footer={null} closable={false} centered width={width} destroyOnHidden title={null} aria-labelledby="candidate-dialog-title" rootClassName={DIALOG_ROOT} styles={DIALOG_STYLES}>
    <div className={`${DIALOG_FONT} flex max-h-[calc(100vh-40px)] flex-col text-[14px] text-[#1F2937] [line-height:normal]`}>
      <div className="flex items-start gap-3 border-0 border-b border-solid border-[#E5E7EB] px-[22px] py-[18px]">
        <div className="min-w-0 flex-1">
          <h2 id="candidate-dialog-title" className="m-0 text-[18px] font-bold text-[#1F2937]">{title}</h2>
          {subtitle && <div className="mt-0.5 text-[#4B5563]">{subtitle}</div>}
        </div>
        <button type="button" aria-label="Đóng" onClick={onClose} className={`${DIALOG_FONT} -mr-2 -mt-2 h-11 w-11 shrink-0 cursor-pointer border-0 bg-transparent text-[20px] text-[#4B5563]`}>×</button>
      </div>
      <div className="flex flex-col gap-[14px] overflow-auto px-[22px] py-[18px]">{children}</div>
      {footer && <div className="flex justify-end gap-2.5 border-0 border-t border-solid border-[#E5E7EB] px-[22px] py-[14px]">{footer}</div>}
    </div>
  </Modal>
);
