/**
 * @file NotificationBell.tsx
 * @description Enterprise Notification Bell with Popover dropdown for HR Connect consoles.
 * Features: Real backend API data source, unread badge, filter tabs (Tất cả / Chưa đọc),
 * mark single notification as read, mark all as read, and route navigation.
 */

import React, { useState } from 'react';
import { Alert, Badge, Button, Empty, Popover, Segmented, Spin, Tooltip } from 'antd';
import {
  BellOutlined,
  CalendarOutlined,
  CheckCircleFilled,
  CheckOutlined,
  CloseCircleFilled,
  DollarCircleOutlined,
  ExclamationCircleFilled,
  FileTextOutlined,
  InfoCircleFilled,
  ReloadOutlined,
  RightOutlined,
  SolutionOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notificationApi } from '@/services/api/notificationApi';
import type { NotificationDto } from '@/types/api/notification';
import { useAuthStore } from '@/stores/authStore';
import { useNotificationSignalR } from '@/hooks/useNotificationSignalR';
import { getNotificationRoute, portalRoute } from './notificationRoutes';

const formatTimeAgo = (isoString?: string | null): string => {
  if (!isoString) return '';
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

const renderNotificationIcon = (type?: string, entityType?: string | null) => {
  const normType = (type || '').trim().toUpperCase();
  const normEntity = (entityType || '').trim().toUpperCase();

  if (normEntity === 'JOB_FIT' || normType === 'JOB_FIT') {
    return <ThunderboltOutlined style={{ color: '#d97706', fontSize: 18 }} />;
  }
  if (normEntity === 'JOB' || normType === 'JOB') {
    return <FileTextOutlined style={{ color: '#2563eb', fontSize: 18 }} />;
  }
  if (
    normEntity === 'APPLICATION' ||
    normEntity === 'APPLICATION_STATUS' ||
    normEntity === 'CANDIDATE_APPLICATION' ||
    normType === 'APPLICATION'
  ) {
    return <SolutionOutlined style={{ color: '#059669', fontSize: 18 }} />;
  }
  if (normEntity === 'SUBMISSION' || normEntity === 'SUBMISSION_CONSENT_RESULT' || normType === 'SUBMISSION') {
    return <SolutionOutlined style={{ color: '#0284c7', fontSize: 18 }} />;
  }
  if (normEntity === 'INTERVIEW' || normType === 'INTERVIEW') {
    return <CalendarOutlined style={{ color: '#7c3aed', fontSize: 18 }} />;
  }
  if (normEntity === 'OFFER' || normType === 'OFFER') {
    return <CheckCircleFilled style={{ color: '#16a34a', fontSize: 18 }} />;
  }
  if (
    normEntity === 'COMMISSION' ||
    normEntity === 'PAYOUT' ||
    normType === 'COMMISSION' ||
    normType === 'PAYOUT'
  ) {
    return <DollarCircleOutlined style={{ color: '#ea580c', fontSize: 18 }} />;
  }
  if (normType === 'ERROR') {
    return <CloseCircleFilled style={{ color: '#ef4444', fontSize: 18 }} />;
  }
  if (normType === 'WARNING') {
    return <ExclamationCircleFilled style={{ color: '#f59e0b', fontSize: 18 }} />;
  }
  return <InfoCircleFilled style={{ color: '#3b82f6', fontSize: 18 }} />;
};

export interface NotificationBellProps {
  className?: string;
  bellColor?: string;
}

export const NotificationBell: React.FC<NotificationBellProps> = ({ className, bellColor = '#475569' }) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const role = useAuthStore((s) => s.role);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated) || !!user;

  // Realtime SignalR connection
  const { isConnected } = useNotificationSignalR();

  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  // 1. Query: Số lượng thông báo chưa đọc
  // Fallback: Khi SignalR kết nối thành công (State === Connected): tạm dừng polling định kỳ.
  // Khi mất kết nối hoặc reconnecting: tự động kích hoạt polling định kỳ 60s làm dự phòng.
  const { data: unreadData, refetch: refetchUnreadCount } = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: () => notificationApi.getUnreadCount(),
    enabled: isAuthenticated,
    refetchInterval: isConnected ? false : 60000,
    staleTime: isConnected ? Infinity : 30000,
  });

  const unreadCount = unreadData?.unreadCount ?? 0;

  // 2. Query: Danh sách thông báo theo filter (Tất cả / Chưa đọc)
  const {
    data: pageData,
    isLoading,
    isError,
    error,
    refetch: refetchList,
  } = useQuery({
    queryKey: ['notifications', 'list', filter],
    queryFn: () =>
      notificationApi.getNotifications({
        page: 1,
        pageSize: 20,
        isRead: filter === 'unread' ? false : undefined,
      }),
    enabled: isAuthenticated && open,
    staleTime: 10000,
  });

  const items = pageData?.items ?? [];
  const totalCount = pageData?.totalCount ?? items.length;

  // 3. Mutation: Đánh dấu 1 thông báo là đã đọc
  const markAsReadMutation = useMutation({
    mutationFn: (notificationId: string) => notificationApi.markAsRead(notificationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  // 4. Mutation: Đánh dấu tất cả thông báo là đã đọc
  const markAllReadMutation = useMutation({
    mutationFn: () => notificationApi.markAllAsRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (nextOpen && isAuthenticated) {
      refetchUnreadCount();
      refetchList();
    }
  };

  const handleNotificationClick = (item: NotificationDto) => {
    if (!item.isRead) {
      markAsReadMutation.mutate(item.notificationId);
    }
    setOpen(false);

    const targetRoute = getNotificationRoute(item, role);
    if (targetRoute) {
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
          <Tooltip title={isConnected ? 'Realtime SignalR: Đang kết nối' : 'Dự phòng: Polling định kỳ'}>
            <span
              className={`inline-block h-2 w-2 rounded-full transition-colors ${
                isConnected ? 'bg-emerald-500 shadow-xs' : 'bg-slate-300'
              }`}
              aria-label={isConnected ? 'SignalR realtime active' : 'Polling fallback active'}
            />
          </Tooltip>
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <Tooltip title="Đánh dấu tất cả đã đọc">
              <Button
                type="text"
                size="small"
                icon={<CheckOutlined />}
                loading={markAllReadMutation.isPending}
                onClick={() => markAllReadMutation.mutate()}
                className="text-xs text-blue-600 hover:text-blue-700"
              >
                Đã đọc tất cả
              </Button>
            </Tooltip>
          )}
        </div>
      </div>

      {/* ── Filter Tabs ── */}
      <div className="px-4 py-2 border-0 border-b border-solid border-slate-100 bg-white">
        <Segmented
          block
          size="small"
          value={filter}
          onChange={(val) => setFilter(val as 'all' | 'unread')}
          options={[
            { label: `Tất cả (${filter === 'all' ? totalCount : totalCount})`, value: 'all' },
            { label: `Chưa đọc (${unreadCount})`, value: 'unread' },
          ]}
        />
      </div>

      {/* ── Notification Content (Loading / Error / Empty / List) ── */}
      <div className="overflow-y-auto px-2 py-2 flex-1 max-h-[340px]" tabIndex={0} role="region" aria-label="Danh sách thông báo">
        {isLoading ? (
          <div className="py-12 text-center flex flex-col items-center justify-center gap-3">
            <Spin size="default" />
            <span className="text-xs text-slate-500">Đang tải thông báo...</span>
          </div>
        ) : isError ? (
          <div className="p-4 text-center">
            <Alert
              type="error"
              showIcon
              message="Không thể tải thông báo"
              description={error instanceof Error ? error.message : 'Đã có lỗi xảy ra khi kết nối máy chủ.'}
              action={
                <Button size="small" icon={<ReloadOutlined />} onClick={() => refetchList()} className="mt-2">
                  Tải lại
                </Button>
              }
            />
          </div>
        ) : items.length === 0 ? (
          <div className="py-10 text-center">
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={
                <span className="text-xs text-slate-500">
                  {filter === 'unread' ? 'Không có thông báo chưa đọc nào' : 'Chưa có thông báo nào'}
                </span>
              }
            />
          </div>
        ) : (
          <div className="space-y-1.5">
            {items.map((item) => {
              const read = item.isRead;
              return (
                <div
                  key={item.notificationId}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleNotificationClick(item)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleNotificationClick(item);
                    }
                  }}
                  className={`group relative flex cursor-pointer items-start gap-3 rounded-xl p-3 transition-colors ${
                    read
                      ? 'bg-white hover:bg-slate-50 text-slate-600'
                      : 'bg-blue-50/60 hover:bg-blue-50 text-slate-900 border border-solid border-blue-100/80 shadow-xs'
                  }`}
                >
                  <div className="mt-0.5 shrink-0">
                    {renderNotificationIcon(item.notificationType, item.relatedEntityType)}
                  </div>
                  <div className="flex-1 min-w-0 pr-2">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`text-[13px] leading-snug line-clamp-1 ${
                          read ? 'font-medium text-slate-800' : 'font-bold text-slate-900'
                        }`}
                      >
                        {item.title}
                      </span>
                      {!read && <span className="h-2 w-2 shrink-0 rounded-full bg-blue-500 inline-block" />}
                    </div>
                    <p className="mt-1 text-xs text-slate-600 leading-relaxed line-clamp-2 m-0">
                      {item.message}
                    </p>
                    <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-400">
                      <span>{formatTimeAgo(item.createdAt)}</span>
                      {Boolean(getNotificationRoute(item, role)) && (
                        <span className="font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-0.5">
                          Xem chi tiết <RightOutlined style={{ fontSize: 9 }} />
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
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
      onOpenChange={handleOpenChange}
      placement="bottomRight"
      arrow={false}
      overlayClassName="hrconnect-notification-popover"
    >
      <Badge count={unreadCount} size="small" offset={[-2, 4]} overflowCount={99}>
        <button
          type="button"
          aria-label="Thông báo hệ thống"
          className={`flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-solid border-slate-200 bg-white text-slate-700 transition-all hover:border-slate-300 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 ${
            className || ''
          }`}
        >
          <BellOutlined style={{ fontSize: 17, color: bellColor }} />
        </button>
      </Badge>
    </Popover>
  );
};
