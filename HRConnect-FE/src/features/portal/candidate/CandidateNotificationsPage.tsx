/**
 * @file CandidateNotificationsPage.tsx
 * @description Trang Thông báo dành riêng cho Ứng viên (Candidate), thiết kế chuẩn theo
 * hệ thống giao diện Candidate (Figma Trang 23 & Trang 34).
 * Hỗ trợ 4 bộ lọc: Tất cả, Chưa đọc, Đơn ứng tuyển, Việc làm gợi ý; đánh dấu đã đọc; SignalR realtime.
 */
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, Skeleton } from 'antd';
import { CheckOutlined, ReloadOutlined, RightOutlined } from '@ant-design/icons';
import { notificationApi } from '@/services/api/notificationApi';
import type { NotificationDto } from '@/types/api/notification';
import { useAuthStore } from '@/stores/authStore';
import { getNotificationRoute } from '@/components/notifications/notificationRoutes';
import {
  getCandidateCategoryVisual,
  getNotificationCategory,
} from '@/components/notifications/NotificationBell';

type CandidateTab = 'all' | 'unread' | 'applications' | 'matches';

const FONT = "font-['Be_Vietnam_Pro',system-ui,sans-serif]";
const CARD = 'rounded-xl border border-solid border-[#E5E7EB] bg-white overflow-hidden shadow-[0_1px_2px_rgba(15,23,42,0.03)]';

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

export const CandidateNotificationsPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const role = useAuthStore((s) => s.role);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated) || !!user;

  const [activeTab, setActiveTab] = useState<CandidateTab>('all');

  // 1. Query số lượng chưa đọc
  const { data: unreadData } = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: () => notificationApi.getUnreadCount(),
    enabled: isAuthenticated,
    staleTime: 30000,
  });
  const unreadCount = unreadData?.unreadCount ?? 0;

  // 2. Query danh sách thông báo
  const {
    data: pageData,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['notifications', 'list', 'candidate-page'],
    queryFn: () =>
      notificationApi.getNotifications({
        page: 1,
        pageSize: 100,
      }),
    enabled: isAuthenticated,
    staleTime: 10000,
  });

  const rawItems = pageData?.items ?? [];

  // 3. Mutation: Đánh dấu 1 thông báo đã đọc
  const markAsReadMutation = useMutation({
    mutationFn: (notificationId: string) => notificationApi.markAsRead(notificationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  // 4. Mutation: Đánh dấu tất cả đã đọc
  const markAllReadMutation = useMutation({
    mutationFn: () => notificationApi.markAllAsRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const handleNotificationClick = (item: NotificationDto) => {
    if (!item.isRead) {
      markAsReadMutation.mutate(item.notificationId);
    }
    const targetRoute = getNotificationRoute(item, role);
    if (targetRoute) {
      navigate(targetRoute);
    }
  };

  // Lọc theo 4 tab chuẩn Trang 23 PDF
  const filteredItems = rawItems.filter((item) => {
    if (activeTab === 'unread') {
      return !item.isRead;
    }
    if (activeTab === 'applications') {
      const cat = getNotificationCategory(item);
      return ['Đơn ứng tuyển', 'Phỏng vấn', 'Offer', 'Giới thiệu', 'CV'].includes(cat);
    }
    if (activeTab === 'matches') {
      const cat = getNotificationCategory(item);
      return cat === 'Việc làm gợi ý';
    }
    return true;
  });

  const tabs: { key: CandidateTab; label: string }[] = [
    { key: 'all', label: 'Tất cả' },
    { key: 'unread', label: unreadCount > 0 ? `Chưa đọc (${unreadCount})` : 'Chưa đọc' },
    { key: 'applications', label: 'Đơn ứng tuyển' },
    { key: 'matches', label: 'Việc làm gợi ý' },
  ];

  return (
    <div
      className={`${FONT} mx-auto w-full max-w-[780px] py-2 text-[14px] text-[#1F2937] [line-height:normal] animate-[admin-page-in_220ms_cubic-bezier(0.2,0.8,0.2,1)_both]`}
    >
      {/* Header Trang 23: Tiêu đề & nút Đánh dấu tất cả đã đọc nằm trực tiếp trên nền #F7F8FA */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <h1 className="m-0 text-[22px] font-bold tracking-tight text-[#111827]">
            Thông báo
          </h1>
          {unreadCount > 0 && (
            <span className="rounded-full bg-[#E0F2FE] px-2.5 py-0.5 text-[12px] font-semibold text-[#0369A1]">
              {unreadCount} mới
            </span>
          )}
        </div>
        <button
          type="button"
          disabled={unreadCount === 0 || markAllReadMutation.isPending}
          onClick={() => markAllReadMutation.mutate()}
          className={`${FONT} inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-solid border-[#D1D5DB] bg-white px-3.5 text-[13px] font-medium text-[#1F2937] transition-all duration-200 hover:bg-[#F9FAFB] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60`}
        >
          <CheckOutlined style={{ fontSize: 12 }} />
          <span>Đánh dấu tất cả đã đọc</span>
        </button>
      </div>

      {/* 4 Tabs gạch chân ngang chuẩn Trang 23: Tất cả | Chưa đọc (x) | Đơn ứng tuyển | Việc làm gợi ý */}
      <div className="mt-4 mb-4 flex items-center gap-6 overflow-x-auto border-0 border-b border-solid border-[#E5E7EB] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {tabs.map((tab) => {
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`${FONT} relative cursor-pointer border-0 bg-transparent pb-2.5 pt-1 text-[14px] whitespace-nowrap transition-colors ${
                active
                  ? 'font-semibold text-[#0369A1]'
                  : 'font-normal text-[#4B5563] hover:text-[#111827]'
              }`}
            >
              {tab.label}
              {active && (
                <span className="absolute inset-x-0 bottom-0 h-[2px] bg-[#0369A1] rounded-full" />
              )}
            </button>
          );
        })}
      </div>

      {/* Khung danh sách thông báo */}
      {isLoading ? (
        <div className={`${CARD} p-5`}>
          <Skeleton active paragraph={{ rows: 6 }} />
        </div>
      ) : isError ? (
        <div className={`${CARD} p-6 text-center`}>
          <Alert
            type="error"
            showIcon
            message="Không thể tải danh sách thông báo"
            description={error instanceof Error ? error.message : 'Đã có lỗi xảy ra khi kết nối máy chủ.'}
            action={
              <Button size="small" icon={<ReloadOutlined />} onClick={() => refetch()} className="mt-2">
                Tải lại
              </Button>
            }
          />
        </div>
      ) : filteredItems.length === 0 ? (
        /* Empty State khớp chuẩn Trang 34 PDF: Thông báo trống */
        <div className={`${CARD} px-6 py-12 text-center`}>
          <div className="mx-auto mb-3.5 flex h-11 w-11 items-center justify-center rounded-xl bg-[#E0F2FE]">
            <span className="h-2 w-2 rounded-full bg-[#0369A1]" />
          </div>
          <div className="text-[15px] font-bold text-[#111827]">Chưa có thông báo</div>
          <p className="mx-auto mb-0 mt-1.5 max-w-[300px] text-[13px] leading-relaxed text-[#4B5563]">
            Lịch phỏng vấn, offer và việc làm gợi ý sẽ xuất hiện ở đây.
          </p>
          <Link
            to="/candidate/profile"
            className="mt-4 inline-flex h-9 items-center justify-center rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 px-4 text-[13px] font-bold text-white shadow-sm shadow-blue-500/20 no-underline transition-all hover:from-sky-400 hover:to-blue-500 active:scale-[0.98]"
          >
            Hoàn thiện hồ sơ
          </Link>
        </div>
      ) : (
        /* Danh sách item trực quan, có icon phân loại, nhãn màu và nút Xem chi tiết */
        <div className={CARD}>
          {filteredItems.map((item) => {
            const read = item.isRead;
            const cat = getNotificationCategory(item);
            const visual = getCandidateCategoryVisual(cat);
            const hasRoute = Boolean(getNotificationRoute(item, role));
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
                className={`group flex items-start gap-3.5 border-0 border-b border-solid border-[#F1F5F9] px-5 py-4 transition-colors duration-150 last:border-b-0 cursor-pointer ${
                  read
                    ? 'bg-white hover:bg-[#F8FAFC]'
                    : 'bg-[#F0F9FF]/85 hover:bg-[#E0F2FE]/70'
                }`}
              >
                {/* Icon phân loại trực quan */}
                <div className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-solid ${visual.iconBg}`}>
                  {visual.icon}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className={`m-0 text-[14.5px] leading-snug ${read ? 'font-semibold text-[#1F2937]' : 'font-bold text-[#111827]'}`}>
                      {item.title}
                    </h2>
                    {!read && (
                      <span
                        aria-label="Chưa đọc"
                        className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#0284C7]"
                      />
                    )}
                  </div>
                  <p className="m-0 mt-1 text-[13px] leading-relaxed text-[#4B5563]">
                    {item.message}
                  </p>
                  <div className="mt-2 flex items-center justify-between text-[12px]">
                    <div className="flex items-center gap-1.5 text-[#6B7280]">
                      <span className={`inline-flex items-center rounded border border-solid px-1.5 py-0.5 text-[11px] font-semibold leading-none ${visual.badge}`}>
                        {cat}
                      </span>
                      <span>·</span>
                      <span>{formatTimeAgo(item.createdAt)}</span>
                    </div>
                    {hasRoute && (
                      <span className="font-semibold text-[#0369A1] group-hover:text-[#075985] inline-flex items-center gap-1 text-[12.5px]">
                        Xem chi tiết <RightOutlined style={{ fontSize: 10 }} />
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
  );
};

export default CandidateNotificationsPage;
