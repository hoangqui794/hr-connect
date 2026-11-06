/**
 * @file CandidateNotificationsPage.tsx
 * @description Trang Thông báo dành riêng cho Ứng viên (Candidate), thiết kế chuẩn 100% theo
 * Figma Trang 23 & Trang 34 (HR Connect - Trang chủ Guest và Candidate.pdf).
 * Hỗ trợ 4 bộ lọc: Tất cả, Chưa đọc, Đơn ứng tuyển, Việc làm gợi ý; đánh dấu đã đọc; SignalR realtime.
 */
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, Spin } from 'antd';
import {
  BellOutlined,
  CheckOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { notificationApi } from '@/services/api/notificationApi';
import type { NotificationDto } from '@/types/api/notification';
import { useAuthStore } from '@/stores/authStore';
import { getNotificationRoute } from '@/components/notifications/notificationRoutes';
import { getNotificationCategory } from '@/components/notifications/NotificationBell';

type CandidateTab = 'all' | 'unread' | 'applications' | 'matches';

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

  return (
    <div className="min-h-screen bg-[#F8FAFC] py-8 sm:py-10">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        {/* Main Card Container khớp 100% Trang 23 PDF */}
        <div className="rounded-2xl border border-slate-200/90 bg-white shadow-sm overflow-hidden">
          {/* Header Trang 23: Thông báo & Đánh dấu tất cả đã đọc */}
          <div className="flex items-center justify-between px-6 pt-6 pb-4">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 m-0">
              Thông báo
            </h1>
            <Button
              size="middle"
              loading={markAllReadMutation.isPending}
              disabled={unreadCount === 0 || markAllReadMutation.isPending}
              icon={<CheckOutlined />}
              onClick={() => markAllReadMutation.mutate()}
              className="!rounded-lg !border-slate-200 hover:!border-slate-300 text-slate-700 hover:text-slate-900 text-xs font-medium shadow-2xs"
            >
              Đánh dấu tất cả đã đọc
            </Button>
          </div>

          {/* 4 Tabs gạch chân ngang khớp Trang 23: Tất cả | Chưa đọc (x) | Đơn ứng tuyển | Việc làm gợi ý */}
          <div className="flex items-center gap-7 px-6 border-b border-slate-200/80 bg-white">
            {[
              { key: 'all', label: 'Tất cả' },
              { key: 'unread', label: unreadCount > 0 ? `Chưa đọc (${unreadCount})` : 'Chưa đọc' },
              { key: 'applications', label: 'Đơn ứng tuyển' },
              { key: 'matches', label: 'Việc làm gợi ý' },
            ].map((tab) => {
              const active = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key as CandidateTab)}
                  className={`relative py-3 text-[14px] font-medium transition-colors border-0 bg-transparent cursor-pointer whitespace-nowrap ${
                    active ? 'text-[#0C4A6E] font-semibold' : 'text-slate-600 hover:text-slate-900'
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

          {/* Content Area */}
          <div>
            {isLoading ? (
              <div className="py-20 text-center flex flex-col items-center justify-center gap-3">
                <Spin size="large" />
                <span className="text-sm text-slate-500">Đang tải thông báo...</span>
              </div>
            ) : isError ? (
              <div className="p-6 text-center">
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
              <div className="py-16 px-6 text-center flex flex-col items-center justify-center">
                <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
                  <BellOutlined style={{ fontSize: 22 }} />
                </div>
                <div className="font-semibold text-slate-800 text-base">Chưa có thông báo</div>
                <p className="text-sm text-slate-500 mt-1 max-w-[320px] leading-relaxed m-0">
                  Lịch phỏng vấn, offer và việc làm gợi ý sẽ xuất hiện ở đây.
                </p>
                <Link
                  to="/candidate/profile"
                  className="mt-4 inline-flex items-center justify-center rounded-lg bg-[#0C4A6E] hover:bg-[#075985] text-white px-4 py-2 text-xs font-semibold shadow-xs transition no-underline"
                >
                  Hoàn thiện hồ sơ
                </Link>
              </div>
            ) : (
              /* Danh sách item khớp chuẩn Trang 23 PDF */
              <div className="divide-y divide-slate-100">
                {filteredItems.map((item) => {
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
                      className={`flex items-start gap-3.5 px-6 py-4 transition-colors cursor-pointer ${
                        read
                          ? 'bg-white hover:bg-slate-50/80'
                          : 'bg-[#F0F7FF] hover:bg-[#E2F0FE]'
                      }`}
                    >
                      {/* Dấu chấm xanh unread chuẩn Trang 23 PDF */}
                      <div className="w-2.5 shrink-0 pt-1.5 flex justify-center">
                        {!read ? (
                          <span className="h-2 w-2 rounded-full bg-[#0284C7] inline-block shadow-xs" />
                        ) : (
                          <span className="h-2 w-2 inline-block" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <h2 className="text-[14px] font-semibold text-slate-900 leading-snug m-0">
                          {item.title}
                        </h2>
                        <p className="text-[13px] text-slate-600 leading-relaxed m-0 mt-1">
                          {item.message}
                        </p>
                        <div className="text-[12px] text-slate-400 mt-1.5 flex items-center gap-1.5 font-normal">
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
        </div>
      </div>
    </div>
  );
};

export default CandidateNotificationsPage;
