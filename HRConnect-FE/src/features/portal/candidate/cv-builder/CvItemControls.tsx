import React from 'react';
import { Tooltip } from 'antd';
import {
  ArrowUpOutlined,
  ArrowDownOutlined,
  DeleteOutlined,
} from '@ant-design/icons';

export interface CvItemControlsProps {
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onDelete: () => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  className?: string;
}

export const CvItemControls: React.FC<CvItemControlsProps> = ({
  onMoveUp,
  onMoveDown,
  onDelete,
  canMoveUp = true,
  canMoveDown = true,
  className = '',
}) => {
  return (
    <div
      className={`floating-item-controls opacity-0 group-hover:opacity-100 transition-opacity duration-150 absolute top-1 right-1 z-10 flex items-center gap-1 bg-white/95 backdrop-blur-xs border border-slate-200/90 shadow-sm rounded-md px-1.5 py-0.5 no-print select-none ${className}`}
    >
      {onMoveUp && (
        <Tooltip title="Di chuyển lên">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onMoveUp();
            }}
            disabled={!canMoveUp}
            className={`w-6 h-6 rounded flex items-center justify-center border-0 bg-transparent transition-colors cursor-pointer ${
              canMoveUp
                ? 'text-slate-600 hover:text-blue-600 hover:bg-slate-100'
                : 'text-slate-300 cursor-not-allowed'
            }`}
          >
            <ArrowUpOutlined className="text-[11px]" />
          </button>
        </Tooltip>
      )}

      {onMoveDown && (
        <Tooltip title="Di chuyển xuống">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onMoveDown();
            }}
            disabled={!canMoveDown}
            className={`w-6 h-6 rounded flex items-center justify-center border-0 bg-transparent transition-colors cursor-pointer ${
              canMoveDown
                ? 'text-slate-600 hover:text-blue-600 hover:bg-slate-100'
                : 'text-slate-300 cursor-not-allowed'
            }`}
          >
            <ArrowDownOutlined className="text-[11px]" />
          </button>
        </Tooltip>
      )}

      <Tooltip title="Xóa mục này">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="w-6 h-6 rounded flex items-center justify-center border-0 bg-transparent text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
        >
          <DeleteOutlined className="text-[11px]" />
        </button>
      </Tooltip>
    </div>
  );
};

export default CvItemControls;
