import React from 'react';
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

  return (
    <button
      type="button"
      onClick={handleClick}
      title={isSaved ? 'Bỏ lưu việc làm' : 'Lưu việc làm'}
      aria-label={isSaved ? 'Bỏ lưu việc làm' : 'Lưu việc làm'}
      className={`rounded-lg flex items-center justify-center transition-all flex-shrink-0 border cursor-pointer ${
        isSaved
          ? 'bg-rose-50 text-rose-500 border-rose-200 shadow-2xs'
          : 'bg-slate-50 text-slate-400 border-slate-200/70 hover:text-rose-500 hover:bg-rose-50 hover:border-rose-200'
      } ${sizeClasses} ${className}`}
    >
      {isSaved ? (
        <HeartFilled className="text-rose-500 fill-rose-500" style={{ color: '#f43f5e' }} />
      ) : (
        <HeartOutlined />
      )}
    </button>
  );
};

export default BookmarkButton;
