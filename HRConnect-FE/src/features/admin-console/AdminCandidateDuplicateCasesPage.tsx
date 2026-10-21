import React, { useMemo, useState } from 'react';
import {
  Alert,
  App as AntApp,
  Button,
  Descriptions,
  Empty,
  Form,
  Input,
  Modal,
  Radio,
  Select,
  Skeleton,
  Table,
  Tag,
} from 'antd';
import { ArrowLeftOutlined, EyeOutlined, MergeCellsOutlined, ReloadOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import { candidateDuplicateApi } from '@/services/api/mf02/candidateDuplicateApi';
import { getApiError, getApiErrorMessage } from '@/services/apiClient';
import { useAuthStore } from '@/stores/authStore';
import type {
  AdminCandidateDuplicateCaseListItem,
  CandidateDuplicateDecision,
  CandidateDuplicateMergePreview,
} from '@/types/api/mf02/candidateDuplicate';
import { FilterPills, PageHero, PersonCell, StatusDot, Surface, type Tone } from './ui';
import { submissionStatus } from '@/features/portal/mf02Labels';

const fmt = (value?: string | null) => value ? dayjs(value).format('HH:mm DD/MM/YYYY') : '—';
const newIdempotencyKey = () => globalThis.crypto?.randomUUID?.() ?? `duplicate-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const STATUS: Record<string, { label: string; tone: Tone }> = {
  OPEN: { label: 'Mới phát hiện', tone: 'info' },
  AWAITING_CANDIDATE: { label: 'Chờ Candidate xác minh', tone: 'warning' },
  UNDER_REVIEW: { label: 'Chờ Admin đối chiếu', tone: 'warning' },
  BLOCKED_FINANCE: { label: 'Bị chặn bởi tài chính', tone: 'danger' },
  MERGED: { label: 'Đã hợp nhất', tone: 'success' },
  DISMISSED: { label: 'Đã xác nhận không trùng', tone: 'neutral' },
};

const SIGNAL: Record<string, string> = {
  VERIFIED_EMAIL_OWNERSHIP: 'Candidate đã chứng minh quyền sở hữu email',
  EXACT_CV_AND_NORMALIZED_NAME: 'CV và tên chuẩn hóa trùng khớp',
};

const DECISION: Record<CandidateDuplicateDecision, string> = {
  MERGE: 'Hợp nhất hai hồ sơ',
  DISMISS: 'Xác nhận không phải cùng người',
  NEED_MORE_EVIDENCE: 'Yêu cầu đối chiếu thêm',
};

const statusMeta = (status: string) => STATUS[status] ?? { label: status, tone: 'neutral' as Tone };
export const adminCandidateDuplicateKeys = {
  all: ['admin-candidate-duplicate-cases'] as const,
  list: (status: string, risk: string, search: string, page: number) => ['admin-candidate-duplicate-cases', 'list', status, risk, search, page] as const,
  detail: (caseId: string) => ['admin-candidate-duplicate-cases', 'detail', caseId] as const,
  preview: (caseId: string) => ['admin-candidate-duplicate-cases', 'preview', caseId] as const,
};

export const AdminCandidateDuplicateCasesPage: React.FC = () => {
  const navigate = useNavigate();
  const canView = useAuthStore((state) => state.hasPermission('candidate_duplicate.view'));
  const [status, setStatus] = useState('ALL');
  const [risk, setRisk] = useState('ALL');
  const [searchText, setSearchText] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: adminCandidateDuplicateKeys.list(status, risk, search, page),
    queryFn: () => candidateDuplicateApi.listAdmin({
      status: status === 'ALL' ? undefined : status,
      riskLevel: risk === 'ALL' ? undefined : risk,
      search: search || undefined,
      page,
      pageSize: 20,
    }),
    enabled: canView,
  });

  const rows = useMemo(() => query.data?.items ?? [], [query.data?.items]);

  const columns: ColumnsType<AdminCandidateDuplicateCaseListItem> = [
    {
      title: 'Hai hồ sơ cần đối chiếu',
      key: 'candidates',
      render: (_, item) => (
        <div className="space-y-2">
          <PersonCell name={item.candidateA.fullName} secondary={[item.candidateA.maskedEmail, item.candidateA.maskedPhone].filter(Boolean).join(' · ')} size={32} />
          <PersonCell name={item.candidateB.fullName} secondary={[item.candidateB.maskedEmail, item.candidateB.maskedPhone].filter(Boolean).join(' · ')} size={32} />
        </div>
      ),
    },
    { title: 'Công việc', key: 'job', render: (_, item) => <div><div className="font-medium text-slate-800">{item.jobTitle ?? 'Đối chiếu toàn hồ sơ'}</div><div className="text-xs text-slate-500">{item.companyName ?? 'Không gắn với một doanh nghiệp cụ thể'}</div></div> },
    { title: 'Mức cảnh báo', dataIndex: 'riskLevel', width: 130, render: (value: string) => <Tag color={value === 'HIGH' ? 'red' : 'orange'}>{value === 'HIGH' ? 'Cao' : 'Cần xem'}</Tag> },
    { title: 'Trạng thái', dataIndex: 'status', width: 190, render: (value: string) => { const meta = statusMeta(value); return <StatusDot tone={meta.tone}>{meta.label}</StatusDot>; } },
    { title: 'Cập nhật', dataIndex: 'updatedAt', width: 150, render: (value: string) => <span className="text-xs text-slate-500">{fmt(value)}</span> },
    { title: '', key: 'action', width: 100, render: (_, item) => <Button icon={<EyeOutlined />} onClick={() => navigate(`/admin/candidate-duplicate-cases/${item.duplicateCaseId}`)}>Mở</Button> },
  ];

  if (!canView) return <Alert type="error" showIcon message="Bạn không có quyền xem hàng đợi đối chiếu Candidate." />;

  return (
    <div>
      <PageHero eyebrow="MF02 · Danh tính Candidate" title="Hồ sơ nghi trùng" description="Đối chiếu bằng chứng đã giảm dữ liệu cá nhân, xem trước tác động rồi mới hợp nhất hồ sơ." />
      <Surface>
        <div className="flex flex-wrap items-end justify-between gap-4 border-0 border-b border-solid border-slate-100 p-5">
          <div className="space-y-3">
            <FilterPills label="Trạng thái" value={status} onChange={(value) => { setStatus(value); setPage(1); }} options={[
              { value: 'ALL', label: 'Tất cả' }, { value: 'OPEN', label: 'Mới phát hiện' }, { value: 'AWAITING_CANDIDATE', label: 'Chờ Candidate' }, { value: 'UNDER_REVIEW', label: 'Đang đối chiếu' }, { value: 'BLOCKED_FINANCE', label: 'Vướng tài chính' }, { value: 'MERGED', label: 'Đã hợp nhất' }, { value: 'DISMISSED', label: 'Không trùng' },
            ]} />
            <Select value={risk} className="w-44" onChange={(value) => { setRisk(value); setPage(1); }} options={[{ value: 'ALL', label: 'Mọi mức cảnh báo' }, { value: 'HIGH', label: 'Cảnh báo cao' }, { value: 'REVIEW', label: 'Cần xem' }]} />
          </div>
          <Input.Search value={searchText} onChange={(event) => setSearchText(event.target.value)} onSearch={(value) => { setSearch(value.trim()); setPage(1); }} allowClear placeholder="Tìm Candidate, job, công ty" className="max-w-sm" />
        </div>
        <Table rowKey="duplicateCaseId" className="admin-soft-table" columns={columns} dataSource={rows} loading={query.isFetching} pagination={{ current: page, pageSize: 20, total: query.data?.totalCount ?? 0, showSizeChanger: false, onChange: setPage }} locale={{ emptyText: <Empty description="Không có hồ sơ phù hợp bộ lọc." /> }} />
      </Surface>
    </div>
  );
};

type ResolutionForm = { decision: CandidateDuplicateDecision; reason: string };

export const AdminCandidateDuplicateCaseDetailPage: React.FC = () => {
  const { caseId = '' } = useParams<{ caseId: string }>();
  const navigate = useNavigate();
  const { message } = AntApp.useApp();
  const queryClient = useQueryClient();
  const canView = useAuthStore((state) => state.hasPermission('candidate_duplicate.view'));
  const canResolve = useAuthStore((state) => state.hasPermission('candidate_duplicate.resolve'));
  const [preview, setPreview] = useState<CandidateDuplicateMergePreview | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState('');
  const [form] = Form.useForm<ResolutionForm>();

  const detail = useQuery({ queryKey: adminCandidateDuplicateKeys.detail(caseId), queryFn: () => candidateDuplicateApi.getAdmin(caseId), enabled: canView && Boolean(caseId) });
  const previewMutation = useMutation({
    mutationFn: () => candidateDuplicateApi.previewMerge(caseId),
    onSuccess: (value) => { setPreview(value); queryClient.setQueryData(adminCandidateDuplicateKeys.preview(caseId), value); message.success('Đã kiểm tra tác động hợp nhất.'); },
    onError: (error) => message.error(getApiErrorMessage(error, 'Không thể xem trước tác động hợp nhất.')),
  });
  const resolveMutation = useMutation({
    mutationFn: (values: ResolutionForm) => candidateDuplicateApi.resolve(caseId, {
      ...values,
      concurrencyToken: values.decision === 'MERGE' && preview ? preview.concurrencyToken : detail.data!.concurrencyToken,
      idempotencyKey,
    }),
    onSuccess: async (result) => {
      message.success(result.idempotentReplay ? 'Yêu cầu này đã được xử lý trước đó.' : 'Đã cập nhật kết quả đối chiếu.');
      setModalOpen(false); setPreview(null); setIdempotencyKey(''); form.resetFields();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: adminCandidateDuplicateKeys.all }),
        queryClient.invalidateQueries({ queryKey: ['admin-disputes'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-commissions'] }),
      ]);
    },
    onError: async (error) => {
      const apiError = getApiError(error, 'Không thể xử lý hồ sơ đối chiếu.');
      message.error(apiError.message);
      if (['STALE_DUPLICATE_CASE', 'DUPLICATE_CASE_CLOSED', 'CANDIDATE_IDENTITY_CHANGED'].includes(apiError.code ?? '')) {
        setPreview(null);
        await detail.refetch();
      }
    },
  });

  const openResolution = (decision: CandidateDuplicateDecision) => {
    if (decision === 'MERGE' && !preview) return message.warning('Hãy xem trước tác động trước khi hợp nhất.');
    form.setFieldsValue({ decision, reason: '' });
    setIdempotencyKey(newIdempotencyKey());
    setModalOpen(true);
  };

  if (!canView) return <Alert type="error" showIcon message="Bạn không có quyền xem hồ sơ đối chiếu." />;
  if (detail.isLoading) return <Skeleton active paragraph={{ rows: 10 }} />;
  if (detail.isError || !detail.data) return <Alert type="error" showIcon message="Không tải được hồ sơ đối chiếu" description={getApiErrorMessage(detail.error)} action={<Button onClick={() => navigate('/admin/candidate-duplicate-cases')}>Về danh sách</Button>} />;

  const item = detail.data;
  const meta = statusMeta(item.status);
  const closed = ['MERGED', 'DISMISSED'].includes(item.status);
  return (
    <div>
      <PageHero eyebrow="Chi tiết hồ sơ nghi trùng" title={`${item.candidateA.fullName} ↔ ${item.candidateB.fullName}`} description={item.job ? `${item.job.title} · ${item.job.companyName}` : 'Đối chiếu danh tính trên toàn bộ hồ sơ'} actions={<Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/admin/candidate-duplicate-cases')}>Danh sách</Button>} />

      <div className="space-y-5">
        <Surface padded>
          <div className="flex flex-wrap items-center justify-between gap-3"><StatusDot tone={meta.tone}>{meta.label}</StatusDot><Tag color={item.riskLevel === 'HIGH' ? 'red' : 'orange'}>{item.riskLevel === 'HIGH' ? 'Cảnh báo cao' : 'Cần xem'}</Tag></div>
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            {[item.candidateA, item.candidateB].map((candidate, index) => (
              <div key={candidate.candidateId} className="rounded-2xl border border-solid border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Hồ sơ {index === 0 ? 'A' : 'B'}</div>
                <div className="mt-1 text-lg font-bold text-slate-900">{candidate.fullName}</div>
                <div className="mt-2 space-y-1 text-sm text-slate-600"><div>{candidate.maskedEmail ?? 'Không có email'}</div><div>{candidate.maskedPhone ?? 'Không có số điện thoại'}</div><div>{candidate.hasAccount ? 'Đã có tài khoản' : 'Chưa có tài khoản'}</div></div>
              </div>
            ))}
          </div>
        </Surface>

        <Surface padded>
          <h2 className="m-0 text-base font-bold text-slate-900">Bằng chứng đối chiếu</h2>
          <div className="mt-4 space-y-3">{item.signals.length ? item.signals.map((signal) => <div key={`${signal.reasonCode}-${signal.createdAt}`} className="rounded-xl border border-solid border-slate-200 p-4"><div className="flex flex-wrap justify-between gap-2"><strong>{SIGNAL[signal.reasonCode] ?? 'Tín hiệu cần kiểm tra'}</strong><Tag color={signal.score >= 0.9 ? 'red' : 'orange'}>{Math.round(signal.score * 100)}%</Tag></div><p className="mb-0 mt-2 text-sm text-slate-600">{signal.evidence}</p></div>) : <Empty description="Chưa có tín hiệu chi tiết." />}</div>
        </Surface>

        <Surface padded>
          <h2 className="m-0 text-base font-bold text-slate-900">Lượt giới thiệu và quyền lợi liên quan</h2>
          <Table className="admin-soft-table mt-4" rowKey="submissionId" size="small" pagination={false} dataSource={item.submissions} columns={[
            { title: 'Thời điểm nộp', dataIndex: 'submittedAt', render: (value: string) => fmt(value) },
            { title: 'Nguồn', dataIndex: 'source', render: (value: string) => value === 'AFFILIATE' ? 'Affiliate giới thiệu' : value === 'CANDIDATE' ? 'Candidate tự ứng tuyển' : 'Nguồn khác' },
            { title: 'Trạng thái', dataIndex: 'status', render: (value: string) => <Tag>{submissionStatus(value).label}</Tag> },
            { title: 'Candidate xác nhận', dataIndex: 'consentRespondedAt', render: (value: string | null) => fmt(value) },
            { title: 'Hoa hồng', dataIndex: 'commissionStatuses', render: (values: string[]) => values.length ? values.map((value) => <Tag key={value}>{value === 'PAID' ? 'Đã chi' : value === 'PENDING' ? 'Chờ chi' : value === 'CANCELLED' ? 'Đã hủy' : 'Đang xử lý'}</Tag>) : '—' },
          ]} />
        </Surface>

        {canResolve && !closed && (
          <Surface padded>
            <div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="m-0 text-base font-bold text-slate-900">Quyết định của Admin</h2><p className="m-0 mt-1 text-sm text-slate-600">Luôn xem trước tác động trước khi hợp nhất. Hệ thống sẽ chặn nếu có khoản đã chi.</p></div><Button icon={<ReloadOutlined />} loading={previewMutation.isPending} onClick={() => previewMutation.mutate()}>Xem trước hợp nhất</Button></div>
            {preview && <Alert className="mt-4" type={preview.canMerge ? 'success' : 'error'} showIcon message={preview.canMerge ? 'Có thể hợp nhất an toàn theo dữ liệu hiện tại' : 'Chưa thể hợp nhất vì có khoản đã chi'} description={<div className="mt-2 space-y-1"><div>Hồ sơ chính đề xuất: <b>{preview.recommendedCanonicalCandidateId}</b></div><div>{preview.collisions.length} công việc có dữ liệu trùng; {preview.financeBlockers.length} trở ngại tài chính.</div></div>} />}
            <div className="mt-4 flex flex-wrap gap-2"><Button type="primary" icon={<MergeCellsOutlined />} disabled={!preview?.canMerge} onClick={() => openResolution('MERGE')}>Hợp nhất hồ sơ</Button><Button onClick={() => openResolution('DISMISS')}>Xác nhận không trùng</Button><Button onClick={() => openResolution('NEED_MORE_EVIDENCE')}>Cần thêm bằng chứng</Button></div>
          </Surface>
        )}

        {item.resolutionReason && <Alert type="info" showIcon icon={<SafetyCertificateOutlined />} message="Kết quả xử lý" description={item.resolutionReason} />}
      </div>

      <Modal open={modalOpen} title="Xác nhận quyết định đối chiếu" okText="Xác nhận xử lý" cancelText="Hủy" confirmLoading={resolveMutation.isPending} onCancel={() => !resolveMutation.isPending && setModalOpen(false)} onOk={() => form.submit()} destroyOnClose>
        <Form form={form} layout="vertical" onFinish={(values) => resolveMutation.mutate(values)}>
          <Form.Item name="decision" label="Quyết định" rules={[{ required: true }]}><Radio.Group options={(Object.keys(DECISION) as CandidateDuplicateDecision[]).map((value) => ({ value, label: DECISION[value] }))} /></Form.Item>
          <Form.Item name="reason" label="Căn cứ xử lý" rules={[{ required: true, whitespace: true, min: 10, message: 'Nhập ít nhất 10 ký tự để lưu căn cứ kiểm toán.' }]}><Input.TextArea rows={4} maxLength={1000} showCount placeholder="Nêu bằng chứng đã đối chiếu và lý do đưa ra quyết định..." /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default AdminCandidateDuplicateCasesPage;
