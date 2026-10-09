/**
 * @file NotificationBell.tsx
 * @description Enterprise Notification Bell with Popover dropdown for HR Connect consoles.
 * Features: Unread badge, filter tabs (Tất cả / Chưa đọc), mark as read, dismiss, and action route navigation.
 */

import React, { useState } from 'react';
import { Badge, Button, Empty, Popover, Segmented, Tooltip } from 'antd';
import {
  BellOutlined,
  CheckCircleFilled,
  CheckOutlined,
  CloseCircleFilled,
  DeleteOutlined,
  ExclamationCircleFilled,
  InfoCircleFilled,
  RightOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAlertStore, type AlertType, type RealtimeAlert } from '@/stores/alertStore';

const formatTimeAgo = (isoString: string): string => {
  try {
    const diffMs = Date.now() - new Date(isoString).getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffSec < 60) return 'Vừa xong';
    if (diffMin < 60) return `${diffMin} phút trước`;
    if (diffHour < 24) return `${diffHour} giờ trước`;
    if (diffDay < 7) return `${diffDay} ngày trước`;
    return new Date(isoString).toLocaleDateString('vi-VN');
  } catch {
    return 'Gần đây';
  }
};

const renderAlertIcon = (type: AlertType) => {
  switch (type) {
    case 'success':
      return <CheckCircleFilled style={{ color: '#10b981', fontSize: 18 }} />;
    case 'warning':
      return <ExclamationCircleFilled style={{ color: '#f59e0b', fontSize: 18 }} />;
    case 'error':
      return <CloseCircleFilled style={{ color: '#ef4444', fontSize: 18 }} />;
    case 'info':
    default:
      return <InfoCircleFilled style={{ color: '#3b82f6', fontSize: 18 }} />;
  }
};

interface NotificationBellProps {
  className?: string;
  bellColor?: string;
}

export const NotificationBell: React.FC<NotificationBellProps> = ({ className, bellColor = '#475569' }) => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const { alerts, unreadCount, markRead, markAllRead, dismissAlert, clearAll } = useAlertStore();

  const filteredAlerts = filter === 'unread' ? alerts.filter((a) => !a.read) : alerts;

  const handleAlertClick = (alert: RealtimeAlert) => {
    if (!alert.read) {
      markRead(alert.id);
    }
    if (alert.actionRoute) {
      setOpen(false);
      let targetRoute = alert.actionRoute;

      // Nếu đường dẫn đến trang tin tuyển dụng và chưa có param highlight, tự động trích xuất tên bài trong ngoặc kép
      if (targetRoute.startsWith('/client/jobs') && !targetRoute.includes('highlight=')) {
        const titleMatch = alert.message.match(/"([^"]+)"/);
        const sep = targetRoute.includes('?') ? '&' : '?';
        if (alert.relatedEntityId) {
          targetRoute = `${targetRoute}${sep}highlight=${encodeURIComponent(alert.relatedEntityId)}&openDetail=true`;
        } else if (titleMatch) {
          targetRoute = `${targetRoute}${sep}highlight=${encodeURIComponent(titleMatch[1])}&openDetail=true`;
        }
      }

      navigate(targetRoute);
    }
  };

  const popoverContent = (
    <div style={{ width: 380, maxHeight: 520, display: 'flex', flexDirection: 'column' }} className="-m-3">
      {/* ── Header ── */}
      <div className="flex items-center justify-between border-0 border-b border-solid border-slate-100 px-4 py-3 bg-slate-50/70 rounded-t-lg">
        <div className="flex items-center gap-2">
          <span className="font-bold text-slate-800 text-[15px]">Thông báo</span>
          {unreadCount > 0 && (
            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
              {unreadCount} mới
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <Tooltip title="Đánh dấu tất cả đã đọc">
              <Button
                type="text"
                size="small"
                icon={<CheckOutlined />}
                onClick={() => markAllRead()}
                className="text-xs text-blue-600 hover:text-blue-700"
              >
                Đã đọc tất cả
              </Button>
            </Tooltip>
          )}
          {alerts.length > 0 && (
            <Tooltip title="Xóa tất cả thông báo">
              <Button
                type="text"
                size="small"
                icon={<DeleteOutlined />}
                onClick={() => clearAll()}
                className="text-xs text-slate-400 hover:text-red-500"
              />
            </Tooltip>
          )}
        </div>
      </div>

      {/* ── Filter ── */}
      <div className="px-4 py-2 border-0 border-b border-solid border-slate-100 bg-white">
        <Segmented
          block
          size="small"
          value={filter}
          onChange={(val) => setFilter(val as 'all' | 'unread')}
          options={[
            { label: `Tất cả (${alerts.length})`, value: 'all' },
            { label: `Chưa đọc (${unreadCount})`, value: 'unread' },
          ]}
        />
      </div>

      {/* ── List of Notifications ── */}
      <div className="overflow-y-auto px-2 py-2 flex-1 max-h-[340px]">
        {filteredAlerts.length === 0 ? (
          <div className="py-10 text-center">
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={
                <span className="text-xs text-slate-500">
                  {filter === 'unread' ? 'Không có thông báo chưa đọc nào' : 'Không có thông báo nào'}
                </span>
              }
            />
          </div>
        ) : (
          <div className="space-y-1.5">
            {filteredAlerts.map((item) => (
              <div
                key={item.id}
                onClick={() => handleAlertClick(item)}
                className={`group relative flex cursor-pointer items-start gap-3 rounded-xl p-3 transition-colors ${
                  item.read
                    ? 'bg-white hover:bg-slate-50 text-slate-600'
                    : 'bg-blue-50/60 hover:bg-blue-50 text-slate-900 border border-solid border-blue-100/80 shadow-xs'
                }`}
              >
                <div className="mt-0.5 shrink-0">{renderAlertIcon(item.type)}</div>
                <div className="flex-1 min-w-0 pr-4">
                  <div className="flex items-center gap-1.5">
                    <span className={`text-[13px] leading-snug line-clamp-1 ${item.read ? 'font-medium text-slate-800' : 'font-bold text-slate-900'}`}>
                      {item.title}
                    </span>
                    {!item.read && <span className="h-2 w-2 shrink-0 rounded-full bg-blue-500 inline-block" />}
                  </div>
                  <p className="mt-1 text-xs text-slate-600 leading-relaxed line-clamp-2 m-0">
                    {item.message}
                  </p>
                  <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-400">
                    <span>{formatTimeAgo(item.timestamp)}</span>
                    {item.actionLabel && (
                      <span className="font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-0.5">
                        {item.actionLabel} <RightOutlined style={{ fontSize: 9 }} />
                      </span>
                    )}
                  </div>
                </div>

                {/* Dismiss single button */}
                <button
                  type="button"
                  title="Xóa thông báo này"
                  onClick={(e) => {
                    e.stopPropagation();
                    dismissAlert(item.id);
                  }}
                  className="absolute top-2 right-2 hidden group-hover:flex h-6 w-6 items-center justify-center rounded-full border-0 bg-slate-200/60 text-slate-500 hover:bg-red-100 hover:text-red-600 cursor-pointer text-xs transition-colors"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <Popover
      content={popoverContent}
      trigger="click"
      open={open}
      onOpenChange={setOpen}
      placement="bottomRight"
      arrow={false}
      overlayClassName="hrconnect-notification-popover"
    >
      <Badge count={unreadCount} size="small" offset={[-2, 4]} overflowCount={99}>
        <button
          type="button"
          aria-label="Thông báo hệ thống"
          className={`flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-solid border-slate-200 bg-white text-slate-700 transition-all hover:border-slate-300 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 ${className || ''}`}
        >
          <BellOutlined style={{ fontSize: 17, color: bellColor }} />
        </button>
      </Badge>
    </Popover>
  );
};
