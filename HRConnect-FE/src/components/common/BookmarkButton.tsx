import React from 'react';
import { Tooltip } from 'antd';
import { HeartOutlined, HeartFilled } from '@ant-design/icons';
import { useSavedJobs } from '@/hooks/useSavedJobs';

export interface BookmarkButtonProps {
  jobId: string;
  jobTitle?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const BookmarkButton: React.FC<BookmarkButtonProps> = ({
  jobId,
  jobTitle,
  className = '',
  size = 'md',
}) => {
  const { isSaved: checkIsSaved, toggleSave } = useSavedJobs();
  const isSaved = checkIsSaved(jobId);

  const sizeClasses = {
    sm: 'w-7 h-7 text-xs',
    md: 'w-8 h-8 text-sm',
    lg: 'w-10 h-10 text-base',
  }[size];

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    toggleSave(jobId, jobTitle);
  };

  const label = isSaved ? 'Bỏ lưu việc làm' : 'Lưu việc làm';

  return (
    <Tooltip title={label} mouseEnterDelay={0.3}>
      <button
        type="button"
        onClick={handleClick}
        title={label}
        aria-label={label}
        className={`rounded-lg flex items-center justify-center transition-all duration-200 flex-shrink-0 border cursor-pointer active:scale-95 ${
          isSaved
            ? 'bg-rose-50 text-rose-500 border-rose-200 shadow-2xs hover:bg-rose-100 hover:border-rose-300'
            : 'bg-slate-50 text-slate-400 border-slate-200/70 hover:text-rose-500 hover:bg-rose-50 hover:border-rose-200'
        } ${sizeClasses} ${className}`}
      >
        {isSaved ? (
          <HeartFilled className="text-rose-500 fill-rose-500 transition-transform duration-200 hover:scale-110" style={{ color: '#f43f5e' }} />
        ) : (
          <HeartOutlined className="transition-transform duration-200 hover:scale-110" />
        )}
      </button>
    </Tooltip>
  );
};

export default BookmarkButton;
