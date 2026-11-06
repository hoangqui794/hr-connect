/**
 * @file NotificationBell.tsx
 * @description Enterprise Notification Bell with Popover dropdown for HR Connect consoles.
 * Features: Real backend API data source, unread badge, filter tabs (Tất cả / Chưa đọc),
 * mark single notification as read, mark all as read, and route navigation.
 * Also supports variant="candidate" matching 100% Figma Page 23 & Page 34.
 */

import React, { useMemo, useState } from 'react';
import { Alert, Badge, Button, Empty, Popover, Segmented, Spin, Tooltip } from 'antd';
import {
  BellOutlined,
  CalendarOutlined,
  CheckCircleFilled,
  CheckOutlined,
  CloseCircleFilled,
  CustomerServiceOutlined,
  DollarCircleOutlined,
  ExclamationCircleFilled,
  FileTextOutlined,
  InfoCircleFilled,
  ReloadOutlined,
  RightOutlined,
  SafetyCertificateOutlined,
  SolutionOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notificationApi } from '@/services/api/notificationApi';
import type { NotificationDto } from '@/types/api/notification';
import { useAuthStore } from '@/stores/authStore';
import { UserRole } from '@/types/roles';
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
    if (diffDay === 1) return 'Hôm qua';
    if (diffDay < 7) return `${diffDay} ngày trước`;
    return new Date(isoString).toLocaleDateString('vi-VN');
  } catch {
    return 'Gần đây';
  }
};

export const getNotificationCategory = (item: NotificationDto): string => {
  const normType = (item.notificationType || '').trim().toUpperCase();
  const normEntity = (item.relatedEntityType || '').trim().toUpperCase();
  const title = (item.title || '').toLowerCase();
  const msg = (item.message || '').toLowerCase();

  if (normEntity === 'INTERVIEW' || normType === 'INTERVIEW' || title.includes('phỏng vấn') || msg.includes('phỏng vấn')) {
    return 'Phỏng vấn';
  }
  if (normEntity === 'OFFER' || normType === 'OFFER' || title.includes('offer') || title.includes('thư mời') || msg.includes('lời mời')) {
    return 'Offer';
  }
  if (
    normEntity === 'SUBMISSION' ||
    normEntity === 'SUBMISSION_CONSENT' ||
    normEntity === 'SUBMISSION_CONSENT_RESULT' ||
    title.includes('giới thiệu') ||
    msg.includes('giới thiệu')
  ) {
    return 'Giới thiệu';
  }
  if (normEntity === 'JOB_FIT' || normType === 'JOB_FIT' || title.includes('phù hợp') || title.includes('gợi ý') || msg.includes('việc làm phù hợp')) {
    return 'Việc làm gợi ý';
  }
  if (normEntity === 'CV' || normEntity === 'AFFILIATE_CV' || title.includes('cv') || msg.includes('kho cv') || msg.includes('.pdf')) {
    return 'CV';
  }
  if (
    normEntity === 'APPLICATION' ||
    normEntity === 'APPLICATION_STATUS' ||
    normEntity === 'CANDIDATE_APPLICATION' ||
    title.includes('ứng tuyển') ||
    title.includes('hồ sơ') ||
    msg.includes('ứng tuyển')
  ) {
    return 'Đơn ứng tuyển';
  }
  return 'Thông báo';
};

const renderNotificationIcon = (type?: string, entityType?: string | null) => {
  const normType = (type || '').trim().toUpperCase();
  const normEntity = (entityType || '').trim().toUpperCase();

  if (normEntity === 'JOB_FIT' || normType === 'JOB_FIT') {
    return <ThunderboltOutlined style={{ color: '#d97706', fontSize: 18 }} />;
  }
  if (normEntity === 'JOB' || normType === 'JOB' || normEntity === 'SERVICE_AGREEMENT') {
    return <FileTextOutlined style={{ color: '#2563eb', fontSize: 18 }} />;
  }
  if (
    normEntity === 'APPLICATION' ||
    normEntity === 'APPLICATION_STATUS' ||
    normEntity === 'CANDIDATE_APPLICATION' ||
    normEntity === 'SOURCING' ||
    normEntity === 'SOURCING_DELIVERY' ||
    normType === 'APPLICATION' ||
    normType === 'SOURCING'
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
    normEntity === 'WARRANTY' ||
    normType === 'WARRANTY' ||
    normEntity === 'PLACEMENT' ||
    normEntity === 'PLACEMENT_RECONCILIATION'
  ) {
    return <SafetyCertificateOutlined style={{ color: '#0d9488', fontSize: 18 }} />;
  }
  if (normEntity === 'CONTACT_REQUEST') {
    return <CustomerServiceOutlined style={{ color: '#6366f1', fontSize: 18 }} />;
  }
  if (
    normEntity === 'COMMISSION' ||
    normEntity === 'PAYOUT' ||
    normEntity === 'SERVICE_FEE' ||
    normType === 'COMMISSION' ||
    normType === 'PAYOUT' ||
    normType === 'SERVICE_FEE'
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
  variant?: 'default' | 'candidate';
}

type CandidateTab = 'all' | 'unread' | 'applications' | 'matches';

export const NotificationBell: React.FC<NotificationBellProps> = ({ className, bellColor = '#475569', variant }) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const role = useAuthStore((s) => s.role);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated) || !!user;

  const isCandidate = variant === 'candidate' || role === UserRole.CANDIDATE;

  // Realtime SignalR connection
  const { isConnected } = useNotificationSignalR();

  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [candidateTab, setCandidateTab] = useState<CandidateTab>('all');

  // 1. Query: Số lượng thông báo chưa đọc
  const { data: unreadData, refetch: refetchUnreadCount } = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: () => notificationApi.getUnreadCount(),
    enabled: isAuthenticated,
    refetchInterval: isConnected ? false : 60000,
    staleTime: isConnected ? Infinity : 30000,
  });

  const unreadCount = unreadData?.unreadCount ?? 0;

  // 2. Query: Danh sách thông báo theo filter
  const {
    data: pageData,
    isLoading,
    isError,
    error,
    refetch: refetchList,
  } = useQuery({
    queryKey: ['notifications', 'list', isCandidate ? 'candidate-popover' : filter],
    queryFn: () =>
      notificationApi.getNotifications({
        page: 1,
        pageSize: isCandidate ? 50 : 20,
        isRead: !isCandidate && filter === 'unread' ? false : undefined,
      }),
    enabled: isAuthenticated && open,
    staleTime: 10000,
  });

  const items = pageData?.items ?? [];
  const cachedAllPage = queryClient.getQueryData<{ totalCount?: number }>(['notifications', 'list', 'all']);
  const allTotalCount = filter === 'all' ? (pageData?.totalCount ?? items.length) : (cachedAllPage?.totalCount ?? null);

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

  // Filter cho Candidate view
  const candidateFilteredItems = useMemo(() => {
    if (!isCandidate) return items;
    if (candidateTab === 'unread') {
      return items.filter((item) => !item.isRead);
    }
    if (candidateTab === 'applications') {
      return items.filter((item) => {
        const cat = getNotificationCategory(item);
        return ['Đơn ứng tuyển', 'Phỏng vấn', 'Offer', 'Giới thiệu', 'CV'].includes(cat);
      });
    }
    if (candidateTab === 'matches') {
      return items.filter((item) => {
        const cat = getNotificationCategory(item);
        return cat === 'Việc làm gợi ý';
      });
    }
    return items;
  }, [items, isCandidate, candidateTab]);

  // ── CANDIDATE POPOVER CONTENT (Figma Trang 23 & Trang 34) ──
  const candidatePopoverContent = (
    <div style={{ width: 400, maxHeight: 520, display: 'flex', flexDirection: 'column' }} className="-m-3 bg-white rounded-2xl overflow-hidden font-sans">
      {/* Header Trang 23: Thông báo & Đánh dấu tất cả đã đọc */}
      <div className="flex items-center justify-between border-0 border-b border-solid border-slate-100 px-4 py-3 bg-white">
        <div className="flex items-center gap-2">
          <span className="font-bold text-slate-900 text-[16px]">Thông báo</span>
          {unreadCount > 0 && (
            <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-semibold text-[#0C4A6E]">
              {unreadCount} mới
            </span>
          )}
        </div>
        {unreadCount > 0 && (
          <Button
            type="default"
            size="small"
            loading={markAllReadMutation.isPending}
            onClick={() => markAllReadMutation.mutate()}
            className="!rounded-lg !border-slate-200 hover:!border-slate-300 text-slate-700 hover:text-slate-900 text-xs font-medium shadow-2xs"
          >
            Đánh dấu tất cả đã đọc
          </Button>
        )}
      </div>

      {/* 4 Tabs gạch chân ngang chuẩn Trang 23: Tất cả | Chưa đọc (x) | Đơn ứng tuyển | Việc làm gợi ý */}
      <div className="flex items-center gap-5 px-4 border-0 border-b border-solid border-slate-100 bg-white overflow-x-auto">
        {[
          { key: 'all', label: 'Tất cả' },
          { key: 'unread', label: unreadCount > 0 ? `Chưa đọc (${unreadCount})` : 'Chưa đọc' },
          { key: 'applications', label: 'Đơn ứng tuyển' },
          { key: 'matches', label: 'Việc làm gợi ý' },
        ].map((tab) => {
          const active = candidateTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setCandidateTab(tab.key as CandidateTab)}
              className={`relative py-2.5 text-[13px] font-medium transition-colors border-0 bg-transparent cursor-pointer whitespace-nowrap ${
                active ? 'text-[#0C4A6E] font-semibold' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {tab.label}
              {active && (
                <span className="absolute bottom-0 inset-x-0 h-0.5 bg-[#0C4A6E] rounded-full" />
              )}
            </button>
          );
        })}
      </div>

      {/* Notification Content List */}
      <div className="overflow-y-auto flex-1 max-h-[350px]" tabIndex={0} role="region" aria-label="Danh sách thông báo">
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
        ) : candidateFilteredItems.length === 0 ? (
          /* Empty State Trang 34 PDF */
          <div className="py-12 px-6 text-center flex flex-col items-center justify-center">
            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-2">
              <BellOutlined style={{ fontSize: 18 }} />
            </div>
            <div className="font-semibold text-slate-800 text-sm">Chưa có thông báo</div>
            <p className="text-xs text-slate-500 mt-1 max-w-[240px] leading-relaxed m-0">
              Lịch phỏng vấn, offer và việc làm gợi ý sẽ xuất hiện ở đây.
            </p>
            <Link
              to="/candidate/profile"
              onClick={() => setOpen(false)}
              className="mt-3 inline-flex items-center justify-center rounded-lg bg-[#0C4A6E] hover:bg-[#075985] text-white px-3 py-1.5 text-xs font-semibold shadow-xs transition no-underline"
            >
              Hoàn thiện hồ sơ
            </Link>
          </div>
        ) : (
          /* Danh sách item khớp chuẩn Trang 23 */
          <div className="divide-y divide-slate-100">
            {candidateFilteredItems.map((item) => {
              const read = item.isRead;
              const cat = getNotificationCategory(item);
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
                  className={`flex items-start gap-2.5 px-4 py-3 transition-colors cursor-pointer ${
                    read ? 'bg-white hover:bg-slate-50/80' : 'bg-[#F0F7FF] hover:bg-[#E2F0FE]'
                  }`}
                >
                  {/* Chấm tròn xanh unread chuẩn Trang 23 PDF */}
                  <div className="w-2 shrink-0 pt-1.5 flex justify-center">
                    {!read ? (
                      <span className="h-2 w-2 rounded-full bg-[#0284C7] inline-block shadow-xs" />
                    ) : (
                      <span className="h-2 w-2 inline-block" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-[13px] font-semibold text-slate-900 leading-snug m-0 line-clamp-1">
                      {item.title}
                    </h4>
                    <p className="text-[12px] text-slate-600 leading-relaxed m-0 mt-0.5 line-clamp-2">
                      {item.message}
                    </p>
                    <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1 font-normal">
                      <span className="font-medium text-slate-600">{cat}</span>
                      <span>·</span>
                      <span>{formatTimeAgo(item.createdAt)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer link dẫn sang Trang Thông báo đầy đủ */}
      <div className="border-0 border-t border-solid border-slate-100 bg-slate-50/70 px-4 py-2.5 text-center">
        <Link
          to="/candidate/notifications"
          onClick={() => setOpen(false)}
          className="text-xs font-semibold text-[#0C4A6E] hover:text-[#0369A1] transition inline-flex items-center gap-1 no-underline"
        >
          Xem tất cả thông báo <RightOutlined style={{ fontSize: 10 }} />
        </Link>
      </div>
    </div>
  );

  // ── DEFAULT ENTERPRISE CONSOLE POPOVER CONTENT ──
  const defaultPopoverContent = (
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
            { label: allTotalCount != null ? `Tất cả (${allTotalCount})` : 'Tất cả', value: 'all' },
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
      content={isCandidate ? candidatePopoverContent : defaultPopoverContent}
      trigger="click"
      open={open}
      onOpenChange={handleOpenChange}
      placement="bottomRight"
      arrow={false}
      overlayClassName={isCandidate ? 'hrconnect-candidate-notification-popover' : 'hrconnect-notification-popover'}
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

export default NotificationBell;
