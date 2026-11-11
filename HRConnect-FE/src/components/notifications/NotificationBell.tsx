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

export const getCandidateCategoryVisual = (cat: string) => {
  switch (cat) {
    case 'Phỏng vấn':
      return {
        icon: <CalendarOutlined style={{ fontSize: 16, color: '#6366F1' }} />,
        iconBg: 'bg-indigo-50 border-indigo-100',
        badge: 'bg-indigo-50 text-indigo-700 border-indigo-200/70',
      };
    case 'Offer':
      return {
        icon: <CheckCircleFilled style={{ fontSize: 16, color: '#10B981' }} />,
        iconBg: 'bg-emerald-50 border-emerald-100',
        badge: 'bg-emerald-50 text-emerald-700 border-emerald-200/70',
      };
    case 'Giới thiệu':
      return {
        icon: <SolutionOutlined style={{ fontSize: 16, color: '#0284C7' }} />,
        iconBg: 'bg-sky-50 border-sky-100',
        badge: 'bg-sky-50 text-[#0369A1] border-sky-200/70',
      };
    case 'Việc làm gợi ý':
      return {
        icon: <ThunderboltOutlined style={{ fontSize: 16, color: '#D97706' }} />,
        iconBg: 'bg-amber-50 border-amber-100',
        badge: 'bg-amber-50 text-amber-700 border-amber-200/70',
      };
    case 'CV':
    case 'Đơn ứng tuyển':
      return {
        icon: <FileTextOutlined style={{ fontSize: 16, color: '#0369A1' }} />,
        iconBg: 'bg-sky-50 border-sky-100',
        badge: 'bg-slate-100 text-slate-700 border-slate-200/80',
      };
    default:
      return {
        icon: <BellOutlined style={{ fontSize: 16, color: '#0369A1' }} />,
        iconBg: 'bg-slate-100 border-slate-200/80',
        badge: 'bg-slate-100 text-slate-700 border-slate-200/80',
      };
  }
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

type CandidateTab = 'all' | 'unread' | 'action';

/** Unread notices in these categories wait on the candidate (answer an offer, a consent request, an interview). */
const CANDIDATE_ACTION_CATEGORIES = ['Phỏng vấn', 'Offer', 'Giới thiệu'];
/** Category name colour in the candidate panel (text only, AA on white). */
const CANDIDATE_CATEGORY_COLOR: Record<string, string> = {
  'Phỏng vấn': '#6D28D9',
  Offer: '#047857',
  'Giới thiệu': '#0284C7',
  'Việc làm gợi ý': '#B45309',
  'Đơn ứng tuyển': '#0369A1',
  CV: '#0369A1',
};

export const NotificationBell: React.FC<NotificationBellProps> = ({ className, bellColor = '#475569', variant }) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const role = useAuthStore((s) => s.role);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated) || !!user;

  const isCandidate = variant === 'candidate' || role === UserRole.CANDIDATE;
  const isClient = !isCandidate && role === UserRole.CLIENT;
  /** Candidate and Client share the newer panel (tabs, no icons, hidden scrollbar); HR/Admin/Affiliate keep the console panel. */
  const usesNewPanel = isCandidate || isClient;

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
  const listKey = ['notifications', 'list', usesNewPanel ? 'candidate-popover' : filter];
  const listFn = () =>
    notificationApi.getNotifications({
      page: 1,
      pageSize: usesNewPanel ? 50 : 20,
      isRead: !usesNewPanel && filter === 'unread' ? false : undefined,
    });
  // Load the list as soon as the pointer or focus reaches the bell, so the panel opens already filled.
  const prefetchList = () => {
    if (isAuthenticated) void queryClient.prefetchQuery({ queryKey: listKey, queryFn: listFn, staleTime: 30000 });
  };
  const {
    data: pageData,
    isLoading,
    isError,
    error,
    refetch: refetchList,
  } = useQuery({
    queryKey: listKey,
    queryFn: listFn,
    enabled: isAuthenticated && open,
    staleTime: 30000,
    placeholderData: (prev) => prev,
  });

  const items = useMemo(() => pageData?.items ?? [], [pageData?.items]);
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

  // Candidate panel (canvas 10/11): no icons; the list scrolls with the wheel, scrollbar hidden.
  const candidateFilteredItems = useMemo(() => {
    if (!usesNewPanel) return items;
    if (candidateTab === 'unread') return items.filter((item) => !item.isRead);
    if (candidateTab === 'action') {
      return items.filter((item) => !item.isRead && CANDIDATE_ACTION_CATEGORIES.includes(getNotificationCategory(item)));
    }
    return items;
  }, [items, usesNewPanel, candidateTab]);
  const candidateShown = candidateFilteredItems;

  const candidatePopoverContent = (
    <div style={{ width: 400 }} className="-m-3 flex max-w-[calc(100vw-24px)] flex-col overflow-hidden rounded-lg bg-white font-['Be_Vietnam_Pro',system-ui,sans-serif]">
      <div className="flex items-baseline justify-between px-4 pt-3.5">
        <span className="text-[16px] font-bold text-[#0F172A]">Thông báo</span>
        {unreadCount > 0 && (
          <button
            type="button"
            disabled={markAllReadMutation.isPending}
            onClick={() => markAllReadMutation.mutate()}
            className="min-h-[32px] cursor-pointer border-0 bg-transparent p-0 text-[13px] font-semibold text-sky-600 hover:text-sky-700 hover:underline disabled:opacity-60"
          >
            Đánh dấu đã đọc hết
          </button>
        )}
      </div>

      <div role="tablist" aria-label="Lọc thông báo" className="flex gap-5 border-0 border-b border-solid border-[#E2E8F0] px-4">
        {[
          { key: 'all', label: 'Tất cả' },
          { key: 'unread', label: `Chưa đọc (${unreadCount})` },
          { key: 'action', label: 'Cần xử lý' },
        ].map((tab) => {
          const active = candidateTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setCandidateTab(tab.key as CandidateTab)}
              className={`min-h-[40px] cursor-pointer border-0 border-b-2 border-solid bg-transparent p-0 text-[13px] transition-colors ${
                active ? 'border-sky-600 font-bold text-sky-700' : 'border-transparent font-medium text-[#475569] hover:text-[#0F172A]'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div
        role="region"
        tabIndex={0}
        aria-label="Danh sách thông báo, lăn chuột để xem thêm"
        className="max-h-[400px] overflow-y-auto overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {isLoading ? (
          <div className="flex min-h-[280px] flex-col items-center justify-center gap-3">
            <Spin />
            <span className="text-xs text-slate-500">Đang tải thông báo...</span>
          </div>
        ) : isError ? (
          <div className="p-4">
            <Alert
              type="error"
              showIcon
              message="Không thể tải thông báo"
              description={error instanceof Error ? error.message : 'Đã có lỗi xảy ra khi kết nối máy chủ.'}
              action={<Button size="small" onClick={() => refetchList()}>Tải lại</Button>}
            />
          </div>
        ) : candidateShown.length === 0 ? (
          <p className="m-0 px-4 py-9 text-center text-[14px] text-[#64748B]">
            {candidateTab === 'all' ? 'Chưa có thông báo. Lịch phỏng vấn, offer và việc làm gợi ý sẽ hiện ở đây.' : 'Không có thông báo nào ở mục này.'}
          </p>
        ) : (
          candidateShown.map((item) => {
            const read = item.isRead;
            const cat = getNotificationCategory(item);
            const hasRoute = Boolean(getNotificationRoute(item, role));
            return (
              <button
                key={item.notificationId}
                type="button"
                onClick={() => handleNotificationClick(item)}
                className={`block w-full cursor-pointer border-0 border-t border-solid border-[#F1F5F9] px-4 py-3 text-left font-[inherit] transition-colors first:border-t-0 hover:bg-[#F1F5F9] focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#0C4A6E] ${read ? 'bg-white' : 'bg-[#F8FAFC]'}`}
              >
                <span className="flex items-baseline justify-between gap-3">
                  <span className="text-[12px] font-semibold" style={{ color: CANDIDATE_CATEGORY_COLOR[cat] ?? '#475569' }}>{cat}</span>
                  <span className="whitespace-nowrap text-[12px] text-[#64748B]">{formatTimeAgo(item.createdAt)}</span>
                </span>
                <span className={`mt-0.5 block text-[14px] leading-snug text-[#0F172A] ${read ? 'font-medium' : 'font-bold'}`}>
                  {item.title}
                  {!read && <span className="sr-only"> (chưa đọc)</span>}
                </span>
                <span className="mt-0.5 line-clamp-2 block text-[13px] leading-relaxed text-[#475569]">{item.message}</span>
                {hasRoute && (
                  <span className="mt-1.5 inline-block text-[13px] font-semibold text-sky-600 underline underline-offset-[3px]">Xem chi tiết</span>
                )}
              </button>
            );
          })
        )}
      </div>

      {isCandidate && <div className="flex items-center justify-between border-0 border-t border-solid border-[#E2E8F0] px-4">
        <Link to="/candidate/notifications" onClick={() => setOpen(false)} className="inline-flex min-h-[44px] items-center text-[13px] font-semibold text-sky-600 no-underline hover:text-sky-700 hover:underline">
          Xem tất cả thông báo
        </Link>
        <Link to="/candidate/profile" onClick={() => setOpen(false)} className="inline-flex min-h-[44px] items-center text-[13px] text-[#475569] no-underline hover:underline">
          Cài đặt thông báo
        </Link>
      </div>}
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
      content={usesNewPanel ? candidatePopoverContent : defaultPopoverContent}
      trigger="click"
      open={open}
      onOpenChange={handleOpenChange}
      placement="bottomRight"
      arrow={false}
      overlayClassName={usesNewPanel ?'hrconnect-candidate-notification-popover' : 'hrconnect-notification-popover'}
    >
      <Badge count={unreadCount} size="small" offset={[-2, 4]} overflowCount={99}>
        <button
          type="button"
          aria-label="Thông báo hệ thống"
          onMouseEnter={prefetchList}
          onFocus={prefetchList}
          className={`hrc-bell flex ${isClient ? 'h-11 w-11' : 'h-9 w-9'} cursor-pointer items-center justify-center rounded-full border border-solid border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 ${usesNewPanel && open ? 'hrc-bell-ring' : ''} ${
            isCandidate
              ? `hover:!bg-white/10 focus:!outline-none focus-visible:!outline-white/40 ${open ? '!bg-white/15' : ''}`
              : 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600'
          } ${className || ''}`}
        >
          <BellOutlined style={{ fontSize: 17, color: bellColor }} />
        </button>
      </Badge>
    </Popover>
  );
};

export default NotificationBell;
