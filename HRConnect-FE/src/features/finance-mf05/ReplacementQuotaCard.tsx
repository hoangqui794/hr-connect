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
import { date } from './financeLabels';
import { PlacementDetailDrawer } from './PlacementDetailDrawer';

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
  // Placement opened from a slot: the replacement once the slot is filled, otherwise the original hire.
  const [detailPlacementId, setDetailPlacementId] = useState<string | null>(null);
  const [cancelForm] = Form.useForm<{ reason: string }>();

  // Query replacement slots and associated job metadata
  const slotsQuery = useQuery({
    queryKey: ['mf05-replacement-slots', mode, selectedJobId],
    queryFn: async (): Promise<ReplacementSlotWithMeta[]> => {
      const jobMetaMap = new Map<string, { jobTitle: string; companyName?: string }>();
      // Jobs that can have a slot; null means "unknown, ask every job" (the old behaviour).
      let jobsWithSlots: Set<string> | null = null;

      if (selectedJobId) {
        jobMetaMap.set(selectedJobId, { jobTitle: selectedJobId });
      } else {
        const [placementsRes, clientJobsRes, voidedRes] = await Promise.all([
          financeApi.getPlacements({ pageSize: 100 }).catch(() => ({ items: [], totalCount: 0 })),
          mode === 'client' ? jobsApi.getMine().catch(() => []) : Promise.resolve([]),
          financeApi.warranties({ status: 'VOIDED', page: 1, pageSize: 100 }).catch(() => null),
        ]);

        // A slot is opened only when Internal HR confirms a resignation, which voids the warranty
        // (main-flows MF-05). So only jobs of placements with a VOIDED warranty need asking. If any
        // voided warranty cannot be matched to a loaded placement, fall back to asking every job.
        if (voidedRes && voidedRes.totalCount <= voidedRes.items.length) {
          const voidedPlacements = new Set(voidedRes.items.map((w) => w.placementId));
          const matched = (placementsRes?.items ?? []).filter((p) => voidedPlacements.has(p.placementId) && p.job?.jobId);
          if (matched.length === voidedPlacements.size) {
            jobsWithSlots = new Set(matched.map((p) => p.job.jobId));
          }
        }

        if (Array.isArray(clientJobsRes)) {
          clientJobsRes.forEach((j) => {
            if (!j.serviceTypeCode || j.serviceTypeCode === 'HEADHUNT_COD') {
              jobMetaMap.set(j.jobId, { jobTitle: j.title });
            }
          });
        }

        if (placementsRes?.items) {
          placementsRes.items.forEach((p) => {
            if (p.job?.jobId) {
              jobMetaMap.set(p.job.jobId, {
                jobTitle: p.job.title,
                companyName: p.job.companyName,
              });
            }
          });
        }
      }

      const jobIds = Array.from(jobMetaMap.keys()).filter((jid) => !jobsWithSlots || jobsWithSlots.has(jid));
      if (jobIds.length === 0) return [];

      // Query replacement slots for all relevant jobs in parallel
      const slotResults: ReplacementSlotWithMeta[][] = [];
      for (let i = 0; i < jobIds.length; i += 4) {
        const batch = jobIds.slice(i, i + 4);
        const batchRes = await Promise.all(
          batch.map(async (jid) => {
            const slots = await financeApi.getReplacementSlots(jid);
            const meta = jobMetaMap.get(jid);
            return slots.map((slot) => ({
              ...slot,
              jobTitle: meta?.jobTitle || slot.jobId,
              companyName: meta?.companyName,
            }));
          })
        );
        slotResults.push(...batchRes);
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
      void queryClient.invalidateQueries({ queryKey: ['mf05-replacement-slots'] });
    },
    onError: (err) => {
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

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const cand = (slot.originalCandidateName || '').toLowerCase();
        const repCand = (slot.replacementCandidateName || '').toLowerCase();
        const title = (slot.jobTitle || '').toLowerCase();
        const id = slot.replacementSlotId.toLowerCase();
        if (!cand.includes(q) && !repCand.includes(q) && !title.includes(q) && !id.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [allSlots, activeTab, searchQuery]);

  // The Client never "uses" a slot by hand: once OPEN, the backend reopens the job and links every Affiliate
  // submission to it, and the slot is filled when the Client confirms the new hire started (MF-05).
  // So the Client only gets links to follow the job and its replacement candidates.
  const openJob = (slot: ReplacementSlotWithMeta) => navigate(`/client/jobs?highlight=${slot.jobId}&openDetail=true`);
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
        return (
          <Tooltip title={conf.description}>
            <Tag color={conf.tagColor} className="m-0 font-medium">
              {conf.label}
            </Tag>
          </Tooltip>
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
        return <span className="text-slate-400">—</span>;
      },
    },
    {
      title: 'Thao tác',
      key: 'actions',
      align: 'right',
      render: (_, slot) => (
        <div className="flex items-center justify-end gap-2">
          {mode === 'client' && (
            <Button
              size="small"
              icon={<EyeOutlined />}
              aria-label={`Xem tin ${slot.jobTitle ?? ''}`}
              className="!h-9 px-3 rounded-lg border-slate-200 text-[#0C4A6E] hover:border-slate-300 font-semibold"
              onClick={() => openJob(slot)}
            >
              Xem tin
            </Button>
          )}

          {mode === 'client' && (
            <Button
              size="small"
              icon={<UserOutlined />}
              aria-label={`Hồ sơ người thay cho ${slot.jobTitle ?? 'tin này'}`}
              className="!h-9 px-3 rounded-lg border-slate-200 text-slate-700 hover:border-slate-300 font-medium"
              onClick={() => openCandidates(slot)}
            >
              Hồ sơ người thay
            </Button>
          )}

          {mode === 'hr' && (slot.status === 'OPEN' || slot.status === 'WAITING_PAYMENT') && (
            <Button
              size="small"
              danger
              icon={<CloseCircleOutlined />}
              onClick={() => {
                cancelForm.resetFields();
                setCancelTarget(slot);
              }}
            >
              Hủy suất
            </Button>
          )}

          {mode === 'hr' && (
            <Button
              size="small"
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
                  Suất tuyển thay thế
                </h3>
                {counts.open > 0 && (
                  <Badge count={`${counts.open} khả dụng`} style={{ backgroundColor: '#10B981' }} />
                )}
              </div>
              {mode === 'client' ? (
                <p className="m-0 mt-0.5 text-[13px] text-slate-600">
                  Ứng viên nghỉ trong bảo hành được HR Connect xác nhận thì bạn có một suất thay thế miễn phí, có hạn sử dụng.
                </p>
              ) : (
                <p className="mt-1 text-sm text-slate-600 max-w-3xl leading-relaxed">
                  Áp dụng cho dịch vụ <strong>Tuyển dụng theo kết quả</strong>. Khi ứng viên nghỉ việc trong thời gian bảo hành và
                  HR Connect xác nhận, bạn được một suất tuyển thay thế <strong>miễn phí</strong>. Suất dùng được ngay nếu phí dịch vụ đã
                  thanh toán, hoặc ở trạng thái chờ cho đến khi bạn thanh toán. Mỗi suất có hạn sử dụng, xem ở cột Thời hạn sử dụng.
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
              prefix={<SearchOutlined className="text-slate-400" />}
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
              <Button type="primary" onClick={() => navigate('/client/warranty')}>
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
            scroll={{ x: 800 }}
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

            <Form form={cancelForm} layout="vertical" preserve={false}>
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

      <PlacementDetailDrawer
        open={Boolean(detailPlacementId)}
        placementId={detailPlacementId || undefined}
        mode={mode}
        onClose={() => setDetailPlacementId(null)}
      />
    </div>
  );
};
