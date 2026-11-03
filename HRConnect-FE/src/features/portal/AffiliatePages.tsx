/**
 * @file AffiliatePages.tsx
 * @description MF-02 branch B for the Affiliate: overview (profile + performance), refer a candidate
 * (new candidate with a PDF, or one from the library with an existing CV), submission history with
 * consent status and resend, candidate library and attributions. Commission/payout (MF-05) has no
 * API yet and shows an empty state.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  App as AntApp,
  Button,
  DatePicker,
  Drawer,
  Form,
  Input,
  Pagination,
  Radio,
  Result,
  Segmented,
  Select,
  Skeleton,
  Table,
  Tooltip,
  Upload,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  EyeOutlined,
  FilePdfOutlined,
  InboxOutlined,
  MailOutlined,
  ReloadOutlined,
  SearchOutlined,
  SendOutlined,
  UserAddOutlined,
  ArrowLeftOutlined,
  BankOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CalendarOutlined,
  EnvironmentOutlined,
  RightOutlined,
  TeamOutlined,
  TrophyOutlined,
  CloseCircleOutlined,
  ExclamationCircleOutlined,
  FileDoneOutlined,
  IdcardOutlined,
  SafetyCertificateOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { UploadCloud } from 'lucide-react';
import dayjs from 'dayjs';
import relativeTimePlugin from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/vi';
import { affiliateApi } from '@/services/api/mf02Api';
import { jobsApi } from '@/services/api/jobsApi';
import { financeApi } from '@/services/api/financeApi';
import { CommissionEstimateCard, commissionEstimateApi, formatEstimate } from './CommissionEstimateCard';
import { getApiError, getApiErrorMessage } from '@/services/apiClient';
import { useAuthStore } from '@/stores/authStore';
import type { AffiliateAttribution, AffiliateSubmission, LibraryCandidate } from '@/types/api/mf02';
import { FilterPills, Initials, PersonCell, StatusDot, Surface } from '@/features/admin-console/ui';
import { ATTRIBUTION_STATUS, MAX_CV_MB, cvFileError, fileSize, submissionStatus } from './mf02Labels';
import { useOpenSignedUrl } from './CandidatePages';
import {
  AffiliatePageHeader,
  AffiliateSectionHeading,
  AffiliateStatCard,
} from './affiliate/AffiliateUi';
import { isValidVietnamPhoneNumber, VIETNAM_PHONE_VALIDATION_MESSAGE } from '@/constants/phoneValidation';

dayjs.extend(relativeTimePlugin);
dayjs.locale('vi');

const keys = {
  profile: ['aff-profile'] as const,
  performance: ['aff-performance'] as const,
  submissions: ['aff-submissions'] as const,
  library: ['aff-library'] as const,
};

const vnd = (v: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(v);

const SERVICE_LABEL: Record<string, string> = {
  HEADHUNT_COD: 'Tuyển qua Affiliate',
  CV_SOURCING: 'Mua CV',
  CV_APPLICATION: 'Đăng tin',
};
const serviceLabel = (code?: string | null) => (code ? SERVICE_LABEL[code] ?? code : '—');

const fmt = (v?: string | null) => (v ? dayjs(v).format('HH:mm DD/MM/YYYY') : '—');

// ─── Overview ───────────────────────────────────────────────────────────────

export const AffiliateHomePage: React.FC = () => {
  const navigate = useNavigate();
  const profile = useQuery({ queryKey: keys.profile, queryFn: () => affiliateApi.profile() });
  const perf = useQuery({ queryKey: keys.performance, queryFn: () => affiliateApi.performance() });
  const pending = useQuery({
    queryKey: [...keys.submissions, 'count', 'PENDING_CONSENT'],
    queryFn: async () => (await affiliateApi.submissions({ status: 'PENDING_CONSENT', page: 1, pageSize: 1 })).totalCount,
  });
  const recent = useQuery({
    queryKey: [...keys.submissions, 'recent'],
    queryFn: async () => (await affiliateApi.submissions({ page: 1, pageSize: 5 })).items,
  });
  // One page of up to 100 (the API maximum) is enough for the money totals on this page.
  const commissions = useQuery({
    queryKey: ['mf05-my-commissions'],
    queryFn: () => financeApi.commissions({ page: 1, pageSize: 100 }),
  });
  const opportunities = useQuery({
    queryKey: ['aff-jobs', 'dashboard'],
    queryFn: async () => (await jobsApi.search({ page: 1, pageSize: 5 })).items,
  });
  const estimates = useQueries({
    queries: (opportunities.data ?? []).map((job) => ({
      queryKey: ['affiliate-commission-estimate', job.jobId],
      queryFn: () => commissionEstimateApi.get(job.jobId),
      staleTime: 5 * 60_000,
    })),
  });
  const verified = profile.data?.status === 'ACTIVE' || Boolean(profile.data?.verifiedAt);
  const p = perf.data;
  const items = commissions.data?.items ?? [];
  const sum = (statuses: string[]) => items.filter((c) => statuses.includes(c.status)).reduce((t, c) => t + c.amount, 0);
  const loading = (q: { isLoading: boolean }, v: React.ReactNode) => (q.isLoading ? <Skeleton.Input active size="small" /> : v);

  const kpis = [
    { label: 'Lượt giới thiệu', value: loading(perf, p?.totalSubmissions ?? 0), note: pending.data ? `${pending.data} đang chờ ứng viên xác nhận` : 'Tổng hồ sơ bạn đã gửi', money: false },
    { label: 'Ứng viên đi làm', value: loading(perf, p?.totalPlacements ?? 0), note: `Tỉ lệ giới thiệu → đi làm ${Math.round((p?.submissionToHireRate ?? 0) * 100)}%`, money: false },
    { label: 'Hoa hồng đang chờ', value: loading(commissions, vnd(sum(['IN_WARRANTY', 'EARNED', 'PAYABLE']))), note: 'Trong bảo hành, đủ điều kiện hoặc chờ chi', money: true },
    { label: 'Đã nhận', value: loading(commissions, vnd(sum(['PAID']))), note: 'Tổng hoa hồng đã chi', money: true, paid: true },
  ];

  const stages = [
    { label: 'Chờ xác nhận', n: pending.data ?? 0 },
    { label: 'Được chọn', n: p?.totalShortlisted ?? 0 },
    { label: 'Phỏng vấn', n: p?.totalInterviews ?? 0 },
    { label: 'Đi làm', n: p?.totalPlacements ?? 0 },
  ];

  const todos = (recent.data ?? []).slice(0, 4);

  return (
    <div className="affiliate-dashboard space-y-5">
      {profile.data && !verified && (
        <Alert
          type="warning"
          showIcon
          message="Hồ sơ Affiliate đang chờ duyệt"
          description="Bạn có thể xem việc làm ngay. Chức năng giới thiệu ứng viên mở sau khi HR Connect duyệt hồ sơ."
        />
      )}

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {kpis.map((k) => (
          <section key={k.label} className="rounded-lg border border-solid border-gray-200 bg-white p-4">
            <div className="text-[13px] text-gray-600">{k.label}</div>
            <div className={`mt-1 text-2xl font-bold tabular-nums ${k.paid ? 'text-green-800' : k.money ? 'text-[color:var(--affiliate-cta)]' : 'text-gray-900'}`}>{k.value}</div>
            <div className="mt-0.5 text-xs text-gray-500">{k.note}</div>
          </section>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <section aria-labelledby="aff-todo" className="rounded-lg border border-solid border-gray-200 bg-white">
          <div className="flex items-baseline justify-between border-0 border-b border-solid border-slate-100 px-4 py-3.5">
            <h2 id="aff-todo" className="m-0 text-[15px] font-bold text-gray-900">Lượt giới thiệu gần đây</h2>
            <Button type="link" className="!h-auto !px-0 !text-[13px] !font-semibold" onClick={() => navigate('/affiliate/submissions')}>Xem tất cả</Button>
          </div>
          {recent.isLoading ? (
            <div className="p-4"><Skeleton active paragraph={{ rows: 3 }} /></div>
          ) : todos.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <div className="font-semibold text-gray-900">Bạn chưa giới thiệu ứng viên nào</div>
              <p className="m-0 mt-1 text-sm text-gray-600">Chọn một job đang mở và gửi ứng viên phù hợp.</p>
              <Button className="affiliate-cta mt-3" type="primary" onClick={() => navigate('/affiliate/jobs')}>Xem việc làm</Button>
            </div>
          ) : (
            <ul className="m-0 list-none p-0">
              {todos.map((s) => {
                const st = submissionStatus(s.status);
                return (
                  <li key={s.submissionId} className="flex items-center gap-3 border-0 border-b border-solid border-slate-100 px-4 py-3 last:border-b-0">
                    <StatusDot tone={st.tone}><span className="sr-only">{st.label}</span></StatusDot>
                    <button
                      type="button"
                      className="min-w-0 flex-1 cursor-pointer border-0 bg-transparent p-0 text-left"
                      onClick={() => navigate(`/affiliate/submissions/${s.submissionId}`)}
                    >
                      <span className="block truncate font-semibold text-gray-900">{s.candidateName}</span>
                      <span className="block truncate text-[13px] text-gray-600">{s.jobTitle}</span>
                    </button>
                    <span className="shrink-0 text-right">
                      <span className="block text-[13px] text-gray-800">{st.label}</span>
                      <span className="block text-xs text-gray-500">{dayjs(s.submittedAt).fromNow()}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section aria-labelledby="aff-pipe" className="rounded-lg border border-solid border-gray-200 bg-white">
          <div className="flex items-baseline justify-between border-0 border-b border-solid border-slate-100 px-4 py-3.5">
            <h2 id="aff-pipe" className="m-0 text-[15px] font-bold text-gray-900">Ứng viên bạn giới thiệu đang ở đâu</h2>
            <Button type="link" className="!h-auto !px-0 !text-[13px] !font-semibold" onClick={() => navigate('/affiliate/performance')}>Hiệu suất</Button>
          </div>
          <div className="grid grid-cols-4 gap-2 p-4 text-center">
            {stages.map((s) => (
              <div key={s.label} className="rounded-md bg-slate-50 px-1 py-3">
                <div className="text-xl font-bold tabular-nums text-[color:var(--affiliate-brand)]">{perf.isLoading ? '…' : s.n}</div>
                <div className="text-xs text-gray-600">{s.label}</div>
              </div>
            ))}
          </div>
          {pending.data ? (
            <div className="mx-4 mb-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-solid border-orange-200 bg-orange-50 px-3 py-2.5">
              <span className="text-[13px] text-orange-900">{pending.data} lượt đang chờ ứng viên xác nhận qua email.</span>
              <Button size="small" onClick={() => navigate('/affiliate/submissions?status=PENDING_CONSENT')}>Nhắc xác nhận</Button>
            </div>
          ) : null}
        </section>
      </div>

      <section aria-labelledby="aff-jobs" className="rounded-lg border border-solid border-gray-200 bg-white">
        <div className="flex items-baseline justify-between border-0 border-b border-solid border-slate-100 px-4 py-3.5">
          <h2 id="aff-jobs" className="m-0 text-[15px] font-bold text-gray-900">Việc làm mới mở cho Affiliate</h2>
          <Button type="link" className="!h-auto !px-0 !text-[13px] !font-semibold" onClick={() => navigate('/affiliate/jobs')}>Xem tất cả</Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse">
            <thead>
              <tr className="text-left text-xs text-gray-500">
                <th className="px-4 py-2.5 font-medium">Vị trí</th>
                <th className="px-4 py-2.5 font-medium">Dịch vụ</th>
                <th className="px-4 py-2.5 font-medium">Hoa hồng ước tính</th>
                <th className="px-4 py-2.5 font-medium">Hạn nhận hồ sơ</th>
                <th className="px-4 py-2.5"><span className="sr-only">Thao tác</span></th>
              </tr>
            </thead>
            <tbody>
              {(opportunities.data ?? []).map((job, i) => {
                const est = estimates[i]?.data;
                return (
                  <tr key={job.jobId} className="border-0 border-t border-solid border-slate-100">
                    <td className="px-4 py-3">
                      <button type="button" className="cursor-pointer border-0 bg-transparent p-0 text-left font-semibold text-gray-900 hover:text-sky-800" onClick={() => navigate(`/affiliate/jobs/${job.jobId}`)}>{job.title}</button>
                      <div className="text-[13px] text-gray-600">{job.companyName || 'Doanh nghiệp tuyển dụng'}{job.location ? ` · ${job.location}` : ''}</div>
                    </td>
                    <td className="px-4 py-3 text-[13px]">{serviceLabel(job.serviceTypeCode)}</td>
                    <td className="px-4 py-3 font-semibold tabular-nums text-[color:var(--affiliate-cta)]">
                      {estimates[i]?.isLoading ? <Skeleton.Input active size="small" /> : (est && formatEstimate(est)) || '—'}
                    </td>
                    <td className="px-4 py-3 text-[13px] text-gray-600">{job.applicationDeadline ? dayjs(job.applicationDeadline).format('DD/MM/YYYY') : '—'}</td>
                    <td className="px-4 py-3 text-right">
                      <Button type="primary" disabled={!verified} onClick={() => navigate(`/affiliate/submit-candidate?job=${job.jobId}`)}>Giới thiệu</Button>
                    </td>
                  </tr>
                );
              })}
              {opportunities.isLoading && (
                <tr><td colSpan={5} className="px-4 py-4"><Skeleton active paragraph={{ rows: 2 }} /></td></tr>
              )}
              {!opportunities.isLoading && (opportunities.data ?? []).length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-600">Chưa có việc làm nào mở cho Affiliate.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

// ─── Refer a candidate ──────────────────────────────────────────────────────

type SubmitForm = { jobId: string; mode: 'new' | 'library'; fullName?: string; email?: string; phone?: string; candidateId?: string; cvId?: string; note?: string };

export const AffiliateSubmitPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const [form] = Form.useForm<SubmitForm>();
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [presetCvRejected, setPresetCvRejected] = useState(false);
  const [librarySearch, setLibrarySearch] = useState('');
  const [jobSearch, setJobSearch] = useState('');
  const mode = Form.useWatch('mode', form) ?? 'new';
  const candidateId = Form.useWatch('candidateId', form);
  const jobId = Form.useWatch('jobId', form);

  const jobs = useQuery({ queryKey: ['aff-jobs'], queryFn: () => jobsApi.search({ page: 1, pageSize: 100 }) });
  const library = useQuery({
    queryKey: [...keys.library, 'picker', librarySearch],
    queryFn: () => affiliateApi.library({ search: librarySearch || undefined, page: 1, pageSize: 20 }),
    enabled: mode === 'library',
  });
  const libraryDetail = useQuery({
    queryKey: [...keys.library, 'detail', candidateId],
    queryFn: () => affiliateApi.libraryDetail(candidateId!),
    enabled: mode === 'library' && Boolean(candidateId),
  });

  useEffect(() => {
    const presetJob = searchParams.get('job');
    const presetCandidate = searchParams.get('candidate');
    const presetCv = searchParams.get('cv');
    form.setFieldsValue({
      mode: presetCandidate ? 'library' : 'new',
      ...(presetJob ? { jobId: presetJob } : {}),
      ...(presetCandidate ? { candidateId: presetCandidate } : {}),
      ...(presetCv ? { cvId: presetCv } : {}),
    });
  }, [searchParams, form]);

  useEffect(() => {
    const presetCv = searchParams.get('cv');
    if (!presetCv || !libraryDetail.data) return;
    const selectedCv = libraryDetail.data.cvs.find((cv) => cv.cvId === presetCv && cv.status === 'ACTIVE');
    if (selectedCv) form.setFieldValue('cvId', presetCv);
    else {
      form.setFieldValue('cvId', undefined);
      setPresetCvRejected(true);
    }
  }, [searchParams, libraryDetail.data, form]);

  const selectedJob = useMemo(() => jobs.data?.items.find((j) => j.jobId === jobId), [jobs.data, jobId]);
  const visibleJobs = useMemo(() => {
    const query = jobSearch.trim().toLocaleLowerCase('vi');
    return (jobs.data?.items ?? [])
      .filter((job) => !query || `${job.title} ${job.companyName ?? ''} ${job.location ?? ''}`.toLocaleLowerCase('vi').includes(query))
      .slice(0, 5);
  }, [jobs.data, jobSearch]);

  // A preset job the affiliate cannot refer into (service-type rules) is not in the list: say so.
  const [presetRejected, setPresetRejected] = useState(false);
  useEffect(() => {
    if (jobs.data && jobId && !jobs.data.items.some((j) => j.jobId === jobId)) {
      setPresetRejected(true);
      form.setFieldValue('jobId', undefined);
    }
  }, [jobs.data, jobId, form]);

  const submit = useMutation({
    mutationFn: (v: SubmitForm) =>
      affiliateApi.submit(
        v.jobId,
        v.mode === 'library'
          ? { candidateId: v.candidateId!, cvId: v.cvId!, note: v.note?.trim() || undefined }
          : { fullName: v.fullName!.trim(), email: v.email!.trim(), phone: v.phone?.trim() || undefined, file: file!, note: v.note?.trim() || undefined }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.submissions });
      queryClient.invalidateQueries({ queryKey: keys.library });
    },
  });

  if (submit.isSuccess) {
    const d = submit.data.data;
    return (
      <Surface className="mx-auto max-w-2xl p-6">
        <Result
          status="success"
          icon={<MailOutlined className="!text-[color:var(--console-accent)]" />}
          title={d.emailDeliveryStatus === 'FAILED' ? 'Đã lưu hồ sơ, cần gửi lại email xác nhận' : 'Đã gửi yêu cầu xác nhận cho ứng viên'}
          subTitle={`Lượt giới thiệu đang chờ ứng viên xác nhận${d.consentExpiresAt ? ` đến ${fmt(d.consentExpiresAt)}` : ''}. Quy trình ứng tuyển và quyền ghi nhận của bạn sẽ bắt đầu sau khi ứng viên đồng ý.`}
          extra={[
            <Button key="list" type="primary" onClick={() => navigate('/affiliate/submissions')}>
              Xem lượt giới thiệu
            </Button>,
            <Button
              key="again"
              onClick={() => {
                submit.reset();
                setFile(null);
                form.resetFields(['fullName', 'email', 'phone', 'candidateId', 'cvId', 'note']);
              }}
            >
              Giới thiệu người khác
            </Button>,
          ]}
        />
        {d.emailDeliveryStatus === 'FAILED' && (
          <Alert
            type="warning"
            showIcon
            message="Hồ sơ đã được lưu nhưng email chưa gửi được"
            description="Không nộp lại hồ sơ. Vào Lượt giới thiệu để gửi lại yêu cầu xác nhận."
            action={<Button onClick={() => navigate('/affiliate/submissions?status=PENDING_CONSENT')}>Gửi lại email</Button>}
          />
        )}
      </Surface>
    );
  }

  return (
    <div className="affiliate-submit-page">
      <AffiliatePageHeader
        title="Giới thiệu ứng viên"
        description="Chọn vị trí phù hợp, cung cấp thông tin ứng viên và kiểm tra lại trước khi gửi. Ứng viên luôn được yêu cầu xác nhận qua email."
      />
      <Form<SubmitForm>
        form={form}
        layout="vertical"
        requiredMark={false}
        initialValues={{ mode: 'new' }}
        onFinish={(v) => {
          if (v.mode === 'new' && !file) {
            setFileError('Đính kèm CV dạng PDF của ứng viên.');
            return;
          }
          submit.mutate(v);
        }}
        disabled={submit.isPending}
      >
        <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-5">
            {submit.isError && <Alert type="error" showIcon message="Chưa gửi được" description={getApiErrorMessage(submit.error)} />}
            {presetRejected && (
              <Alert
                type="warning"
                showIcon
                closable
                onClose={() => setPresetRejected(false)}
                message="Cơ hội này không nhận hồ sơ từ cộng tác viên"
                description="Vị trí này chỉ nhận ứng viên tự ứng tuyển. Vui lòng chọn một cơ hội khác trong danh sách."
              />
            )}
            {presetCvRejected && (
              <Alert
                type="warning"
                showIcon
                closable
                onClose={() => setPresetCvRejected(false)}
                message="CV đã chọn hiện không thể sử dụng"
                description="Vui lòng chọn một CV đang hoạt động khác trong kho ứng viên."
              />
            )}

            <Surface className="p-6">
              <h2 className="m-0 mb-1 text-base font-semibold text-slate-900">1. Chọn cơ hội tuyển dụng</h2>
              <p className="mb-4 mt-0 text-[13px] text-slate-600">Chọn vị trí phù hợp nhất với kinh nghiệm của ứng viên.</p>
              <Input
                size="large"
                allowClear
                prefix={<SearchOutlined />}
                value={jobSearch}
                onChange={(event) => setJobSearch(event.target.value)}
                placeholder="Nhập tên vị trí, kỹ năng hoặc doanh nghiệp"
                aria-label="Tìm vị trí tuyển dụng"
                className="mb-3"
              />
              <Form.Item name="jobId" rules={[{ required: true, message: 'Chọn vị trí tuyển dụng.' }]} className="mb-0">
                <Radio.Group className="affiliate-job-picker" aria-label="Danh sách vị trí tuyển dụng">
                  {visibleJobs.map((job) => (
                    <Radio key={job.jobId} value={job.jobId} className="affiliate-job-option">
                      <span className="affiliate-job-option__copy">
                        <strong>{job.title}</strong>
                        <small>{job.companyName || 'Doanh nghiệp tuyển dụng'} · {job.location || 'Toàn quốc'}</small>
                      </span>
                      <span className="affiliate-job-option__state">Đang tuyển</span>
                    </Radio>
                  ))}
                  {jobs.isLoading && <Skeleton active paragraph={{ rows: 3 }} />}
                  {!jobs.isLoading && visibleJobs.length === 0 && <div className="affiliate-job-empty">Không tìm thấy vị trí phù hợp.</div>}
                </Radio.Group>
              </Form.Item>
            </Surface>

            <Surface className="p-6">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="m-0 text-base font-semibold text-slate-900">2. Thông tin ứng viên</h2>
                  <p className="mb-0 mt-1 text-[13px] text-slate-600">Thêm người mới hoặc chọn hồ sơ đã có trong kho của bạn.</p>
                </div>
                <Form.Item name="mode" noStyle>
                  <Segmented
                    options={[
                      { value: 'new', label: 'Ứng viên mới' },
                      { value: 'library', label: 'Chọn từ kho' },
                    ]}
                  />
                </Form.Item>
              </div>

              {mode === 'new' ? (
                <>
                  <Form.Item name="fullName" label="Họ và tên" rules={[{ required: true, whitespace: true, message: 'Nhập họ tên ứng viên.' }, { max: 180, message: 'Tối đa 180 ký tự.' }]}>
                    <Input size="large" />
                  </Form.Item>
                  <div className="grid gap-x-4 sm:grid-cols-2">
                    <Form.Item
                      name="email"
                      label="Email của ứng viên"
                      extra="Hệ thống gửi đường dẫn xác nhận tới email này."
                      rules={[{ required: true, message: 'Nhập email ứng viên.' }, { type: 'email', message: 'Email không hợp lệ.' }]}
                    >
                      <Input size="large" />
                    </Form.Item>
                    <Form.Item
                      name="phone"
                      label="Số điện thoại của ứng viên"
                      extra="Dùng số di động Việt Nam 10 chữ số, ví dụ 0777569597."
                      rules={[
                        {
                          validator: (_, value) =>
                            !value || isValidVietnamPhoneNumber(value)
                              ? Promise.resolve()
                              : Promise.reject(new Error(VIETNAM_PHONE_VALIDATION_MESSAGE)),
                        },
                      ]}
                    >
                      <Input size="large" />
                    </Form.Item>
                  </div>
                  <div className="mb-1 text-sm font-semibold text-slate-700">CV ứng viên (PDF)</div>
                  <Upload.Dragger
                    accept="application/pdf,.pdf"
                    multiple={false}
                    showUploadList={false}
                    beforeUpload={(f) => {
                      const e = cvFileError(f);
                      setFileError(e);
                      if (!e) setFile(f);
                      return false;
                    }}
                    className="!border-2 !border-dashed !border-slate-300 hover:!border-sky-600 !bg-slate-50/50 hover:!bg-sky-50/20 !rounded-xl transition-all"
                  >
                    {file ? (
                      <div className="py-2 text-center">
                        <FilePdfOutlined className="text-2xl text-red-600 mb-1" aria-hidden />
                        <div className="text-sm font-semibold text-slate-800">{file.name}</div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          {fileSize(file.size)} · <span className="text-sky-700 font-medium hover:underline">Bấm để đổi file</span>
                        </div>
                      </div>
                    ) : (
                      <div className="py-4 text-center">
                        <div className="flex justify-center mb-2">
                          <span className="inline-flex items-center justify-center w-11 h-11 rounded-full bg-sky-50 text-sky-700 border border-solid border-sky-100">
                            <UploadCloud className="w-5 h-5 text-sky-700" />
                          </span>
                        </div>
                        <p className="text-sm font-semibold text-slate-800 mb-1">Kéo thả CV vào đây hoặc bấm để chọn file</p>
                        <p className="text-xs text-slate-500 m-0">Chỉ nhận PDF, dung lượng tối đa {MAX_CV_MB}MB.</p>
                      </div>
                    )}
                  </Upload.Dragger>
                  {fileError && <div className="mt-1 text-[13px] text-red-700" role="alert">{fileError}</div>}
                </>
              ) : (
                <>
                  <Form.Item name="candidateId" label="Ứng viên trong kho" rules={[{ required: true, message: 'Chọn ứng viên.' }]}>
                    <Select
                      size="large"
                      showSearch
                      filterOption={false}
                      onSearch={setLibrarySearch}
                      loading={library.isFetching}
                      placeholder="Tìm theo tên, email hoặc số điện thoại"
                      notFoundContent={library.isFetching ? 'Đang tìm...' : 'Kho chưa có ứng viên phù hợp. Chọn “Ứng viên mới” để thêm hồ sơ.'}
                      options={(library.data?.items ?? []).map((c) => ({ value: c.candidateId, label: `${c.fullName}${c.email ? ` · ${c.email}` : ''}` }))}
                      onChange={() => form.setFieldValue('cvId', undefined)}
                    />
                  </Form.Item>
                  {candidateId && (
                    <Form.Item name="cvId" label="CV gửi kèm" rules={[{ required: true, message: 'Chọn một CV.' }]} className="mb-0">
                      {libraryDetail.isLoading ? (
                        <Skeleton active paragraph={{ rows: 2 }} />
                      ) : (
                        <Select
                          size="large"
                          placeholder="Chọn CV"
                          options={(libraryDetail.data?.cvs ?? []).map((cv) => ({
                            value: cv.cvId,
                            label: `${cv.title || cv.fileName}${cv.status !== 'ACTIVE' ? ' · Không thể sử dụng' : ''}`,
                            disabled: cv.status !== 'ACTIVE',
                          }))}
                        />
                      )}
                    </Form.Item>
                  )}
                </>
              )}
            </Surface>

            <Surface className="p-6">
              <h2 className="m-0 mb-1 text-base font-semibold text-slate-900">
                3. Thông tin bổ sung <span className="font-normal text-slate-500">(không bắt buộc)</span>
              </h2>
              <p className="mb-4 mt-0 text-[13px] text-slate-600">Nêu ngắn gọn điểm mạnh giúp doanh nghiệp hiểu ứng viên nhanh hơn.</p>
              <Form.Item name="note" className="mb-0" rules={[{ max: 2000, message: 'Tối đa 2000 ký tự.' }]}>
                <Input.TextArea rows={3} showCount maxLength={2000} placeholder="Ví dụ: 3 năm kinh nghiệm Java, có thể nhận việc sau 30 ngày, mong muốn làm việc tại Hà Nội…" />
              </Form.Item>
            </Surface>
          </div>

          <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
            <Surface className="p-5">
              <div className="text-sm font-bold text-gray-900">Giới thiệu vào</div>
              {selectedJob ? (
                <div className="mt-2">
                  <div className="font-semibold text-slate-900">{selectedJob.title}</div>
                  <div className="text-[13px] text-slate-600">{selectedJob.companyName}</div>
                  <div className="text-[13px] text-slate-600">{selectedJob.location}</div>
                </div>
              ) : (
                <p className="m-0 mt-2 text-sm text-slate-500">Chưa chọn vị trí tuyển dụng.</p>
              )}
              <div className="mt-4 text-sm font-bold text-gray-900">Sau khi gửi</div>
              <ol className="m-0 mt-1.5 space-y-1.5 pl-4 text-[13px] leading-relaxed text-gray-700">
                <li>Ứng viên nhận email và tự đồng ý cho bạn gửi hồ sơ.</li>
                <li>Đồng ý xong, hồ sơ được AI chấm điểm và chuyển cho HR.</li>
                <li>Bạn được ghi nhận là nguồn nếu đây là lượt hợp lệ đầu tiên.</li>
                <li>Hệ thống cảnh báo nếu ứng viên đã có hồ sơ ở vị trí này.</li>
              </ol>
            </Surface>
            {selectedJob && <CommissionEstimateCard jobId={selectedJob.jobId} />}
            <Button type="primary" size="large" block htmlType="submit" icon={<SendOutlined />} loading={submit.isPending} className="affiliate-cta">
              Gửi giới thiệu
            </Button>
          </aside>
        </div>
      </Form>
    </div>
  );
};

// ─── Submissions ────────────────────────────────────────────────────────────

const STATUSES = ['all', 'PENDING_CONSENT', 'ACCEPTED', 'CONSENT_REJECTED', 'CONSENT_EXPIRED', 'BLOCKED_DUPLICATE', 'JOB_UNAVAILABLE'] as const;

/** N13: GET /affiliates/referrals progressStatus codes in Vietnamese. */
const REFERRAL_PROGRESS: Record<string, string> = {
  WAITING_CONSENT: 'Chờ ứng viên xác nhận',
  SUBMITTED: 'Đã nộp',
  CV_REVIEW: 'Đang xem xét CV',
  SHORTLISTED: 'Đã được chọn',
  INTERVIEW: 'Đang phỏng vấn',
  OFFER: 'Đang chuẩn bị đề nghị nhận việc',
  BACKUP: 'Dự phòng',
  PLACED: 'Đã đi làm',
  CLOSED: 'Đã kết thúc',
};

const submissionToneClass = (tone: string) => `is-${tone}`;

const submissionStatusIcon = (tone: string) => {
  if (tone === 'success') return <CheckCircleOutlined />;
  if (tone === 'warning') return <ClockCircleOutlined />;
  if (tone === 'danger') return <CloseCircleOutlined />;
  if (tone === 'info') return <ExclamationCircleOutlined />;
  return <InboxOutlined />;
};

const SubmissionStatusBadge: React.FC<{ status: string; className?: string }> = ({ status, className = '' }) => {
  const config = submissionStatus(status);
  return (
    <span className={`affiliate-submission-badge ${submissionToneClass(config.tone)} ${className}`} role="status">
      {submissionStatusIcon(config.tone)}
      <span>{config.label}</span>
    </span>
  );
};

const referralProgressPresentation = (progress: string) => {
  const normalized = progress.toLowerCase();
  if (normalized.includes('đi làm')) return { tone: 'success', icon: <span className="w-2 h-2 rounded-full bg-emerald-500 mr-2 inline-block" /> };
  if (normalized.includes('phỏng vấn')) return { tone: 'info', icon: <TeamOutlined /> };
  if (normalized.includes('được chọn')) return { tone: 'info', icon: <CheckCircleOutlined /> };
  if (normalized.includes('offer') || normalized.includes('đề nghị')) return { tone: 'warning', icon: <FileDoneOutlined /> };
  return { tone: 'neutral', icon: <ClockCircleOutlined /> };
};

const ReferralProgressState: React.FC<{ progress: string }> = ({ progress }) => {
  const presentation = referralProgressPresentation(progress);
  if (progress.toLowerCase().includes('đi làm')) {
    return (
      <div className="inline-flex items-center text-xs font-semibold text-slate-800" role="status">
        <span className="w-2 h-2 rounded-full bg-emerald-500 mr-2 inline-block"></span>
        Đã đi làm
      </div>
    );
  }
  return (
    <div className={`affiliate-referral-state is-${presentation.tone}`} role="status">
      <span className="affiliate-referral-state__icon" aria-hidden>{presentation.icon}</span>
      <span className="affiliate-referral-state__copy">
        <strong>{progress}</strong>
        <small>Ứng viên đã đồng ý cho giới thiệu</small>
      </span>
    </div>
  );
};

const submissionListCaption = (status: string) => {
  const captions: Record<string, string> = {
    RECEIVED: 'HR Connect đang kiểm tra hồ sơ',
    PENDING_CONSENT: 'Chờ ứng viên phản hồi email',
    PENDING_IDENTITY_REVIEW: 'Đang kiểm tra thông tin ứng viên',
    ACCEPTED: 'Ứng viên đã đồng ý cho giới thiệu',
    CONSENT_REJECTED: 'Ứng viên không đồng ý giới thiệu',
    CONSENT_EXPIRED: 'Không phản hồi trong thời hạn',
    BLOCKED_DUPLICATE: 'Đã có hồ sơ cho vị trí này',
    BLOCKED_CLIENT_OWNED: 'Doanh nghiệp đã tiếp nhận trước đó',
    REJECTED_INVALID: 'Cần kiểm tra lại thông tin đã gửi',
    JOB_UNAVAILABLE: 'Vị trí đã đóng hoặc ngừng nhận hồ sơ',
    CANCELLED: 'Lượt giới thiệu đã kết thúc',
  };
  return captions[status] ?? 'HR Connect đang cập nhật';
};

const SubmissionListState: React.FC<{ status: string }> = ({ status }) => {
  const config = submissionStatus(status);
  return (
    <div className={`affiliate-referral-state ${submissionToneClass(config.tone)}`} role="status">
      <span className="affiliate-referral-state__icon" aria-hidden>{submissionStatusIcon(config.tone)}</span>
      <span className="affiliate-referral-state__copy">
        <strong>{config.label}</strong>
        <small>{submissionListCaption(status)}</small>
      </span>
    </div>
  );
};

export const AffiliateSubmissionsPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const status = (STATUSES as readonly string[]).includes(searchParams.get('status') ?? '') ? (searchParams.get('status') as (typeof STATUSES)[number]) : 'all';
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const jobId = searchParams.get('jobId') || undefined;
  const candidateId = searchParams.get('candidateId') || undefined;
  const fromDate = searchParams.get('fromDate') || undefined;
  const toDate = searchParams.get('toDate') || undefined;
  const jobs = useQuery({ queryKey: ['aff-jobs', 'submission-filter'], queryFn: () => jobsApi.search({ page: 1, pageSize: 100 }) });
  const commonFilters = { jobId, candidateId, fromDate, toDate };

  const counts = useQueries({
    queries: STATUSES.map((s) => ({
      queryKey: [...keys.submissions, 'count', s, jobId, candidateId, fromDate, toDate],
      queryFn: async () => (await affiliateApi.submissions({ ...commonFilters, status: s === 'all' ? undefined : s, page: 1, pageSize: 1 })).totalCount,
    })),
  });
  const list = useQuery({
    queryKey: [...keys.submissions, 'list', status, jobId, candidateId, fromDate, toDate, page],
    queryFn: () => affiliateApi.submissions({ ...commonFilters, status: status === 'all' ? undefined : status, page, pageSize: 10 }),
    placeholderData: (prev) => prev,
  });
  // Hiring progress of accepted referrals, keyed by submission.
  const progress = useQuery({ queryKey: [...keys.submissions, 'progress'], queryFn: () => affiliateApi.referrals({ page: 1, pageSize: 100 }) });
  const progressOf = (id: string) => {
    const code = progress.data?.items.find((p) => p.submissionId === id)?.progressStatus;
    return code ? REFERRAL_PROGRESS[code] ?? code : undefined;
  };

  const columns: ColumnsType<AffiliateSubmission> = [
    { title: 'Ứng viên', key: 'c', width: 160, render: (_, r) => <PersonCell name={r.candidateName} /> },
    { title: 'Việc làm', dataIndex: 'jobTitle', width: 230, ellipsis: true, render: (v: string) => <Tooltip title={v}><span className="font-medium text-slate-900">{v}</span></Tooltip> },
    {
      title: 'Trạng thái',
      key: 's',
      width: 210,
      render: (_, r) => {
        const st = submissionStatus(r.status);
        const prog = r.status === 'ACCEPTED' ? progressOf(r.submissionId) : undefined;
        return (
          <div className="affiliate-submission-status">
            {prog ? (
              <Tooltip title={`${st.label}. ${st.hint}`}><span><ReferralProgressState progress={prog} /></span></Tooltip>
            ) : (
              <Tooltip title={st.hint}><span><SubmissionListState status={r.status} /></span></Tooltip>
            )}
            {r.status === 'PENDING_CONSENT' && r.consentExpiresAt && (
              <div className="affiliate-submission-status__meta"><ClockCircleOutlined /> Hết hạn {dayjs(r.consentExpiresAt).fromNow()}</div>
            )}
          </div>
        );
      },
    },
    { title: 'Thời gian gửi', dataIndex: 'submittedAt', width: 130, render: (v: string) => <span className="tabular-nums">{fmt(v)}</span> },
    {
      title: <span className="sr-only">Thao tác</span>,
      key: 'a',
      width: 165,
      render: (_, r) => (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="text-sky-700 hover:text-sky-900 font-medium text-sm hover:underline inline-flex items-center gap-1 bg-transparent border-0 p-0 cursor-pointer"
            onClick={() => navigate(`/affiliate/submissions/${r.submissionId}`)}
          >
            <EyeOutlined /> Xem chi tiết
          </button>
          {r.status === 'PENDING_CONSENT' && (
            <Button
              size="small"
              icon={<MailOutlined />}
              onClick={() => navigate(`/affiliate/submissions/${r.submissionId}`)}
            >
              Nhắc xác nhận
            </Button>
          )}
        </div>
      ),
    },
  ];

  const updateFilters = (updates: Record<string, string | undefined>) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([key, value]) => {
      if (value) next.set(key, value);
      else next.delete(key);
    });
    if (!Object.prototype.hasOwnProperty.call(updates, 'page')) next.delete('page');
    setSearchParams(next);
  };

  const setStatus = (value: string) => updateFilters({ status: value === 'all' ? undefined : value });

  return (
    <div className="affiliate-submissions-page">
      <AffiliatePageHeader
        title="Lượt giới thiệu"
        description="Theo dõi từ lúc gửi yêu cầu xác nhận đến khi ứng viên hoàn tất quy trình tuyển dụng."
        actions={
          <Button size="large" icon={<ReloadOutlined />} onClick={() => list.refetch()}>
            Cập nhật dữ liệu
          </Button>
        }
      />
      <Surface>
        <div className="px-5 pb-3 pt-5">
          <FilterPills
            label="Lọc theo trạng thái"
            value={status}
            onChange={setStatus}
            options={STATUSES.map((s, i) => ({ value: s, label: s === 'all' ? 'Tất cả' : submissionStatus(s).label, count: counts[i].data }))}
          />
          <div className="mt-3 flex flex-wrap gap-3">
            <Select
              aria-label="Lọc theo việc làm"
              allowClear
              showSearch
              optionFilterProp="label"
              loading={jobs.isLoading}
              placeholder="Tất cả vị trí tuyển dụng"
              value={jobId}
              className="min-w-64"
              onChange={(value) => updateFilters({ jobId: value })}
              options={(jobs.data?.items ?? []).map((job) => ({ value: job.jobId, label: `${job.title} — ${job.companyName ?? ''}` }))}
            />
            <DatePicker.RangePicker
              aria-label="Lọc theo ngày gửi"
              format="DD/MM/YYYY"
              value={fromDate && toDate ? [dayjs(fromDate), dayjs(toDate)] : null}
              onChange={(dates) => updateFilters({
                fromDate: dates?.[0]?.startOf('day').toISOString(),
                toDate: dates?.[1]?.endOf('day').toISOString(),
              })}
            />
            {(jobId || candidateId || fromDate || toDate) && (
              <Button onClick={() => setSearchParams(status === 'all' ? {} : { status })}>Xóa bộ lọc</Button>
            )}
          </div>
        </div>
        {list.isError ? (
          <div className="p-5">
            <Alert type="error" showIcon message={getApiErrorMessage(list.error)} />
          </div>
        ) : (
          <Table<AffiliateSubmission>
            className="admin-soft-table w-full table-auto"
            rowKey="submissionId"
            columns={columns}
            dataSource={list.data?.items ?? []}
            loading={list.isFetching}
            pagination={{
              current: page,
              pageSize: 10,
              total: list.data?.totalCount ?? 0,
              showSizeChanger: false,
              onChange: (nextPage) => updateFilters({ page: String(nextPage) }),
            }}
            locale={{ emptyText: <div className="py-10 text-slate-600">Chưa có lượt giới thiệu phù hợp với bộ lọc.</div> }}
          />
        )}
      </Surface>
    </div>
  );
};

export const AffiliateSubmissionDetailPage: React.FC = () => {
  const { message } = AntApp.useApp();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const canResend = useAuthStore((state) => state.hasPermission('submission.consent.resend_own'));
  const { submissionId = '' } = useParams();
  const [retryUntil, setRetryUntil] = useState<number | null>(null);
  const [retryRemaining, setRetryRemaining] = useState(0);
  const [resentInThisView, setResentInThisView] = useState(false);
  const detail = useQuery({
    queryKey: [...keys.submissions, 'detail', submissionId],
    queryFn: () => affiliateApi.submissionDetail(submissionId),
    enabled: Boolean(submissionId),
  });

  useEffect(() => {
    if (!retryUntil) return;
    const update = () => {
      const remaining = Math.max(0, Math.ceil((retryUntil - Date.now()) / 1000));
      setRetryRemaining(remaining);
      if (remaining === 0) setRetryUntil(null);
    };
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [retryUntil]);

  const resend = useMutation({
    mutationFn: () => affiliateApi.resendConsent(submissionId),
    onSuccess: async (result) => {
      setResentInThisView(true);
      if (result.emailDeliveryStatus === 'FAILED') message.warning(result.message);
      else message.success(result.message);
      await queryClient.invalidateQueries({ queryKey: keys.submissions });
    },
    onError: async (error) => {
      const apiError = getApiError(error, 'Chưa gửi lại được yêu cầu xác nhận.');
      const serverTimestamp = apiError.message.match(
        /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})/
      )?.[0];
      const retryAt = apiError.retryAfterSeconds
        ? Date.now() + apiError.retryAfterSeconds * 1000
        : serverTimestamp
          ? Date.parse(serverTimestamp)
          : undefined;
      if (retryAt && retryAt > Date.now()) setRetryUntil(retryAt);
      message.error(apiError.message);
      if (apiError.status === 409) await queryClient.invalidateQueries({ queryKey: keys.submissions });
    },
  });

  if (detail.isLoading) return <Skeleton active paragraph={{ rows: 8 }} />;
  if (detail.isError || !detail.data) {
    return (
      <Surface className="p-6">
        <Alert
          type="error"
          showIcon
          message="Không tải được chi tiết lượt giới thiệu"
          description={getApiErrorMessage(detail.error)}
          action={<Button onClick={() => navigate('/affiliate/submissions')}>Về danh sách</Button>}
        />
      </Surface>
    );
  }

  const submission = detail.data;
  const status = submissionStatus(submission.status);
  const reasonIsActionable = ['CONSENT_REJECTED', 'BLOCKED_DUPLICATE', 'BLOCKED_CLIENT_OWNED', 'REJECTED_INVALID', 'JOB_UNAVAILABLE', 'CANCELLED'].includes(submission.status);
  const consentResolved = !['RECEIVED', 'PENDING_CONSENT', 'PENDING_IDENTITY_REVIEW'].includes(submission.status);
  const detailMilestones = [
    { label: 'Đã gửi yêu cầu', caption: fmt(submission.submittedAt), complete: true },
    {
      label: consentResolved ? 'Đã có phản hồi' : 'Chờ ứng viên phản hồi',
      caption: submission.consentRespondedAt ? fmt(submission.consentRespondedAt) : `Hạn ${fmt(submission.consentExpiresAt)}`,
      complete: consentResolved,
      current: !consentResolved,
    },
    {
      label: submission.applicationId ? 'Đã tạo hồ sơ ứng tuyển' : 'Chưa tạo hồ sơ ứng tuyển',
      caption: submission.attributionId ? 'Quyền giới thiệu đã được ghi nhận' : 'Thực hiện sau khi ứng viên đồng ý',
      complete: Boolean(submission.applicationId && submission.attributionId),
      current: consentResolved && !submission.applicationId,
    },
  ];
  const sentAt = submission.consentEmailSentAt ?? submission.consentRequestedAt ?? submission.submittedAt;
  const consentWindow =
    submission.status === 'PENDING_CONSENT' && submission.consentExpiresAt
      ? (() => {
          const start = dayjs(sentAt).valueOf();
          const end = dayjs(submission.consentExpiresAt).valueOf();
          const used = end > start ? Math.min(100, Math.max(0, ((Date.now() - start) / (end - start)) * 100)) : 100;
          return { used: Math.round(used), left: dayjs(submission.consentExpiresAt).fromNow(true) };
        })()
      : null;

  return (
    <div className="affiliate-submission-detail">
      <button
        type="button"
        className="mb-3 inline-flex cursor-pointer items-center gap-1.5 border-0 bg-transparent p-0 text-sm text-sky-700 hover:text-sky-900"
        onClick={() => navigate('/affiliate/submissions')}
      >
        <ArrowLeftOutlined aria-hidden /> Lượt giới thiệu
      </button>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-4">
          <section className="rounded-lg border border-solid border-gray-200 bg-white p-5">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="m-0 text-xl font-bold text-gray-900">{submission.candidateName}</h1>
              <SubmissionStatusBadge status={submission.status} />
            </div>
            <div className="mt-1 text-gray-600">{submission.jobTitle}{submission.companyName ? ` · ${submission.companyName}` : ''}</div>
            <p className="m-0 mt-2 text-[13px] text-gray-600">{status.hint}</p>
            <dl className="m-0 mt-4 grid grid-cols-3 gap-x-5 gap-y-3 text-[13px] max-sm:grid-cols-2">
              <div><dt className="text-gray-500">Email</dt><dd className="m-0 break-all">{submission.candidateEmail || 'Chưa cung cấp'}</dd></div>
              <div><dt className="text-gray-500">Số điện thoại</dt><dd className="m-0">{submission.candidatePhone || 'Chưa cung cấp'}</dd></div>
              <div><dt className="text-gray-500">Gửi lúc</dt><dd className="m-0 tabular-nums">{fmt(submission.submittedAt)}</dd></div>
              <div><dt className="text-gray-500">CV</dt><dd className="m-0">{submission.cvTitle || submission.cvFileName || 'Chưa có tên CV'}</dd></div>
              <div><dt className="text-gray-500">Hồ sơ ứng tuyển</dt><dd className={`m-0 ${submission.applicationId ? 'text-green-800' : 'text-gray-500'}`}>{submission.applicationId ? 'Đã được tạo' : 'Chưa được tạo'}</dd></div>
              <div><dt className="text-gray-500">Ghi nhận nguồn</dt><dd className={`m-0 ${submission.attributionId ? 'text-green-800' : 'text-gray-500'}`}>{submission.attributionId ? 'Đã ghi nhận cho bạn' : 'Có sau khi ứng viên đồng ý'}</dd></div>
            </dl>
          </section>

          <section aria-labelledby="aff-consent" className="rounded-lg border border-solid border-gray-200 bg-white p-5">
            <h2 id="aff-consent" className="m-0 mb-3 text-[15px] font-bold text-gray-900">Xác nhận của ứng viên</h2>
            {consentWindow && (
              <div className="mb-4">
                <div className="h-2 overflow-hidden rounded bg-slate-100" role="progressbar" aria-label="Thời gian đã qua của lời mời" aria-valuenow={consentWindow.used} aria-valuemin={0} aria-valuemax={100}>
                  <div className="h-full bg-[color:var(--affiliate-cta)]" style={{ width: `${consentWindow.used}%` }} />
                </div>
                <div className="mt-1.5 flex flex-wrap justify-between gap-2 text-xs text-gray-600">
                  <span>Gửi email {fmt(sentAt)}</span>
                  <span className="font-semibold text-orange-800">Hết hạn {fmt(submission.consentExpiresAt)} · còn {consentWindow.left}</span>
                </div>
              </div>
            )}
            <dl className="m-0 grid grid-cols-3 gap-x-5 gap-y-2 text-[13px] max-sm:grid-cols-1">
              <div><dt className="text-gray-500">Đã gửi email</dt><dd className="m-0 tabular-nums">{fmt(submission.consentEmailSentAt)}</dd></div>
              <div><dt className="text-gray-500">Hạn xác nhận</dt><dd className="m-0 tabular-nums">{fmt(submission.consentExpiresAt)}</dd></div>
              <div><dt className="text-gray-500">Thời gian phản hồi</dt><dd className="m-0 tabular-nums">{fmt(submission.consentRespondedAt)}</dd></div>
            </dl>
            {submission.reason && reasonIsActionable && <Alert className="mt-4" type="info" showIcon message="Lý do cần lưu ý" description={submission.reason} />}
            {submission.status === 'PENDING_CONSENT' && (
              <Alert
                className="mt-4"
                type="warning"
                showIcon
                message="Đang chờ ứng viên xác nhận"
                description="Hồ sơ ứng tuyển và quyền ghi nhận của bạn chỉ được tạo sau khi ứng viên xác nhận cho phép giới thiệu vào vị trí này."
              />
            )}
            {resend.data && (
              <Alert
                className="mt-4"
                type={resend.data.emailDeliveryStatus === 'FAILED' ? 'warning' : 'success'}
                showIcon
                message={resend.data.message}
                description={`Hạn xác nhận mới: ${fmt(resend.data.expiresAt)} · Đã gửi ${resend.data.emailSendCount} lần.`}
              />
            )}
            {submission.status === 'PENDING_CONSENT' && canResend && (
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <Button
                  icon={<MailOutlined />}
                  loading={resend.isPending}
                  disabled={resentInThisView || retryRemaining > 0}
                  onClick={() => resend.mutate()}
                  className="!border-sky-700 !text-sky-700"
                >
                  {retryRemaining > 0
                    ? `Thử lại sau ${retryRemaining} giây`
                    : resentInThisView
                      ? 'Đã gửi lại yêu cầu'
                      : 'Gửi lại yêu cầu xác nhận'}
                </Button>
                <span className="text-xs text-gray-500">Liên kết xác nhận cũ sẽ bị vô hiệu hóa.</span>
              </div>
            )}
          </section>

          <section aria-labelledby="aff-history" className="rounded-lg border border-solid border-gray-200 bg-white p-5">
            <h2 id="aff-history" className="m-0 mb-3 text-[15px] font-bold text-gray-900">Tiến trình</h2>
            <ol className="m-0 list-none space-y-3.5 border-0 border-l-2 border-solid border-gray-200 p-0">
              {detailMilestones.map((m) => (
                <li key={m.label} className="relative pl-4">
                  <span
                    aria-hidden
                    className={`absolute -left-[6px] top-1.5 h-2.5 w-2.5 rounded-full ${m.complete ? 'bg-sky-700' : m.current ? 'bg-[color:var(--affiliate-cta)]' : 'bg-gray-300'}`}
                  />
                  <span className={`block font-semibold ${m.complete || m.current ? 'text-gray-900' : 'text-gray-400'}`}>{m.label}</span>
                  <span className="block text-xs text-gray-500">{m.caption}</span>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          {submission.jobId && <CommissionEstimateCard jobId={submission.jobId} />}
          {submission.status === 'BLOCKED_DUPLICATE' && (
            <section className="rounded-lg border border-solid border-red-200 bg-red-50 p-4">
              <h2 className="m-0 mb-1.5 text-sm font-bold text-red-800">Lượt này bị chặn vì trùng</h2>
              <p className="m-0 mb-2.5 text-[13px] leading-relaxed text-red-900">Bạn không thấy thông tin của Affiliate kia. Nếu bạn giới thiệu trước, hãy gửi khiếu nại kèm bằng chứng.</p>
              <Button danger onClick={() => navigate(`/affiliate/disputes?submissionId=${submission.submissionId}`)}>Gửi khiếu nại</Button>
            </section>
          )}
          <Button block onClick={() => navigate(`/affiliate/jobs/${submission.jobId}`)}>Xem việc làm</Button>
        </aside>
      </div>
    </div>
  );
};

// ─── Candidate library ──────────────────────────────────────────────────────

export const AffiliateCandidatesPage: React.FC = () => {
  const navigate = useNavigate();
  const openSigned = useOpenSignedUrl();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string>();
  const list = useQuery({
    queryKey: [...keys.library, 'list', search, page],
    queryFn: () => affiliateApi.library({ search: search || undefined, page, pageSize: 10 }),
    placeholderData: (prev) => prev,
  });
  const detail = useQuery({ queryKey: [...keys.library, 'detail', openId], queryFn: () => affiliateApi.libraryDetail(openId!), enabled: Boolean(openId) });

  const columns: ColumnsType<LibraryCandidate> = [
    { title: 'Ứng viên', key: 'c', width: 300, render: (_, r) => <PersonCell name={r.fullName} secondary={r.email ?? r.phone} /> },
    {
      title: 'Hồ sơ sẵn sàng',
      dataIndex: 'activeCvCount',
      width: 165,
      render: (value: number) => <span className={`affiliate-library-metric ${value > 0 ? 'is-ready' : ''}`}><FilePdfOutlined /> {value > 0 ? `${value} CV có thể dùng` : 'Chưa có CV'}</span>,
    },
    {
      title: 'Đã được xác nhận',
      dataIndex: 'acceptedSubmissionCount',
      width: 160,
      render: (value: number) => <span className="affiliate-library-confirmed"><SafetyCertificateOutlined /> {value} lượt giới thiệu</span>,
    },
    {
      title: 'Lần giới thiệu gần nhất',
      dataIndex: 'lastSubmittedAt',
      width: 175,
      render: (value: string | null) => value ? <span className="affiliate-library-time"><strong>{dayjs(value).fromNow()}</strong><small>{fmt(value)}</small></span> : 'Chưa có',
    },
    {
      title: <span className="sr-only">Thao tác</span>,
      key: 'actions',
      width: 135,
      render: (_, row) => (
        <button
          type="button"
          className="text-sky-700 hover:text-sky-900 font-medium text-sm hover:underline inline-flex items-center gap-1 bg-transparent border-0 p-0 cursor-pointer"
          onClick={(event) => {
            event.stopPropagation();
            setOpenId(row.candidateId);
          }}
        >
          <EyeOutlined /> Xem hồ sơ
        </button>
      ),
    },
  ];

  return (
    <div className="affiliate-candidates-page">
      <AffiliatePageHeader
        title="Kho ứng viên"
        description="Ứng viên từng đồng ý qua lời giới thiệu của bạn. Dùng lại CV cho job mới."
        actions={<Button type="primary" size="large" icon={<UserAddOutlined />} className="affiliate-cta" onClick={() => navigate('/affiliate/submit-candidate')}>Giới thiệu ứng viên mới</Button>}
      />
      <Surface>
        <div className="affiliate-library-toolbar">
          <div>
            <strong>Tìm nhanh trong kho</strong>
            <small>Tìm theo thông tin liên hệ của ứng viên</small>
          </div>
          <Input
            size="large"
            allowClear
            prefix={<SearchOutlined className="text-slate-400" />}
            placeholder="Tên, email hoặc số điện thoại"
            className="affiliate-library-search"
            onPressEnter={(e) => {
              setPage(1);
              setSearch((e.target as HTMLInputElement).value.trim());
            }}
            onChange={(e) => !e.target.value && search && setSearch('')}
          />
        </div>
      </Surface>
      <p className="m-0 mb-3 mt-4 text-sm text-gray-600">{list.isLoading ? 'Đang tải…' : `${list.data?.total ?? 0} ứng viên · CV lưu theo từng lượt giới thiệu`}</p>
      {list.isLoading ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-3">
          {[0, 1, 2].map((i) => <div key={i} className="rounded-lg border border-solid border-gray-200 bg-white p-4"><Skeleton active avatar paragraph={{ rows: 2 }} /></div>)}
        </div>
      ) : (list.data?.items ?? []).length === 0 ? (
        <div className="rounded-lg border border-solid border-gray-200 bg-white px-4 py-12 text-center">
          <div className="font-semibold text-gray-900">{search ? 'Không tìm thấy ứng viên' : 'Kho ứng viên đang trống'}</div>
          <p className="m-0 mt-1 text-sm text-gray-600">Ứng viên đồng ý qua lời giới thiệu của bạn sẽ được lưu ở đây.</p>
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-3">
          {(list.data?.items ?? []).map((c) => (
            <article key={c.candidateId} className="flex flex-col gap-2.5 rounded-lg border border-solid border-gray-200 bg-white p-4">
              <button
                type="button"
                className="flex cursor-pointer items-center gap-3 border-0 bg-transparent p-0 text-left"
                onClick={() => setOpenId(c.candidateId)}
              >
                <Initials name={c.fullName} size={44} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-bold text-gray-900">{c.fullName}</span>
                  <span className="block truncate text-[13px] text-gray-600">{[c.email, c.phone].filter(Boolean).join(' · ') || 'Chưa có thông tin liên hệ'}</span>
                </span>
              </button>
              <div className="flex items-center justify-between gap-2 border-0 border-t border-solid border-slate-100 pt-2.5 text-[13px]">
                <span className="text-gray-600">
                  {c.activeCvCount > 0 ? `${c.activeCvCount} CV` : 'Chưa có CV'} · {c.acceptedSubmissionCount} lượt
                  {c.lastSubmittedAt ? ` · ${dayjs(c.lastSubmittedAt).fromNow()}` : ''}
                </span>
                <Button size="small" type="primary" className="!bg-[color:var(--affiliate-brand)]" onClick={() => navigate(`/affiliate/submit-candidate?candidate=${c.candidateId}`)}>
                  Giới thiệu
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}
      {(list.data?.total ?? 0) > 10 && (
        <div className="mt-4 flex justify-end">
          <Pagination current={page} pageSize={10} total={list.data?.total ?? 0} showSizeChanger={false} onChange={setPage} />
        </div>
      )}
      <p className="m-0 mt-4 rounded-md border border-solid border-sky-200 bg-sky-50 px-3.5 py-3 text-[13px] text-sky-900">Mỗi lần giới thiệu vào job mới, ứng viên vẫn nhận email và phải đồng ý lại cho job đó.</p>

      <Drawer className="affiliate-candidate-drawer" open={Boolean(openId)} onClose={() => setOpenId(undefined)} width="min(590px, 100vw)" title="Hồ sơ ứng viên" destroyOnHidden>
        {detail.isLoading ? (
          <Skeleton active paragraph={{ rows: 6 }} />
        ) : detail.data ? (
          <div className="affiliate-candidate-profile">
            <section className="affiliate-candidate-profile__hero">
              <Initials name={detail.data.fullName} size={68} />
              <div><span>ỨNG VIÊN TRONG KHO</span><h2>{detail.data.fullName}</h2><p>{detail.data.hasAccount ? 'Đã có tài khoản HR Connect' : 'Chưa có tài khoản HR Connect'}</p></div>
            </section>
            <div className="affiliate-candidate-profile__contact">
              <div><MailOutlined /><span><small>Email</small><strong>{detail.data.email || 'Chưa cung cấp'}</strong></span></div>
              <div><UserOutlined /><span><small>Số điện thoại</small><strong>{detail.data.phone || 'Chưa cung cấp'}</strong></span></div>
            </div>
            <div className="affiliate-candidate-profile__stats">
              <div><strong>{detail.data.cvs.filter((cv) => cv.status === 'ACTIVE').length}</strong><small>CV có thể dùng</small></div>
              <div><strong>{detail.data.acceptedSubmissionCount}</strong><small>Lượt đã xác nhận</small></div>
            </div>
            <Button className="affiliate-candidate-profile__cta" size="large" block type="primary" icon={<UserAddOutlined />} onClick={() => navigate(`/affiliate/submit-candidate?candidate=${detail.data!.candidateId}`)}>
              Giới thiệu vào cơ hội mới
            </Button>
            <section className="affiliate-candidate-profile__cvs">
              <div className="affiliate-candidate-profile__section-heading"><div><span>HỒ SƠ ỨNG TUYỂN</span><h3>CV đã lưu ({detail.data.cvs.length})</h3></div><FilePdfOutlined /></div>
              <ul>
                {detail.data.cvs.map((cv) => (
                  <li key={cv.cvId}>
                    <span className="affiliate-candidate-profile__pdf"><FilePdfOutlined /></span>
                    <span className="affiliate-candidate-profile__cv-copy"><strong>{cv.title || cv.fileName}</strong><small>{cv.status === 'ACTIVE' ? 'Sẵn sàng sử dụng' : 'Không thể sử dụng'} · đã dùng {cv.acceptedSubmissionCount} lần</small></span>
                    <div className="affiliate-candidate-profile__cv-actions">
                      <Button size="small" icon={<EyeOutlined />} onClick={() => openSigned(() => affiliateApi.libraryCvUrl(detail.data!.candidateId, cv.cvId))}>Xem CV</Button>
                      {cv.status === 'ACTIVE' && <Button size="small" type="primary" onClick={() => navigate(`/affiliate/submit-candidate?candidate=${detail.data!.candidateId}&cv=${cv.cvId}`)}>Chọn CV</Button>}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        ) : null}
      </Drawer>
    </div>
  );
};

// ─── Attributions ───────────────────────────────────────────────────────────

export const AffiliateAttributionsPage: React.FC = () => {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const list = useQuery({ queryKey: ['aff-attributions', page], queryFn: () => affiliateApi.attributions({ page, pageSize: 10 }), placeholderData: (prev) => prev });
  const attributionRuleLabel = (rule: string) => {
    const labels: Record<string, string> = {
      FIRST_TOUCH: 'Ghi nhận lượt giới thiệu đầu tiên',
      FIRST_ACCEPTED: 'Hồ sơ hợp lệ đầu tiên',
      FIRST_ACCEPTED_SUBMISSION: 'Hồ sơ được ứng viên đồng ý đầu tiên',
      CANDIDATE_CONSENT_THEN_FIRST_ACCEPTED: 'Ứng viên đồng ý và hồ sơ hợp lệ đầu tiên',
      EARLIEST_CANDIDATE_CONFIRMED_VALID_SUBMISSION: 'Xác nhận hợp lệ sớm nhất của ứng viên',
      DISPUTE_RESOLUTION: 'Kết quả giải quyết khiếu nại',
    };
    return labels[rule] ?? 'Theo quy tắc ghi nhận của hệ thống';
  };
  const columns: ColumnsType<AffiliateAttribution> = [
    { title: 'Ứng viên', key: 'c', width: 210, render: (_, r) => <PersonCell name={r.candidateName} /> },
    { title: 'Việc làm', dataIndex: 'jobTitle', width: 260, ellipsis: true, render: (v: string) => <Tooltip title={v}><span className="font-medium text-slate-900">{v}</span></Tooltip> },
    { title: 'Căn cứ ghi nhận', dataIndex: 'attributionRule', width: 230, render: (value: string) => <span className="affiliate-attribution-rule"><SafetyCertificateOutlined /><span>{attributionRuleLabel(value)}</span></span> },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      width: 150,
      render: (v: string) => {
        const st = ATTRIBUTION_STATUS[v] ?? { label: v, tone: 'neutral' as const };
        return <span className={`affiliate-attribution-state ${submissionToneClass(st.tone)}`}>{submissionStatusIcon(st.tone)}<span><strong>{st.label}</strong><small>{v === 'ACTIVE' ? 'Dùng để tính hoa hồng' : v === 'DISPUTED' ? 'Đang được HR Connect xem xét' : 'Không còn được áp dụng'}</small></span></span>;
      },
    },
    { title: 'Ghi nhận từ', dataIndex: 'establishedAt', width: 145, render: (v: string) => <span className="affiliate-library-time"><strong>{dayjs(v).fromNow()}</strong><small>{fmt(v)}</small></span> },
  ];
  return (
    <div className="affiliate-attributions-page">
      <AffiliatePageHeader
        title="Ghi nhận nguồn"
        description="Ứng viên đã xác nhận bạn là người giới thiệu."
        actions={<Button size="large" icon={<TrophyOutlined />} onClick={() => navigate('/affiliate/commissions')}>Xem hoa hồng</Button>}
      />
      <p className="m-0 mb-3.5 rounded-md border border-solid border-sky-200 bg-sky-50 px-3.5 py-3 text-[13px] leading-relaxed text-sky-900">
        Ghi nhận nguồn là bằng chứng bạn là người giới thiệu ứng viên vào job. Chỉ lượt hợp lệ đầu tiên được ghi nhận, và hoa hồng tính theo ghi nhận này. Hiện có <strong>{list.data?.totalCount ?? 0}</strong> ghi nhận.
      </p>
      <Surface>
        <Table<AffiliateAttribution>
          className="admin-soft-table affiliate-attribution-table w-full table-auto"
          rowKey="attributionId"
          columns={columns}
          dataSource={list.data?.items ?? []}
          loading={list.isFetching}
          pagination={{ current: page, pageSize: 10, total: list.data?.totalCount ?? 0, showSizeChanger: false, onChange: setPage }}
          locale={{ emptyText: <div className="py-10 text-slate-600">Chưa có ghi nhận nào. Ghi nhận được tạo sau khi ứng viên đồng ý.</div> }}
        />
      </Surface>
    </div>
  );
};
