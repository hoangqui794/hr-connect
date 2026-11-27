/**
 * @file features/finance-mf05/ReplacementQuotaCard.tsx
 * @description Replacement Quota (Suất tuyển thay thế) card & management for MF-05 warranty screens.
 * Backed by GET /api/v1/jobs/{jobId}/replacement-slots and POST /api/v1/internal/replacement-slots/{id}/cancel.
 */
import React, { useMemo, useState } from 'react';
import { a11yItemRender } from '@/components/common/paginationA11y';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  App,
  Badge,
  Button,
  Checkbox,
  Descriptions,
  Drawer,
  Empty,
  Form,
  Input,
  Modal,
  Skeleton,
  Table,
  Tag,
  Tooltip,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  CreditCardOutlined,
  ExclamationCircleOutlined,
  EyeOutlined,
  ReloadOutlined,
  SearchOutlined,
  SwapOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { financeApi } from '@/services/api/financeApi';
import { jobsApi } from '@/services/api/jobsApi';
import { getApiErrorMessage } from '@/services/apiClient';
import type { ReplacementSlotDto, ReplacementSlotStatus } from '@/types/api/finance';
import { FilterPills, Initials, Surface } from '@/features/admin-console/ui';
import {
  REPLACEMENT_STATUS_CONFIG,
  getReplacementCountdownInfo,
} from './replacementUtils';
import { date, money } from './financeLabels';
import { PlacementDetailDrawer } from './PlacementDetailDrawer';
import { matchesSearch } from '@/utils/searchMatch';

const FONT = "font-['Be_Vietnam_Pro',system-ui,sans-serif]";

export interface ReplacementSlotWithMeta extends ReplacementSlotDto {
  jobTitle?: string;
  companyName?: string;
}

export interface ReplacementQuotaCardProps {
  mode: 'client' | 'hr';
  selectedJobId?: string;
  onSelectJob?: (jobId: string) => void;
  className?: string;
}

type FilterTab = 'all' | 'OPEN' | 'WAITING_PAYMENT' | 'FILLED' | 'CLOSED';

export const ReplacementQuotaCard: React.FC<ReplacementQuotaCardProps> = ({
  mode,
  selectedJobId,
  className = '',
}) => {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [cancelTarget, setCancelTarget] = useState<ReplacementSlotWithMeta | null>(null);
  const [requestCancelTarget, setRequestCancelTarget] = useState<ReplacementSlotWithMeta | null>(null);
  // Placement opened from a slot: the replacement once the slot is filled, otherwise the original hire.
  const [detailPlacementId, setDetailPlacementId] = useState<string | null>(null);
  const [previewJobSlot, setPreviewJobSlot] = useState<ReplacementSlotWithMeta | null>(null);
  const [cancelForm] = Form.useForm<{ reason: string }>();
  const [requestCancelForm] = Form.useForm<{ reason: string; acknowledged: boolean }>();

  const previewJobQuery = useQuery({
    queryKey: ['mf05-slot-job-preview', previewJobSlot?.jobId],
    queryFn: () => jobsApi.getById(previewJobSlot!.jobId),
    enabled: Boolean(previewJobSlot?.jobId),
    staleTime: 60_000,
  });

  const slotsQuery = useQuery({
    queryKey: ['mf05-replacement-slots', mode, selectedJobId],
    queryFn: async (): Promise<ReplacementSlotWithMeta[]> => {
      // One paged endpoint: BE scopes a Client to its own company and returns job/company names,
      // so the card no longer fans out over placements, jobs and warranties.
      const pageSize = 100;
      const slotResults: ReplacementSlotWithMeta[][] = [];
      const fetchSlots =
        mode === 'client' && typeof financeApi.clientReplacementSlots === 'function'
          ? financeApi.clientReplacementSlots
          : financeApi.replacementSlots;
      for (let page = 1; ; page += 1) {
        const res = await fetchSlots({ jobId: selectedJobId, page, pageSize });
        const items = res?.items ?? [];
        slotResults.push(
          items.map((slot) => ({
            ...slot,
            jobTitle: slot.jobTitle ?? undefined,
            companyName: slot.companyName ?? undefined,
          }))
        );
        if (items.length < pageSize || page * pageSize >= (res?.totalCount ?? 0)) break;
      }
      const allSlots = slotResults.flat();
      return allSlots.sort((a, b) => {
        const order: Record<ReplacementSlotStatus, number> = {
          OPEN: 1,
          WAITING_PAYMENT: 2,
          FILLED: 3,
          EXPIRED: 4,
          CANCELLED: 5,
        };
        const rankDiff = order[a.status] - order[b.status];
        if (rankDiff !== 0) return rankDiff;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
    },
  });

  // Fallback only for legacy payloads lacking direct refund metadata on EXPIRED slots.
  const needsFallbackRefundQuery =
    mode === 'client' &&
    typeof financeApi.serviceFees === 'function' &&
    (slotsQuery.data ?? []).some((slot) => slot.status === 'EXPIRED' && slot.refundAmount == null && !slot.refundStatus);
  const refundsQuery = useQuery({
    queryKey: ['mf05-replacement-refunds', mode],
    enabled: needsFallbackRefundQuery,
    queryFn: async () =>
      (await financeApi.serviceFees({ kind: 'REPLACEMENT_REFUND', page: 1, pageSize: 100 })) ?? {
        items: [],
        totalCount: 0,
        page: 1,
        pageSize: 100,
      },
  });
  const refundOf = (slot: ReplacementSlotWithMeta) =>
    (refundsQuery.data?.items ?? []).find(
      (f) => f.jobId === slot.jobId && (!f.candidateName || !slot.originalCandidateName || f.candidateName === slot.originalCandidateName)
    );


  // 3. Cancel slot mutation (Internal HR)
  const cancelMutation = useMutation({
    mutationFn: async () => {
      if (!cancelTarget) return;
      const values = await cancelForm.validateFields();
      return financeApi.cancelReplacementSlot(cancelTarget.replacementSlotId, {
        reason: values.reason.trim(),
        concurrencyToken: cancelTarget.concurrencyToken,
      });
    },
    onSuccess: () => {
      message.success('Đã hủy suất tuyển thay thế thành công.');
      setCancelTarget(null);
      cancelForm.resetFields();
      for (const queryKey of [
        ['mf05-replacement-slots'],
        ['mf05-replacement-slots-summary'],
        ['mf05-replacement-refunds'],
        ['mf05-warranties'],
        ['placements'],
        ['client-overview'],
      ]) {
        void queryClient.invalidateQueries({ queryKey });
      }
    },
    onError: (err) => {
      if (err && typeof err === 'object' && 'errorFields' in err) return;
      message.error(getApiErrorMessage(err));
    },
  });

  // 3b. Request cancel slot mutation (Client 2-step flow)
  const requestCancelMutation = useMutation({
    mutationFn: async () => {
      if (!requestCancelTarget) return;
      const values = await requestCancelForm.validateFields();
      return financeApi.requestCancelReplacementSlot(requestCancelTarget.replacementSlotId, {
        reason: values.reason.trim(),
        concurrencyToken: requestCancelTarget.concurrencyToken,
      });
    },
    onSuccess: () => {
      message.success('Đã gửi yêu cầu hủy suất thay thế tới HR Connect.');
      setRequestCancelTarget(null);
      requestCancelForm.resetFields();
      for (const queryKey of [
        ['mf05-replacement-slots'],
        ['mf05-replacement-slots-summary'],
        ['mf05-replacement-refunds'],
        ['mf05-warranties'],
        ['placements'],
        ['client-overview'],
      ]) {
        void queryClient.invalidateQueries({ queryKey });
      }
    },
    onError: (err) => {
      if (err && typeof err === 'object' && 'errorFields' in err) return;
      message.error(getApiErrorMessage(err));
    },
  });

  // 4. Filter and search logic
  const allSlots = useMemo(() => slotsQuery.data ?? [], [slotsQuery.data]);
  const counts = useMemo(() => {
    return {
      all: allSlots.length,
      open: allSlots.filter((s) => s.status === 'OPEN').length,
      waiting: allSlots.filter((s) => s.status === 'WAITING_PAYMENT').length,
      filled: allSlots.filter((s) => s.status === 'FILLED').length,
      closed: allSlots.filter((s) => s.status === 'EXPIRED' || s.status === 'CANCELLED').length,
    };
  }, [allSlots]);

  const filteredSlots = useMemo(() => {
    return allSlots.filter((slot) => {
      // Tab filter
      if (activeTab === 'OPEN' && slot.status !== 'OPEN') return false;
      if (activeTab === 'WAITING_PAYMENT' && slot.status !== 'WAITING_PAYMENT') return false;
      if (activeTab === 'FILLED' && slot.status !== 'FILLED') return false;
      if (activeTab === 'CLOSED' && slot.status !== 'EXPIRED' && slot.status !== 'CANCELLED') return false;

      // Search filter (Vietnamese-normalized, including companyName)
      if (searchQuery.trim()) {
        if (
          !matchesSearch(
            searchQuery,
            slot.originalCandidateName,
            slot.replacementCandidateName,
            slot.jobTitle,
            slot.companyName,
            slot.replacementSlotId
          )
        ) {
          return false;
        }
      }
      return true;
    });
  }, [allSlots, activeTab, searchQuery]);

  // The Client never "uses" a slot by hand: once OPEN, the backend reopens the job and links every Affiliate
  // submission to it, and the slot is filled when the Client confirms the new hire started (MF-05).
  // So the Client only gets links to follow the job and its replacement candidates.
  const openJob = (slot: ReplacementSlotWithMeta) => setPreviewJobSlot(slot);
  const openCandidates = (slot: ReplacementSlotWithMeta) => navigate(`/client/candidates?job=${slot.jobId}`);

  // Table columns
  const columns: ColumnsType<ReplacementSlotWithMeta> = [
    {
      title: 'Mã suất',
      key: 'code',
      width: 130,
      render: (_, slot) => {
        const shortId = slot.replacementSlotId.slice(0, 8).toUpperCase();
        return (
          <Tooltip title={`Mã đầy đủ: ${slot.replacementSlotId}`}>
            <span className="font-mono text-xs font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
              #{shortId}
            </span>
          </Tooltip>
        );
      },
    },
    {
      title: 'Vị trí công việc',
      key: 'job',
      render: (_, slot) => (
        <div>
          <div className="font-semibold text-slate-900 leading-snug">
            {slot.jobTitle || 'Vị trí tuyển dụng'}
          </div>
          {slot.companyName && (
            <div className="text-xs text-slate-500 mt-0.5">{slot.companyName}</div>
          )}
        </div>
      ),
    },
    {
      title: 'Ứng viên bảo hành (người cũ)',
      key: 'originalCandidate',
      render: (_, slot) => (
        <div className="flex items-center gap-2">
          <Initials name={slot.originalCandidateName || 'Ứng viên'} size={28} />
          <div>
            <div className="font-medium text-slate-800 text-sm">
              {slot.originalCandidateName || '—'}
            </div>
            <div className="text-xs text-slate-400">Nghỉ việc trong bảo hành</div>
          </div>
        </div>
      ),
    },
    {
      title: 'Trạng thái',
      key: 'status',
      render: (_, slot) => {
        const conf = REPLACEMENT_STATUS_CONFIG[slot.status];
        const fallbackRefund = slot.status === 'EXPIRED' && mode === 'client' ? refundOf(slot) : undefined;
        const hasDirectRefund = slot.refundAmount != null || Boolean(slot.refundStatus);
        const refundStatus = hasDirectRefund ? slot.refundStatus : fallbackRefund?.status;
        const refundAmount = hasDirectRefund ? slot.refundAmount : fallbackRefund?.amount;
        const pctLabel =
          slot.refundPercent != null
            ? `${Number(slot.refundPercent.toFixed(2))}% `
            : fallbackRefund?.feeMultiplier != null
            ? `${Number((fallbackRefund.feeMultiplier * 100).toFixed(2))}% `
            : '';
        return (
          <div className="space-y-1">
            <Tooltip title={conf.description}>
              <Tag color={conf.tagColor} className="m-0 font-medium">
                {conf.label}
              </Tag>
            </Tooltip>
            {mode === 'hr' &&
              Boolean(slot.cancelRequestedAt) &&
              (slot.status === 'OPEN' || slot.status === 'WAITING_PAYMENT') && (
                <div className="space-y-0.5 pt-0.5">
                  <Tag color="volcano" className="m-0 font-semibold">
                    Client yêu cầu hủy
                  </Tag>
                  {slot.cancelRequestReason && (
                    <div
                      className="text-xs text-rose-700 line-clamp-2"
                      title={slot.cancelRequestReason}
                    >
                      Lý do: {slot.cancelRequestReason}
                    </div>
                  )}
                </div>
              )}
            {slot.status === 'EXPIRED' && mode === 'client' && (
              <div>
                {refundStatus === 'CANCELLED' ? (
                  <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                    Đã hủy hoàn phí
                  </span>
                ) : refundStatus || refundAmount != null ? (
                  <span
                    className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                      refundStatus === 'PAID'
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                        : 'border-sky-200 bg-sky-50 text-sky-800'
                    }`}
                  >
                    <CheckCircleOutlined />
                    {refundStatus === 'PAID' ? 'Đã hoàn' : 'Chờ hoàn'} {pctLabel}
                    {refundAmount != null ? `(${money(refundAmount)})` : ''}
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                    Đang xử lý hoàn phí
                  </span>
                )}
              </div>
            )}
          </div>
        );
      },
    },
    {
      title: 'Thời hạn sử dụng',
      key: 'deadline',
      render: (_, slot) => {
        const countdown = getReplacementCountdownInfo(slot);
        return (
          <div>
            <div className="text-sm tabular-nums text-slate-700">
              {slot.expiresAt ? date(slot.expiresAt) : 'Chưa kích hoạt'}
            </div>
            {(slot.openedAt || slot.fillWindowDays > 0) && (
              <div className="mt-0.5 text-xs text-slate-500 tabular-nums">
                {slot.openedAt ? `Mở ${date(slot.openedAt)}` : ''}
                {slot.openedAt && slot.fillWindowDays > 0 ? ' · ' : ''}
                {slot.fillWindowDays > 0 ? `Hạn tìm thay ${slot.fillWindowDays} ngày` : ''}
              </div>
            )}
            {slot.status === 'OPEN' && (
              <div className="mt-0.5">
                <Tag color={countdown.badgeColor} className="m-0 text-xs font-semibold">
                  {countdown.countdownText}
                </Tag>
              </div>
            )}
            {slot.status === 'EXPIRED' && (
              <span className="text-xs text-red-600 font-medium">Đã hết hạn</span>
            )}
            {slot.extendedAt && <div className="mt-0.5 text-xs text-slate-500">Đã gia hạn ngày {date(slot.extendedAt)}</div>}
          </div>
        );
      },
    },
    {
      title: 'Ứng viên thay thế',
      key: 'replacement',
      render: (_, slot) => {
        if (slot.replacementCandidateName) {
          return (
            <div className="flex items-center gap-1.5 text-emerald-700 font-medium text-sm">
              <CheckCircleOutlined />
              <span>{slot.replacementCandidateName}</span>
            </div>
          );
        }
        if (slot.status === 'OPEN') {
          return mode === 'client' ? (
            <div className="text-xs leading-snug">
              <div className="font-semibold text-amber-700">Affiliate đang tìm người thay</div>
              <div className="text-slate-500">Bạn không cần làm gì, hồ sơ mới sẽ vào tin này</div>
            </div>
          ) : (
            <span className="text-xs text-amber-700 font-medium">Đang tìm ứng viên...</span>
          );
        }
        if (slot.status === 'WAITING_PAYMENT' && mode === 'client') {
          return <span className="text-xs font-semibold text-amber-700">Mở sau khi bạn thanh toán phí tuyển</span>;
        }
        if (slot.status === 'EXPIRED') {
          return <span className="text-xs text-slate-500">Chưa tuyển được người thay</span>;
        }
        if (slot.status === 'CANCELLED' && slot.cancelReason) {
          return (
            <div className="text-xs text-slate-500 line-clamp-2" title={slot.cancelReason}>
              Lý do hủy: {slot.cancelReason}
            </div>
          );
        }
        return <span className="text-slate-500">—</span>;
      },
    },
    {
      title: 'Thao tác',
      key: 'actions',
      align: 'right',
      render: (_, slot) => (
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          {mode === 'client' && slot.status === 'WAITING_PAYMENT' && (
            <Button
              size="small"
              type="primary"
              icon={<CreditCardOutlined />}
              className="!h-8 px-3 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-semibold shadow-xs"
              onClick={() => {
                const params = new URLSearchParams();
                if (slot.serviceFeeId) params.set('highlight', slot.serviceFeeId);
                if (slot.originalCandidateName) params.set('q', slot.originalCandidateName);
                navigate(`/client/billing${params.toString() ? `?${params.toString()}` : ''}`);
              }}
            >
              Thanh toán phí
            </Button>
          )}

          {mode === 'client' && (
            <Button
              size="small"
              icon={<EyeOutlined />}
              aria-label={`Xem tin ${slot.jobTitle ?? ''}`}
              className="!h-8 px-3 rounded-lg border-slate-200 text-[#0C4A6E] hover:border-slate-300 font-semibold"
              onClick={() => openJob(slot)}
            >
              Xem tin
            </Button>
          )}

          {mode === 'client' && slot.status === 'EXPIRED' && (
            <Button
              size="small"
              type="primary"
              className="!h-8 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow-xs"
              onClick={() => {
                const params = new URLSearchParams({ status: 'REFUND' });
                const targetId = slot.refundServiceFeeId || slot.originalPlacementId;
                if (targetId) params.set('highlight', targetId);
                if (slot.originalCandidateName) params.set('q', slot.originalCandidateName);
                navigate(`/client/billing?${params.toString()}`);
              }}
            >
              Xem hoàn phí
            </Button>
          )}

          {mode === 'client' && (slot.status === 'FILLED' || Boolean(slot.replacementCandidateName)) && (
            <Button
              size="small"
              icon={<UserOutlined />}
              aria-label={`Hồ sơ người thay cho ${slot.jobTitle ?? 'tin này'}`}
              className="!h-8 px-3 rounded-lg border-slate-200 text-slate-700 hover:border-slate-300 font-medium"
              onClick={() => {
                if (slot.filledByPlacementId) {
                  setDetailPlacementId(slot.filledByPlacementId);
                } else {
                  openCandidates(slot);
                }
              }}
            >
              Hồ sơ người thay
            </Button>
          )}

          {mode === 'client' && (slot.status === 'OPEN' || slot.status === 'WAITING_PAYMENT') && (
            slot.cancelRequestedAt ? (
              <Tooltip title={slot.cancelRequestReason || 'Yêu cầu hủy đang chờ HR Connect xác nhận'}>
                <Tag color="orange" tabIndex={0} className="m-0 py-1 px-2.5 rounded-lg font-medium">
                  Đã gửi yêu cầu hủy
                </Tag>
              </Tooltip>
            ) : (
              <Button
                size="small"
                danger
                icon={<CloseCircleOutlined />}
                className="!h-8 px-3 rounded-lg font-medium"
                onClick={() => setRequestCancelTarget(slot)}
              >
                Yêu cầu hủy
              </Button>
            )
          )}

          {mode === 'hr' && (slot.status === 'OPEN' || slot.status === 'WAITING_PAYMENT') && (
            <Button
              size="small"
              danger
              className="!h-8"
              icon={<CloseCircleOutlined />}
              onClick={() => setCancelTarget(slot)}
            >
              Hủy suất
            </Button>
          )}

          {mode === 'hr' && (
            <Button
              size="small"
              className="!h-8"
              icon={<EyeOutlined />}
              aria-label={`Chi tiết suất ${slot.replacementSlotId.slice(0, 8).toUpperCase()}`}
              onClick={() => setDetailPlacementId(slot.filledByPlacementId ?? slot.originalPlacementId)}
            >
              Chi tiết
            </Button>
          )}
        </div>
      ),
    },
  ];

  const isLoading = slotsQuery.isLoading;
  const isError = slotsQuery.isError;


  return (
    <div className={`mb-8 ${FONT} ${className}`}>
      {/* Header Card */}
      <Surface padded className={`mb-4 bg-gradient-to-r from-emerald-50/70 via-teal-50/40 to-white border border-emerald-100 ${mode === 'client' ? '!px-4 !py-3' : ''}`}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className={`flex shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm ${mode === 'client' ? 'h-9 w-9' : 'h-11 w-11'}`}>
              <SwapOutlined className="text-xl" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="m-0 text-lg font-bold text-slate-900">
                  Bảo hành tuyển thay thế
                </h3>
                {counts.open > 0 && (
                  <Badge count={`${counts.open} đang mở`} style={{ backgroundColor: '#10B981' }} />
                )}
              </div>
              {mode === 'client' ? (
                <p className="m-0 mt-0.5 text-[13px] text-slate-600">
                  Theo dõi các vị trí được HR Connect hỗ trợ tuyển người thay thế miễn phí sau khi xác nhận ứng viên nghỉ trong thời gian bảo hành.
                </p>
              ) : (
                <p className="mt-1 text-sm text-slate-600 max-w-3xl leading-relaxed">
                  Áp dụng cho dịch vụ <strong>Tuyển dụng theo kết quả</strong>. Khi ứng viên nghỉ việc trong thời gian bảo hành và
                  HR Connect xác nhận, doanh nghiệp được hỗ trợ tuyển người thay thế <strong>miễn phí</strong>. Yêu cầu mở ngay nếu phí dịch vụ đã
                  thanh toán, hoặc ở trạng thái chờ cho đến khi thanh toán. Xem hạn áp dụng ở cột Thời hạn sử dụng.
                </p>
              )}
            </div>
          </div>
          <Button
            icon={<ReloadOutlined spin={slotsQuery.isFetching} />}
            onClick={() => void slotsQuery.refetch()}
            loading={slotsQuery.isFetching}
          >
            Làm mới
          </Button>
        </div>

        {/* Quick Filter & Search Bar */}
        <div className={`flex flex-wrap items-center justify-between gap-3 border-0 border-t border-solid border-emerald-100/70 ${mode === 'client' ? 'mt-3 pt-3' : 'mt-5 pt-4'}`}>
          <FilterPills<FilterTab>
            label="Lọc theo trạng thái suất"
            value={activeTab}
            onChange={setActiveTab}
            options={[
              { value: 'all', label: 'Tất cả', count: counts.all },
              { value: 'OPEN', label: 'Khả dụng', count: counts.open },
              { value: 'WAITING_PAYMENT', label: 'Chờ thanh toán', count: counts.waiting },
              { value: 'FILLED', label: 'Đã hoàn tất', count: counts.filled },
              { value: 'CLOSED', label: 'Hết hạn / Đã hủy', count: counts.closed },
            ]}
          />

          <div className="w-full sm:w-72">
            <Input
              prefix={<SearchOutlined className="text-slate-500" />}
              placeholder="Tìm theo ứng viên, vị trí, mã..."
              aria-label="Tìm theo ứng viên, vị trí hoặc mã"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              allowClear
              size="middle"
            />
          </div>
        </div>
      </Surface>

      {/* 3 UI States: Loading, Error, Empty, and Content */}
      {isLoading ? (
        <Surface padded className="bg-white">
          <Skeleton active paragraph={{ rows: 5 }} />
        </Surface>
      ) : isError ? (
        <Surface padded className="bg-white">
          <Alert
            type="error"
            showIcon
            message="Không thể tải danh sách suất tuyển thay thế"
            description={getApiErrorMessage(slotsQuery.error)}
            action={
              <Button size="small" type="primary" danger onClick={() => void slotsQuery.refetch()}>
                Thử lại
              </Button>
            }
          />
        </Surface>
      ) : filteredSlots.length === 0 ? (
        <Surface padded className="bg-white text-center py-10">
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <div>
                <div className="font-semibold text-slate-800 text-base">
                  Chưa có suất tuyển thay thế nào
                </div>
                <div className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
                  {allSlots.length > 0
                    ? 'Không tìm thấy suất nào phù hợp với bộ lọc hiện tại.'
                    : 'Khi ứng viên nghỉ việc trong thời gian bảo hành của tin Tuyển dụng theo kết quả, suất thay thế sẽ tự động được cấp phát tại đây.'}
                </div>
              </div>
            }
          >
            {activeTab !== 'all' || searchQuery ? (
              <Button
                onClick={() => {
                  setActiveTab('all');
                  setSearchQuery('');
                }}
              >
                Xóa bộ lọc
              </Button>
            ) : mode === 'client' ? (
              <Button
                type="primary"
                onClick={() => {
                  const el = document.getElementById('client-warranty-list');
                  if (el && typeof el.scrollIntoView === 'function') {
                    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }
                }}
              >
                Xem danh sách bảo hành
              </Button>
            ) : null}
          </Empty>
        </Surface>
      ) : (
        <Surface className="bg-white overflow-hidden">
          <Table
            rowKey="replacementSlotId"
            columns={columns}
            dataSource={filteredSlots}
            pagination={{ itemRender: a11yItemRender, pageSize: 10, showSizeChanger: false }}
            scroll={{ x: 980 }}
          />
        </Surface>
      )}

      {/* Internal HR Cancel Slot Modal */}
      <Modal
        open={Boolean(cancelTarget)}
        title={
          <div className="flex items-center gap-2 text-red-600">
            <ExclamationCircleOutlined />
            <span>Hủy suất tuyển thay thế</span>
          </div>
        }
        okText="Xác nhận hủy"
        cancelText="Đóng"
        okButtonProps={{ danger: true, loading: cancelMutation.isPending }}
        onOk={() => cancelMutation.mutate()}
        onCancel={() => {
          setCancelTarget(null);
          cancelForm.resetFields();
        }}
        destroyOnHidden
      >
        {cancelTarget && (
          <div className="space-y-3">
            <Alert
              type="warning"
              showIcon
              message={
                <div>
                  Hủy suất thay thế cho ứng viên <strong>{cancelTarget.originalCandidateName || '—'}</strong> ({cancelTarget.jobTitle || 'Vị trí'}).
                  <div className="text-xs text-slate-600 mt-0.5">
                    Lưu ý: theo thỏa thuận dịch vụ Tuyển dụng theo kết quả, hủy suất thay thế không hoàn lại phí dịch vụ đã thu.
                  </div>
                </div>
              }
            />

            <Form
              key={cancelTarget.replacementSlotId}
              form={cancelForm}
              layout="vertical"
              preserve={false}
              initialValues={{ reason: cancelTarget.cancelRequestReason ?? '' }}
            >
              <Form.Item
                name="reason"
                label="Lý do hủy suất (bắt buộc)"
                rules={[
                  { required: true, whitespace: true, message: 'Vui lòng nhập lý do hủy suất thay thế.' },
                  { max: 500, message: 'Lý do tối đa 500 ký tự.' },
                ]}
              >
                <Input.TextArea
                  rows={4}
                  showCount
                  maxLength={500}
                  placeholder="Ví dụ: Doanh nghiệp đã cơ cấu lại phòng ban và không còn nhu cầu tuyển thay thế vị trí này..."
                />
              </Form.Item>
            </Form>
          </div>
        )}
      </Modal>

      {/* Client Request Cancel Slot Modal */}
      <Modal
        open={Boolean(requestCancelTarget)}
        title={
          <div className="flex items-center gap-2 text-red-600">
            <ExclamationCircleOutlined />
            <span>Yêu cầu hủy suất tuyển thay thế</span>
          </div>
        }
        okText="Gửi yêu cầu hủy"
        cancelText="Đóng"
        okButtonProps={{ danger: true, loading: requestCancelMutation.isPending }}
        onOk={() => requestCancelMutation.mutate()}
        onCancel={() => {
          setRequestCancelTarget(null);
          requestCancelForm.resetFields();
        }}
        destroyOnHidden
      >
        {requestCancelTarget && (
          <div className="space-y-3">
            <Alert
              type="error"
              showIcon
              message="Lưu ý quan trọng trước khi hủy suất"
              description="Hủy suất sẽ chấm dứt quyền tuyển thay thế miễn phí và không phát sinh hoàn phí. Yêu cầu của bạn sẽ được gửi tới HR Connect để xác nhận."
            />

            <Form form={requestCancelForm} layout="vertical" preserve={false}>
              <Form.Item
                name="reason"
                label="Lý do hủy suất (bắt buộc)"
                rules={[
                  { required: true, whitespace: true, message: 'Vui lòng nhập lý do hủy suất.' },
                  { max: 500, message: 'Lý do tối đa 500 ký tự.' },
                ]}
              >
                <Input.TextArea
                  rows={4}
                  showCount
                  maxLength={500}
                  placeholder="Ví dụ: Doanh nghiệp đã sắp xếp nhân sự nội bộ và không còn nhu cầu tuyển thay thế..."
                />
              </Form.Item>
              <Form.Item
                name="acknowledged"
                valuePropName="checked"
                rules={[
                  {
                    validator: (_, value) =>
                      value
                        ? Promise.resolve()
                        : Promise.reject(new Error('Vui lòng xác nhận bạn đã hiểu điều khoản không hoàn phí.')),
                  },
                ]}
              >
                <Checkbox>
                  Tôi hiểu rằng việc hủy suất sẽ không được hoàn phí
                </Checkbox>
              </Form.Item>
            </Form>
          </div>
        )}
      </Modal>

      <PlacementDetailDrawer
        open={Boolean(detailPlacementId)}
        placementId={detailPlacementId || undefined}
        mode={mode}
        onClose={() => setDetailPlacementId(null)}
      />

      <Drawer
        title="Chi tiết tin tuyển dụng"
        width={560}
        open={Boolean(previewJobSlot)}
        onClose={() => setPreviewJobSlot(null)}
        extra={
          previewJobSlot && (
            <Button
              size="small"
              onClick={() => {
                const jid = previewJobSlot.jobId;
                setPreviewJobSlot(null);
                navigate(`/client/jobs?highlight=${jid}&openDetail=true`);
              }}
            >
              Mở trang Tin tuyển dụng
            </Button>
          )
        }
      >
        {previewJobQuery.isLoading ? (
          <Skeleton active paragraph={{ rows: 6 }} />
        ) : previewJobQuery.isError ? (
          <Alert
            type="error"
            showIcon
            message="Không tải được chi tiết tin tuyển dụng"
            description={getApiErrorMessage(previewJobQuery.error)}
          />
        ) : (
          <div className="space-y-4">
            <div>
              <div className="text-base font-bold text-slate-900">
                {previewJobQuery.data?.title || previewJobSlot?.jobTitle || 'Tin tuyển dụng'}
              </div>
              <div className="mt-1 text-xs text-slate-500">
                {previewJobQuery.data?.companyName || previewJobSlot?.companyName || '—'}
              </div>
            </div>

            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="Trạng thái">
                <Tag color="blue">{previewJobQuery.data?.status ?? '—'}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Địa điểm">
                {previewJobQuery.data?.location || '—'}
              </Descriptions.Item>
              <Descriptions.Item label="Mức lương">
                {previewJobQuery.data?.salaryMin != null || previewJobQuery.data?.salaryMax != null
                  ? `${previewJobQuery.data?.salaryMin != null ? money(previewJobQuery.data.salaryMin) : 'Thỏa thuận'} – ${previewJobQuery.data?.salaryMax != null ? money(previewJobQuery.data.salaryMax) : 'Thỏa thuận'}`
                  : 'Thỏa thuận'}
              </Descriptions.Item>
              <Descriptions.Item label="Số lượng tuyển">
                {previewJobQuery.data?.quantity ?? '—'}
              </Descriptions.Item>
              <Descriptions.Item label="Thời hạn bảo hành">
                {previewJobQuery.data?.warrantyDays != null ? `${previewJobQuery.data.warrantyDays} ngày` : '—'}
              </Descriptions.Item>
            </Descriptions>

            {previewJobQuery.data?.description && (
              <div>
                <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Mô tả công việc
                </div>
                <div className="whitespace-pre-line rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-sm text-slate-700">
                  {previewJobQuery.data.description}
                </div>
              </div>
            )}

            {previewJobQuery.data?.benefits && (
              <div>
                <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Phúc lợi
                </div>
                <div className="whitespace-pre-line rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-sm text-slate-700">
                  {previewJobQuery.data.benefits}
                </div>
              </div>
            )}
          </div>
        )}
      </Drawer>
    </div>
  );
};
