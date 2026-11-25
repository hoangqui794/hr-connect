import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, Drawer, Input, Select, Skeleton, Space, Table, Tag, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { SearchOutlined } from '@ant-design/icons';
import { adminIdentityClaimApi } from '@/services/api/mf02/adminIdentityClaimApi';
import { getApiErrorMessage } from '@/services/apiClient';
import { useAuthStore } from '@/stores/authStore';
import type {
  AdminCandidateDuplicateDecision,
  AdminCandidateDuplicateDetail,
  AdminCandidateDuplicateListItem,
  AdminCandidateDuplicateParty,
  AdminCandidateDuplicateRiskLevel,
  AdminCandidateDuplicateStatus,
  AdminCandidateDuplicateSubmission,
} from '@/types/api/mf02';
import { formatDateTime } from './adminTheme';
import { PersonCell, StatusDot, type Tone } from './ui';

const PAGE_SIZE = 20;
const MIN_REASON_LENGTH = 10;

const DUPLICATE_STATUS_META: Record<string, { label: string; tone: Tone }> = {
  OPEN: { label: 'Chờ xử lý', tone: 'warning' },
  UNDER_REVIEW: { label: 'Đang rà soát', tone: 'info' },
  AWAITING_CANDIDATE: { label: 'Chờ ứng viên', tone: 'info' },
  BLOCKED_FINANCE: { label: 'Chặn do tài chính', tone: 'danger' },
  MERGED: { label: 'Đã hợp nhất', tone: 'success' },
  DISMISSED: { label: 'Không phải trùng', tone: 'neutral' },
};

const RISK_META: Record<string, { label: string; tone: Tone }> = {
  HIGH: { label: 'Rủi ro cao', tone: 'danger' },
  REVIEW: { label: 'Cần rà soát', tone: 'warning' },
};

const RESOLUTION_LABELS: Record<string, string> = {
  MERGE: 'Đã hợp nhất về hồ sơ gốc',
  MERGED: 'Đã hợp nhất về hồ sơ gốc',
  DISMISS: 'Đã xác nhận không phải trùng',
  DISMISSED: 'Đã xác nhận không phải trùng',
  NEED_MORE_EVIDENCE: 'Yêu cầu bổ sung bằng chứng',
};

const SUBMISSION_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  PENDING_CONSENT: { label: 'Chờ xác nhận', color: 'gold' },
  PENDING_IDENTITY_REVIEW: { label: 'Tạm giữ đối chiếu', color: 'orange' },
  SUBMITTED: { label: 'Đã nộp', color: 'blue' },
  ACCEPTED: { label: 'Đã chấp nhận', color: 'green' },
  CONSENTED: { label: 'Đã xác nhận', color: 'green' },
  REJECTED_CONSENT: { label: 'Ứng viên từ chối', color: 'default' },
  REPORTED_UNAUTHORIZED: { label: 'Báo cáo trái phép', color: 'red' },
  EXPIRED: { label: 'Hết hạn', color: 'default' },
  CANCELLED: { label: 'Đã hủy', color: 'default' },
  BLOCKED_DUPLICATE: { label: 'Chặn trùng', color: 'red' },
  BLOCKED_CLIENT_OWNED: { label: 'Thuộc kho DN', color: 'volcano' },
  CLOSED_DUPLICATE: { label: 'Đóng do trùng', color: 'default' },
};

const SOURCE_LABELS: Record<string, string> = {
  AFFILIATE: 'CTV giới thiệu',
  CANDIDATE: 'Ứng viên tự nộp',
  DIRECT: 'Ứng viên tự nộp',
};

const CONSENT_STATUS_LABELS: Record<string, string> = {
  CONFIRMED: 'Đã đồng ý',
  PENDING: 'Chờ xác nhận',
  REJECTED: 'Từ chối',
  REPORTED_UNAUTHORIZED: 'Báo cáo trái phép',
  EXPIRED: 'Hết hạn',
};

const ATTRIBUTION_LABELS: Record<string, string> = {
  ACTIVE: 'Đang giữ quyền',
  SUPERSEDED: 'Đã thay thế',
  VOIDED: 'Đã hủy',
  REVOKED: 'Đã thu hồi',
};

const COMMISSION_LABELS: Record<string, string> = {
  PENDING: 'Chờ duyệt HH',
  EARNED: 'Đã ghi nhận HH',
  PAID: 'Đã chi trả HH',
  VOIDED: 'Đã hủy HH',
  CANCELLED: 'Đã hủy HH',
};

const SIGNAL_LABELS: Record<string, string> = {
  VERIFIED_EMAIL_OWNERSHIP: 'Đã xác minh quyền sở hữu email qua OTP',
  CV_CONTENT_SHA256_AND_NAME_MATCH: 'Trùng nội dung file CV (SHA-256) và Họ tên',
  CV_CONTENT_SHA256_MATCH: 'Trùng nội dung file CV (SHA-256)',
  NORMALIZED_PHONE_MATCH: 'Trùng số điện thoại chuẩn hóa',
  NORMALIZED_EMAIL_MATCH: 'Trùng email chuẩn hóa',
  CANDIDATE_IDENTITY_CLAIM: 'Yêu cầu gộp hồ sơ từ ứng viên',
};

const formatSignalEvidence = (reasonCode: string, rawEvidence: string): string | null => {
  const trimmed = rawEvidence?.trim();
  if (!trimmed) return null;

  if (reasonCode === 'VERIFIED_EMAIL_OWNERSHIP') {
    return 'Ứng viên đã xác thực thành công mã OTP gửi tới email cần khôi phục.';
  }

  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed) as Record<string, unknown>;
      if (parsed.proof === 'email-otp' && parsed.ownership === 'verified') {
        return 'Ứng viên đã xác thực thành công mã OTP qua email.';
      }
      const readableEntries = Object.entries(parsed)
        .filter(([, value]) => value !== null && value !== undefined && value !== '')
        .map(([key, value]) => `${key}: ${String(value)}`);
      return readableEntries.length > 0 ? readableEntries.join(' · ') : null;
    } catch {
      return trimmed;
    }
  }

  if (trimmed.toLowerCase().includes('sha256=')) {
    return 'Hệ thống đối chiếu trùng khớp dấu vân tay SHA-256 của file CV và Họ tên chuẩn hóa.';
  }

  return trimmed;
};

const statusOptions = [
  { value: '', label: 'Tất cả trạng thái' },
  ...Object.entries(DUPLICATE_STATUS_META).map(([value, meta]) => ({ value, label: meta.label })),
];

const riskOptions = [
  { value: '', label: 'Mọi mức rủi ro' },
  { value: 'HIGH', label: 'Rủi ro cao' },
  { value: 'REVIEW', label: 'Cần rà soát' },
];

const formatPartyContact = (party: AdminCandidateDuplicateParty): string => {
  const parts = [party.maskedEmail, party.maskedPhone].filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : 'Chưa có thông tin liên hệ';
};

interface AdminDuplicateCasesPanelProps {
  status?: AdminCandidateDuplicateStatus;
  riskLevel?: AdminCandidateDuplicateRiskLevel;
  search?: string;
  page: number;
  onParamChange: (key: string, value?: string) => void;
  refreshSignal: number;
}

export const AdminDuplicateCasesPanel: React.FC<AdminDuplicateCasesPanelProps> = ({
  status,
  riskLevel,
  search,
  page,
  onParamChange,
  refreshSignal,
}) => {
  const queryClient = useQueryClient();
  const canView = useAuthStore((state) => state.hasPermission('candidate_duplicate.view'));
  const canResolve = useAuthStore((state) => state.hasPermission('candidate_duplicate.resolve'));

  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [reason, setReason] = useState('');

  const params = useMemo(
    () => ({ status: status || undefined, riskLevel: riskLevel || undefined, search, page, pageSize: PAGE_SIZE }),
    [status, riskLevel, search, page]
  );

  const list = useQuery({
    queryKey: ['admin-candidate-duplicate-cases', params, refreshSignal],
    queryFn: () => adminIdentityClaimApi.listDuplicateCases(params),
    enabled: canView,
    placeholderData: (previous) => previous,
  });

  const detail = useQuery({
    queryKey: ['admin-candidate-duplicate-case-detail', selectedCaseId],
    queryFn: () => adminIdentityClaimApi.getDuplicateCase(selectedCaseId!),
    enabled: Boolean(selectedCaseId) && canView,
  });

  const isCaseClosed = detail.data?.status === 'MERGED' || detail.data?.status === 'DISMISSED';

  const preview = useQuery({
    queryKey: ['admin-candidate-duplicate-case-preview', selectedCaseId, detail.data?.concurrencyToken],
    queryFn: () => adminIdentityClaimApi.previewMerge(selectedCaseId!),
    enabled: Boolean(selectedCaseId) && Boolean(detail.data) && !isCaseClosed && canResolve,
    retry: false,
  });

  const resolveMutation = useMutation({
    mutationFn: async (decision: AdminCandidateDuplicateDecision) => {
      if (!selectedCaseId || !detail.data) throw new Error('Thiếu thông tin hồ sơ đối chiếu.');
      const trimmedReason = reason.trim();
      const concurrencyToken = preview.data?.concurrencyToken ?? detail.data.concurrencyToken;
      return adminIdentityClaimApi.resolveDuplicateCase(selectedCaseId, {
        decision,
        reason: trimmedReason,
        concurrencyToken,
        idempotencyKey: `admin-duplicate-${decision.toLowerCase()}:${selectedCaseId}:${concurrencyToken}`,
      });
    },
    onSuccess: async (result, decision) => {
      const finalizedCount = result.finalizationResults?.length ?? 0;
      const actionLabel =
        decision === 'MERGE'
          ? 'Đã hợp nhất hồ sơ ứng viên.'
          : decision === 'DISMISS'
            ? 'Đã xác nhận 2 hồ sơ không phải trùng.'
            : 'Đã chuyển sang trạng thái cần thêm bằng chứng.';
      message.success(
        finalizedCount > 0
          ? `${actionLabel} Đã tự động xử lý ${finalizedCount} lượt nộp đang tạm giữ.`
          : actionLabel
      );
      setReason('');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-candidate-duplicate-cases'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-candidate-duplicate-case-detail', selectedCaseId] }),
        queryClient.invalidateQueries({ queryKey: ['admin-candidate-duplicate-case-preview', selectedCaseId] }),
      ]);
    },
    onError: (err) => {
      message.error(getApiErrorMessage(err));
    },
  });

  const openCase = (caseId: string) => {
    setSelectedCaseId(caseId);
    setReason('');
  };

  const closeDrawer = () => {
    setSelectedCaseId(null);
    setReason('');
  };

  const columns: ColumnsType<AdminCandidateDuplicateListItem> = [
    {
      title: 'Hồ sơ A',
      key: 'candidateA',
      render: (_, item) => (
        <PersonCell name={item.candidateA.fullName} secondary={formatPartyContact(item.candidateA)} />
      ),
    },
    {
      title: 'Hồ sơ B',
      key: 'candidateB',
      render: (_, item) => (
        <PersonCell name={item.candidateB.fullName} secondary={formatPartyContact(item.candidateB)} />
      ),
    },
    {
      title: 'Tin tuyển dụng',
      key: 'job',
      render: (_, item) =>
        item.jobTitle ? (
          <div>
            <div className="font-medium text-slate-800">{item.jobTitle}</div>
            {item.companyName && <div className="text-xs text-slate-500">{item.companyName}</div>}
          </div>
        ) : (
          <span className="text-slate-500">Liên hồ sơ</span>
        ),
    },
    {
      title: 'Mức rủi ro',
      dataIndex: 'riskLevel',
      width: 130,
      render: (value: string) => (
        <StatusDot tone={RISK_META[value]?.tone ?? 'neutral'}>{RISK_META[value]?.label ?? value}</StatusDot>
      ),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      width: 160,
      render: (value: string) => (
        <StatusDot tone={DUPLICATE_STATUS_META[value]?.tone ?? 'neutral'}>
          {DUPLICATE_STATUS_META[value]?.label ?? value}
        </StatusDot>
      ),
    },
    {
      title: 'Phát hiện lúc',
      dataIndex: 'createdAt',
      width: 165,
      render: (value: string) => formatDateTime(value),
    },
  ];

  if (!canView) {
    return <Alert type="error" showIcon message="Bạn không có quyền xem danh sách hồ sơ nghi trùng." />;
  }

  const data = list.data;
  const trimmedReason = reason.trim();
  const isReasonValid = trimmedReason.length >= MIN_REASON_LENGTH;

  return (
    <>
      <div className="flex flex-wrap items-center gap-3 px-5 pb-3 pt-5">
        <Select
          size="large"
          value={status ?? ''}
          options={statusOptions}
          className="w-52"
          onChange={(value) => onParamChange('dupStatus', value || undefined)}
          aria-label="Lọc trạng thái hồ sơ nghi trùng"
        />
        <Select
          size="large"
          value={riskLevel ?? ''}
          options={riskOptions}
          className="w-44"
          onChange={(value) => onParamChange('risk', value || undefined)}
          aria-label="Lọc mức rủi ro"
        />
        <Input
          allowClear
          size="large"
          defaultValue={search}
          prefix={<SearchOutlined className="text-slate-500" aria-hidden />}
          placeholder="Tên ứng viên, job... nhấn Enter"
          className="max-w-xs"
          maxLength={200}
          onPressEnter={(event) => onParamChange('dupQ', event.currentTarget.value.trim() || undefined)}
          onChange={(event) => !event.target.value && search && onParamChange('dupQ', undefined)}
          aria-label="Tìm hồ sơ nghi trùng"
        />
        {data && (
          <span className="ml-auto text-sm text-slate-600 tabular-nums">{data.totalCount} hồ sơ nghi trùng</span>
        )}
      </div>

      {list.isError ? (
        <div className="p-5">
          <Alert
            type="error"
            showIcon
            message="Không tải được danh sách hồ sơ nghi trùng"
            description={getApiErrorMessage(list.error)}
          />
        </div>
      ) : (
        <Table<AdminCandidateDuplicateListItem>
          className="admin-soft-table w-full table-auto"
          rowKey="duplicateCaseId"
          loading={list.isLoading}
          columns={columns}
          dataSource={data?.items ?? []}
          locale={{
            emptyText: 'Không có hồ sơ nghi trùng nào phù hợp bộ lọc.',
          }}
          onRow={(item) => ({
            onClick: () => openCase(item.duplicateCaseId),
            onKeyDown: (event) => {
              if (event.key === 'Enter') openCase(item.duplicateCaseId);
            },
            tabIndex: 0,
            className: 'cursor-pointer',
            'aria-label': `Mở hồ sơ nghi trùng giữa ${item.candidateA.fullName} và ${item.candidateB.fullName}`,
          })}
          pagination={{
            current: data?.page ?? page,
            pageSize: PAGE_SIZE,
            total: data?.totalCount ?? 0,
            showSizeChanger: false,
            hideOnSinglePage: true,
            onChange: (nextPage) => onParamChange('dupPage', String(nextPage)),
          }}
        />
      )}

      <Drawer
        title="Chi tiết hồ sơ nghi trùng"
        open={Boolean(selectedCaseId)}
        onClose={closeDrawer}
        width={760}
        destroyOnClose
      >
        {detail.isLoading ? (
          <Skeleton active paragraph={{ rows: 8 }} />
        ) : detail.isError ? (
          <Alert
            type="error"
            showIcon
            message="Không tải được chi tiết hồ sơ nghi trùng"
            description={getApiErrorMessage(detail.error)}
          />
        ) : detail.data ? (
          <DuplicateCaseDrawerContent
            detail={detail.data}
            preview={preview.data}
            previewLoading={preview.isLoading}
            previewError={preview.isError ? getApiErrorMessage(preview.error) : null}
            canResolve={canResolve}
            isCaseClosed={isCaseClosed}
            reason={reason}
            isReasonValid={isReasonValid}
            submitting={resolveMutation.isPending}
            onReasonChange={setReason}
            onResolve={(decision) => resolveMutation.mutate(decision)}
          />
        ) : null}
      </Drawer>
    </>
  );
};

interface DuplicateCaseDrawerContentProps {
  detail: AdminCandidateDuplicateDetail;
  preview?: {
    recommendedCanonicalCandidateId: string;
    sourceCandidateId: string;
    recommendationReason: string;
    canMerge: boolean;
    collisions: Array<{ jobId: string; jobTitle: string; resolutionRule: string }>;
    financeBlockers: Array<{ payoutId: string; payoutStatus: string; reasonCode: string }>;
  };
  previewLoading: boolean;
  previewError: string | null;
  canResolve: boolean;
  isCaseClosed: boolean;
  reason: string;
  isReasonValid: boolean;
  submitting: boolean;
  onReasonChange: (value: string) => void;
  onResolve: (decision: AdminCandidateDuplicateDecision) => void;
}

const DuplicateCaseDrawerContent: React.FC<DuplicateCaseDrawerContentProps> = ({
  detail,
  preview,
  previewLoading,
  previewError,
  canResolve,
  isCaseClosed,
  reason,
  isReasonValid,
  submitting,
  onReasonChange,
  onResolve,
}) => {
  const canonicalId = detail.canonicalCandidateId ?? preview?.recommendedCanonicalCandidateId ?? null;
  const isMerged = detail.status === 'MERGED';

  const renderPartyCard = (label: string, party: AdminCandidateDuplicateParty) => {
    const isCanonical = canonicalId === party.candidateId;
    return (
      <div
        className={`rounded-lg border p-4 ${
          isCanonical ? 'border-emerald-200 bg-emerald-50/40' : 'border-slate-200 bg-slate-50/70'
        }`}
      >
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</span>
          <Space size={4} wrap>
            {party.hasAccount ? <Tag color="blue">Có tài khoản</Tag> : <Tag>Chưa có tài khoản</Tag>}
            {isCanonical && <Tag color="green">Hồ sơ gốc (giữ lại)</Tag>}
            {isMerged && !isCanonical && <Tag>Đã gộp vào hồ sơ gốc</Tag>}
          </Space>
        </div>
        <div className="text-base font-semibold text-slate-900">{party.fullName}</div>
        <div className="mt-1 space-y-0.5 text-sm text-slate-600">
          <div>Email: {party.maskedEmail ?? '—'}</div>
          <div>SĐT: {party.maskedPhone ?? '—'}</div>
          <div>Tạo lúc: {formatDateTime(party.createdAt)}</div>
        </div>
      </div>
    );
  };

  const submissionColumns: ColumnsType<AdminCandidateDuplicateSubmission> = [
    {
      title: 'Hồ sơ',
      key: 'party',
      width: 90,
      render: (_, sub) => (
        <span className="font-medium text-slate-800">
          {sub.candidateId === detail.candidateA.candidateId ? 'Hồ sơ A' : 'Hồ sơ B'}
        </span>
      ),
    },
    {
      title: 'Nguồn nộp',
      key: 'source',
      width: 145,
      render: (_, sub) => (
        <div>
          <div className="text-sm text-slate-800">{SOURCE_LABELS[sub.source] ?? sub.source}</div>
          <div className="text-xs text-slate-500">{formatDateTime(sub.submittedAt)}</div>
        </div>
      ),
    },
    {
      title: 'Trạng thái đơn',
      dataIndex: 'status',
      width: 135,
      render: (value: string) => {
        const meta = SUBMISSION_STATUS_LABELS[value];
        return <Tag color={meta?.color ?? 'default'}>{meta?.label ?? value}</Tag>;
      },
    },
    {
      title: 'Xác nhận ứng viên',
      key: 'consent',
      width: 145,
      render: (_, sub) =>
        sub.consentStatus ? (
          <div>
            <div className="text-sm text-slate-800">
              {CONSENT_STATUS_LABELS[sub.consentStatus] ?? sub.consentStatus}
            </div>
            {sub.consentRespondedAt && (
              <div className="text-xs text-slate-500">{formatDateTime(sub.consentRespondedAt)}</div>
            )}
          </div>
        ) : (
          <span className="text-slate-400">Không yêu cầu</span>
        ),
    },
    {
      title: 'Quyền hoa hồng',
      key: 'attribution',
      render: (_, sub) => {
        const attrLabel = sub.attributionStatus
          ? ATTRIBUTION_LABELS[sub.attributionStatus] ?? sub.attributionStatus
          : 'Chưa ghi nhận';
        const commLabels = sub.commissionStatuses.map((status) => COMMISSION_LABELS[status] ?? status);
        return (
          <div className="space-y-0.5 text-xs">
            <div className="font-medium text-slate-800">{attrLabel}</div>
            {commLabels.length > 0 && <div className="text-slate-500">{commLabels.join(' · ')}</div>}
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <StatusDot tone={DUPLICATE_STATUS_META[detail.status]?.tone ?? 'neutral'}>
          {DUPLICATE_STATUS_META[detail.status]?.label ?? detail.status}
        </StatusDot>
        <StatusDot tone={RISK_META[detail.riskLevel]?.tone ?? 'neutral'}>
          {RISK_META[detail.riskLevel]?.label ?? detail.riskLevel}
        </StatusDot>
        {detail.job && (
          <span className="text-sm text-slate-600">
            Vị trí: <strong className="text-slate-900">{detail.job.title}</strong> ({detail.job.companyName})
          </span>
        )}
      </div>

      {detail.resolution && (
        <Alert
          type={isMerged ? 'success' : 'info'}
          showIcon
          message={RESOLUTION_LABELS[detail.resolution] ?? `Kết quả xử lý: ${detail.resolution}`}
          description={detail.resolutionReason ? `Lý do: ${detail.resolutionReason}` : undefined}
        />
      )}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {renderPartyCard('Hồ sơ A', detail.candidateA)}
        {renderPartyCard('Hồ sơ B', detail.candidateB)}
      </div>

      <div>
        <h4 className="mb-2 text-sm font-semibold text-slate-900">Tín hiệu phát hiện trùng ({detail.signals.length})</h4>
        <div className="space-y-2">
          {detail.signals.map((signal, index) => {
            const readableEvidence = formatSignalEvidence(signal.reasonCode, signal.evidence);
            return (
              <div key={`${signal.reasonCode}-${index}`} className="rounded-lg border border-slate-200 p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-slate-900">
                    {SIGNAL_LABELS[signal.reasonCode] ?? signal.reasonCode}
                  </span>
                  <Tag color={signal.score >= 0.9 ? 'red' : 'orange'}>
                    Độ tin cậy: {Math.round(signal.score * 100)}%
                  </Tag>
                </div>
                {readableEvidence && <div className="mt-1 text-xs text-slate-600">{readableEvidence}</div>}
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <h4 className="mb-2 text-sm font-semibold text-slate-900">
          Lượt nộp liên quan ({detail.submissions.length})
        </h4>
        {detail.submissions.length === 0 ? (
          <div className="text-sm text-slate-500">Chưa có lượt nộp nào gắn với cặp hồ sơ này.</div>
        ) : (
          <Table<AdminCandidateDuplicateSubmission>
            size="small"
            rowKey="submissionId"
            columns={submissionColumns}
            dataSource={detail.submissions}
            pagination={false}
            scroll={{ x: 640 }}
            className="rounded-lg border border-slate-200"
          />
        )}
      </div>

      {!isCaseClosed && canResolve && (
        <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <h4 className="text-sm font-semibold text-slate-900">Xem trước hợp nhất &amp; Quyết định</h4>

          {previewLoading ? (
            <Skeleton active paragraph={{ rows: 2 }} />
          ) : previewError ? (
            <Alert type="warning" showIcon message="Chưa tải được bản xem trước hợp nhất" description={previewError} />
          ) : preview ? (
            <div className="space-y-2 text-sm">
              <div className="text-slate-700">
                <strong>Đề xuất:</strong> {preview.recommendationReason}
              </div>
              {preview.collisions.length > 0 && (
                <Alert
                  type="info"
                  showIcon
                  message={`Phát hiện ${preview.collisions.length} lượt nộp trùng vào cùng công việc`}
                  description="Khi hợp nhất, hệ thống giữ lại đơn của CTV được ứng viên xác nhận sớm nhất và tự động chặn trùng các đơn nộp sau."
                />
              )}
              {preview.financeBlockers.length > 0 && (
                <Alert
                  type="error"
                  showIcon
                  message="Bị chặn hợp nhất do đã có chi trả hoa hồng hoàn tất"
                  description={preview.financeBlockers.map((b) => `${b.reasonCode} (${b.payoutStatus})`).join(', ')}
                />
              )}
            </div>
          ) : null}

          <div>
            <label htmlFor="duplicate-resolve-reason" className="mb-1 block text-xs font-medium text-slate-700">
              Lý do xử lý (bắt buộc tối thiểu {MIN_REASON_LENGTH} ký tự)
            </label>
            <Input.TextArea
              id="duplicate-resolve-reason"
              rows={3}
              maxLength={1000}
              showCount
              value={reason}
              onChange={(event) => onReasonChange(event.target.value)}
              placeholder="Ví dụ: Đã đối chiếu file CV SHA-256 và thông tin ứng viên, xác nhận cùng một người và hợp nhất về hồ sơ gốc..."
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button
              type="primary"
              loading={submitting}
              disabled={!isReasonValid || Boolean(preview && !preview.canMerge)}
              onClick={() => onResolve('MERGE')}
            >
              Hợp nhất về hồ sơ gốc
            </Button>
            <Button loading={submitting} disabled={!isReasonValid} onClick={() => onResolve('DISMISS')}>
              Không phải trùng
            </Button>
            <Button loading={submitting} disabled={!isReasonValid} onClick={() => onResolve('NEED_MORE_EVIDENCE')}>
              Cần thêm bằng chứng
            </Button>
          </div>
          <p className="mb-0 text-xs text-slate-500">
            Hợp nhất sẽ gộp mềm về Hồ sơ gốc (giữ lại toàn bộ lịch sử đối soát), giữ quyền hoa hồng cho lượt được ứng
            viên xác nhận sớm nhất và chặn trùng các lượt nộp sau vào cùng công việc.
          </p>
        </div>
      )}
    </div>
  );
};
