/**
 * @file AffiliatePages.tsx
 * @description MF-02 branch B for the Affiliate: overview (profile + performance), refer a candidate
 * (new candidate with a PDF, or one from the library with an existing CV), submission history with
 * consent status and resend, candidate library and attributions. Commission/payout (MF-05) has no
 * API yet and shows an empty state.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  App as AntApp,
  Button,
  DatePicker,
  Drawer,
  Form,
  Input,
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
} from '@ant-design/icons';
import dayjs from 'dayjs';
import relativeTimePlugin from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/vi';
import { affiliateApi } from '@/services/api/mf02Api';
import { jobsApi } from '@/services/api/jobsApi';
import { getApiErrorMessage } from '@/services/apiClient';
import type { AffiliateAttribution, AffiliateSubmission, LibraryCandidate } from '@/types/api/mf02';
import { NoApiYet } from '@/features/admin-console/adminTheme';
import { FilterPills, PageHero, PersonCell, StatusDot, Surface } from '@/features/admin-console/ui';
import { ATTRIBUTION_STATUS, MAX_CV_MB, cvFileError, fileSize, submissionStatus } from './mf02Labels';
import { useOpenSignedUrl } from './CandidatePages';

dayjs.extend(relativeTimePlugin);
dayjs.locale('vi');

const keys = {
  profile: ['aff-profile'] as const,
  performance: ['aff-performance'] as const,
  submissions: ['aff-submissions'] as const,
  library: ['aff-library'] as const,
};

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
  const verified = profile.data?.status === 'ACTIVE' || Boolean(profile.data?.verifiedAt);
  const p = perf.data;
  const firstName = (profile.data?.displayName || 'bạn').trim().split(/\s+/).slice(-1)[0];

  const kpis = [
    { label: 'Đã giới thiệu', value: p?.totalSubmissions, hint: 'Tổng lượt nộp' },
    { label: 'Được chọn', value: p?.totalShortlisted, hint: 'Qua sàng lọc' },
    { label: 'Phỏng vấn', value: p?.totalInterviews, hint: 'Có lịch phỏng vấn' },
    { label: 'Đi làm', value: p?.totalPlacements, hint: `Tỉ lệ ${Math.round((p?.submissionToHireRate ?? 0) * 100)}%`, gold: true },
  ];

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[22px] bg-gradient-to-br from-violet-50 via-white to-amber-50 p-7 shadow-[0_0_0_1px_rgba(109,40,217,0.1)] sm:p-9">
        <div aria-hidden className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-violet-200/50 blur-3xl" />
        <div className="relative flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-xl">
            <h1 className="m-0 text-[30px] font-extrabold leading-tight tracking-[-0.02em] text-slate-900">Chào {firstName},</h1>
            <p className="m-0 mt-2 text-[15px] leading-relaxed text-slate-600">
              {pending.isLoading
                ? 'Đang tải...'
                : pending.data
                  ? `${pending.data} lượt giới thiệu đang chờ ứng viên xác nhận qua email.`
                  : 'Giới thiệu ứng viên phù hợp; attribution được ghi cho bạn khi ứng viên đồng ý.'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="primary" size="large" icon={<UserAddOutlined />} className="!rounded-full !px-6" onClick={() => navigate('/affiliate/submit-candidate')} disabled={!verified}>
              Giới thiệu ứng viên
            </Button>
            <Button size="large" className="!rounded-full !px-6" onClick={() => navigate('/affiliate/jobs')}>
              Xem việc làm
            </Button>
          </div>
        </div>
      </section>

      {profile.data && !verified && (
        <Alert type="warning" showIcon message="Tài khoản Affiliate chưa được duyệt" description="Bạn chỉ giới thiệu được ứng viên sau khi HR Connect duyệt hồ sơ đăng ký." />
      )}

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="admin-surface p-5">
            <span className="block text-[13px] font-medium text-slate-600">{k.label}</span>
            <span className={`mt-1 block text-[28px] font-bold tabular-nums ${k.gold ? 'text-[color:var(--affiliate-gold)]' : 'text-slate-900'}`}>
              {perf.isLoading ? <Skeleton.Input active size="small" /> : k.value ?? 0}
            </span>
            <span className="block text-xs text-slate-500">{k.hint}</span>
          </div>
        ))}
      </div>

      <Surface className="p-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="m-0 text-base font-bold text-slate-900">Lượt giới thiệu gần đây</h2>
          <Button type="link" className="!px-0" onClick={() => navigate('/affiliate/submissions')}>
            Xem tất cả
          </Button>
        </div>
        {recent.isLoading ? (
          <Skeleton active paragraph={{ rows: 3 }} />
        ) : (recent.data ?? []).length === 0 ? (
          <p className="m-0 text-sm text-slate-600">Chưa có lượt giới thiệu nào.</p>
        ) : (
          <ul className="m-0 list-none space-y-1 p-0">
            {recent.data!.map((s) => {
              const st = submissionStatus(s.status);
              return (
                <li key={s.submissionId} className="flex items-center gap-3 rounded-xl px-2 py-2.5 hover:bg-slate-50">
                  <span className="min-w-0 flex-1">
                    <PersonCell name={s.candidateName} secondary={s.jobTitle} size={34} />
                  </span>
                  <StatusDot tone={st.tone}>{st.label}</StatusDot>
                  <span className="hidden w-24 text-right text-xs text-slate-500 sm:block">{dayjs(s.submittedAt).fromNow()}</span>
                </li>
              );
            })}
          </ul>
        )}
      </Surface>
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
          title={d.emailDeliveryStatus === 'FAILED' ? 'Đã lưu hồ sơ, đang chờ gửi lại email' : 'Đã gửi hồ sơ và đang chờ Candidate xác nhận'}
          subTitle={`Submission đang ở trạng thái chờ xác nhận${d.consentExpiresAt ? ` đến ${fmt(d.consentExpiresAt)}` : ''}. Application, Attribution và AI chưa được tạo cho đến khi Candidate đồng ý.`}
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
    <div>
      <PageHero
        eyebrow="Giới thiệu"
        title="Giới thiệu ứng viên"
        description="Candidate sẽ nhận yêu cầu xác nhận. Application, Attribution và chấm điểm AI chỉ bắt đầu sau khi Candidate đồng ý."
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
                message="Tin bạn chọn không nhận giới thiệu từ Affiliate"
                description="Loại dịch vụ của tin này chỉ nhận ứng viên tự nộp. Hãy chọn một tin trong danh sách bên dưới."
              />
            )}
            {presetCvRejected && (
              <Alert
                type="warning"
                showIcon
                closable
                onClose={() => setPresetCvRejected(false)}
                message="CV đã chọn không còn được phép tái sử dụng"
                description="Hãy chọn một CV ACTIVE khác trong kho của Candidate."
              />
            )}

            <Surface className="p-6">
              <h2 className="m-0 mb-4 text-base font-semibold text-slate-900">1. Việc làm</h2>
              <Form.Item name="jobId" label="Tin tuyển dụng" rules={[{ required: true, message: 'Chọn tin tuyển dụng.' }]} className="mb-0">
                <Select
                  size="large"
                  showSearch
                  optionFilterProp="label"
                  loading={jobs.isLoading}
                  placeholder="Chọn tin bạn muốn giới thiệu ứng viên vào"
                  options={(jobs.data?.items ?? []).map((j) => ({ value: j.jobId, label: `${j.title} — ${j.companyName ?? ''}` }))}
                />
              </Form.Item>
            </Surface>

            <Surface className="p-6">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h2 className="m-0 text-base font-semibold text-slate-900">2. Ứng viên</h2>
                <Form.Item name="mode" noStyle>
                  <Segmented
                    options={[
                      { value: 'new', label: 'Ứng viên mới' },
                      { value: 'library', label: 'Từ kho của tôi' },
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
                      label="Email"
                      extra="Bắt buộc: ứng viên xác nhận qua email này."
                      rules={[{ required: true, message: 'Nhập email ứng viên.' }, { type: 'email', message: 'Email không hợp lệ.' }]}
                    >
                      <Input size="large" />
                    </Form.Item>
                    <Form.Item name="phone" label="Điện thoại" rules={[{ pattern: /^[0-9+() \-.]{8,20}$/, message: 'Số điện thoại không hợp lệ.' }]}>
                      <Input size="large" />
                    </Form.Item>
                  </div>
                  <div className="mb-1 text-sm text-slate-900">CV (PDF)</div>
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
                    className="!rounded-xl"
                  >
                    {file ? (
                      <p className="m-0 py-1 text-sm text-slate-800">
                        <FilePdfOutlined className="mr-1.5 text-red-700" aria-hidden />
                        {file.name} · {fileSize(file.size)} <span className="text-slate-500">(bấm để đổi)</span>
                      </p>
                    ) : (
                      <>
                        <p className="ant-upload-drag-icon !mb-1">
                          <InboxOutlined className="!text-[color:var(--console-accent)]" />
                        </p>
                        <p className="ant-upload-hint">PDF, tối đa {MAX_CV_MB}MB.</p>
                      </>
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
                      notFoundContent={library.isFetching ? 'Đang tìm...' : 'Kho trống. Giới thiệu “Ứng viên mới” để thêm vào kho.'}
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
                            label: `${cv.title || cv.fileName} · ${cv.status}`,
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
              <h2 className="m-0 mb-4 text-base font-semibold text-slate-900">3. Ghi chú cho nhà tuyển dụng</h2>
              <Form.Item name="note" className="mb-0" rules={[{ max: 2000, message: 'Tối đa 2000 ký tự.' }]}>
                <Input.TextArea rows={3} showCount maxLength={2000} placeholder="Điểm mạnh của ứng viên, mức lương mong muốn, thời gian có thể đi làm…" />
              </Form.Item>
            </Surface>
          </div>

          <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
            <Surface className="p-5">
              <div className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Giới thiệu vào</div>
              {selectedJob ? (
                <div className="mt-2">
                  <div className="font-semibold text-slate-900">{selectedJob.title}</div>
                  <div className="text-[13px] text-slate-600">{selectedJob.companyName}</div>
                  <div className="text-[13px] text-slate-600">{selectedJob.location}</div>
                </div>
              ) : (
                <p className="m-0 mt-2 text-sm text-slate-500">Chưa chọn tin.</p>
              )}
              <ul className="m-0 mt-4 space-y-1.5 pl-4 text-[13px] text-slate-600">
                <li>Candidate nhận yêu cầu xác nhận theo thời hạn backend trả về.</li>
                <li>Attribution ghi cho bạn khi ứng viên đồng ý.</li>
                <li>Ứng viên đã có hồ sơ trong tin này sẽ bị chặn trùng.</li>
              </ul>
            </Surface>
            <Button type="primary" size="large" block htmlType="submit" icon={<SendOutlined />} loading={submit.isPending}>
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

export const AffiliateSubmissionsPage: React.FC = () => {
  const { message } = AntApp.useApp();
  const queryClient = useQueryClient();
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
  const progressOf = (id: string) => progress.data?.items.find((p) => p.submissionId === id)?.progressStatus;

  const resend = useMutation({
    mutationFn: (id: string) => affiliateApi.resendConsent(id),
    onSuccess: (res) => {
      message.success(res.message || 'Đã gửi lại email xác nhận.');
      queryClient.invalidateQueries({ queryKey: keys.submissions });
    },
    onError: (err) => message.error(getApiErrorMessage(err, 'Chưa gửi lại được email.')),
  });

  const columns: ColumnsType<AffiliateSubmission> = [
    { title: 'Ứng viên', key: 'c', render: (_, r) => <PersonCell name={r.candidateName} /> },
    { title: 'Việc làm', dataIndex: 'jobTitle', render: (v: string) => <span className="font-medium text-slate-900">{v}</span> },
    {
      title: 'Trạng thái',
      key: 's',
      width: 230,
      render: (_, r) => {
        const st = submissionStatus(r.status);
        const prog = r.status === 'ACCEPTED' ? progressOf(r.submissionId) : undefined;
        return (
          <div>
            <Tooltip title={st.hint}>
              <span>
                <StatusDot tone={st.tone}>{st.label}</StatusDot>
              </span>
            </Tooltip>
            {r.status === 'PENDING_CONSENT' && r.consentExpiresAt && (
              <div className="mt-0.5 text-xs text-slate-500">Hết hạn {dayjs(r.consentExpiresAt).fromNow()}</div>
            )}
            {prog && <div className="mt-0.5 text-xs text-slate-600">Tiến độ: {prog}</div>}
            {r.reason && <div className="mt-0.5 text-xs text-slate-500">{r.reason}</div>}
          </div>
        );
      },
    },
    { title: 'Gửi lúc', dataIndex: 'submittedAt', width: 150, render: (v: string) => <span className="tabular-nums">{fmt(v)}</span> },
    {
      title: <span className="sr-only">Thao tác</span>,
      key: 'a',
      width: 150,
      render: (_, r) =>
        r.status === 'PENDING_CONSENT' ? (
          <Button
            size="small"
            icon={<MailOutlined />}
            loading={resend.isPending && resend.variables === r.submissionId}
            onClick={() => resend.mutate(r.submissionId)}
          >
            Gửi lại email
          </Button>
        ) : null,
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
    <div>
      <PageHero
        eyebrow="Giới thiệu"
        title="Lượt giới thiệu"
        description="Mọi ứng viên bạn đã giới thiệu, trạng thái xác nhận và tiến độ tuyển dụng sau khi ứng viên đồng ý."
        actions={
          <Button size="large" icon={<ReloadOutlined />} onClick={() => list.refetch()}>
            Tải lại
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
              placeholder="Tất cả việc làm"
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
            className="admin-soft-table"
            scroll={{ x: 'max-content' }}
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
            locale={{ emptyText: <div className="py-10 text-slate-600">Chưa có lượt giới thiệu nào.</div> }}
          />
        )}
      </Surface>
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
    { title: 'Ứng viên', key: 'c', render: (_, r) => <PersonCell name={r.fullName} secondary={r.email ?? r.phone} /> },
    { title: 'CV', dataIndex: 'activeCvCount', width: 80 },
    { title: 'Đã nhận', dataIndex: 'acceptedSubmissionCount', width: 100 },
    { title: 'Lần cuối giới thiệu', dataIndex: 'lastSubmittedAt', width: 170, render: (v: string | null) => fmt(v) },
  ];

  return (
    <div>
      <PageHero eyebrow="Giới thiệu" title="Kho ứng viên" description="Ứng viên và CV bạn đã từng giới thiệu. Dùng lại để giới thiệu vào tin khác mà không phải tải CV lần nữa." />
      <Surface>
        <div className="px-5 pb-3 pt-5">
          <Input
            size="large"
            allowClear
            prefix={<SearchOutlined className="text-slate-400" />}
            placeholder="Tìm theo tên, email, số điện thoại — nhấn Enter"
            className="w-full sm:max-w-sm"
            onPressEnter={(e) => {
              setPage(1);
              setSearch((e.target as HTMLInputElement).value.trim());
            }}
            onChange={(e) => !e.target.value && search && setSearch('')}
          />
        </div>
        <Table<LibraryCandidate>
          className="admin-soft-table"
          scroll={{ x: 'max-content' }}
          rowKey="candidateId"
          columns={columns}
          dataSource={list.data?.items ?? []}
          loading={list.isFetching}
          onRow={(r) => ({ onClick: () => setOpenId(r.candidateId), onKeyDown: (e) => e.key === 'Enter' && setOpenId(r.candidateId), tabIndex: 0, className: 'cursor-pointer' })}
          pagination={{ current: page, pageSize: 10, total: list.data?.total ?? 0, showSizeChanger: false, onChange: setPage }}
          locale={{ emptyText: <div className="py-10 text-slate-600">Kho trống. Ứng viên bạn giới thiệu sẽ được lưu ở đây.</div> }}
        />
      </Surface>

      <Drawer open={Boolean(openId)} onClose={() => setOpenId(undefined)} width="min(560px, 100vw)" title="Ứng viên trong kho" destroyOnClose>
        {detail.isLoading ? (
          <Skeleton active paragraph={{ rows: 6 }} />
        ) : detail.data ? (
          <div className="space-y-4">
            <PersonCell name={detail.data.fullName} secondary={[detail.data.email, detail.data.phone].filter(Boolean).join(' · ')} size={48} />
            <Button type="primary" icon={<UserAddOutlined />} onClick={() => navigate(`/affiliate/submit-candidate?candidate=${detail.data!.candidateId}`)}>
              Giới thiệu vào việc làm
            </Button>
            <div>
              <div className="mb-2 text-sm font-semibold text-slate-900">CV ({detail.data.cvs.length})</div>
              <ul className="m-0 list-none space-y-2 p-0">
                {detail.data.cvs.map((cv) => (
                  <li key={cv.cvId} className="flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-2.5">
                    <FilePdfOutlined className="text-xl text-red-700" aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-slate-900">{cv.title || cv.fileName}</span>
                      <span className="block text-xs text-slate-500">
                        {cv.status} · dùng {cv.acceptedSubmissionCount} lần
                      </span>
                    </span>
                    <Button size="small" icon={<EyeOutlined />} onClick={() => openSigned(() => affiliateApi.libraryCvUrl(detail.data!.candidateId, cv.cvId))}>
                      Xem
                    </Button>
                    {cv.status === 'ACTIVE' && (
                      <Button
                        size="small"
                        type="primary"
                        onClick={() => navigate(`/affiliate/submit-candidate?candidate=${detail.data!.candidateId}&cv=${cv.cvId}`)}
                      >
                        Dùng CV này
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : null}
      </Drawer>
    </div>
  );
};

// ─── Attributions ───────────────────────────────────────────────────────────

export const AffiliateAttributionsPage: React.FC = () => {
  const [page, setPage] = useState(1);
  const list = useQuery({ queryKey: ['aff-attributions', page], queryFn: () => affiliateApi.attributions({ page, pageSize: 10 }), placeholderData: (prev) => prev });
  const columns: ColumnsType<AffiliateAttribution> = [
    { title: 'Ứng viên', key: 'c', render: (_, r) => <PersonCell name={r.candidateName} /> },
    { title: 'Việc làm', dataIndex: 'jobTitle', render: (v: string) => <span className="font-medium text-slate-900">{v}</span> },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      width: 170,
      render: (v: string) => {
        const st = ATTRIBUTION_STATUS[v] ?? { label: v, tone: 'neutral' as const };
        return <StatusDot tone={st.tone}>{st.label}</StatusDot>;
      },
    },
    { title: 'Ghi nhận lúc', dataIndex: 'establishedAt', width: 160, render: (v: string) => <span className="tabular-nums">{fmt(v)}</span> },
  ];
  return (
    <div>
      <PageHero
        eyebrow="Ghi nhận"
        title="Attribution"
        description="Mỗi dòng là một ứng viên được ghi nhận là do bạn giới thiệu (lúc ứng viên đồng ý). Đây là căn cứ tính hoa hồng ở MF-05."
      />
      <Surface>
        <Table<AffiliateAttribution>
          className="admin-soft-table"
          scroll={{ x: 'max-content' }}
          rowKey="attributionId"
          columns={columns}
          dataSource={list.data?.items ?? []}
          loading={list.isFetching}
          pagination={{ current: page, pageSize: 10, total: list.data?.totalCount ?? 0, showSizeChanger: false, onChange: setPage }}
          locale={{ emptyText: <div className="py-10 text-slate-600">Chưa có attribution. Attribution được ghi khi ứng viên đồng ý lượt giới thiệu.</div> }}
        />
      </Surface>
    </div>
  );
};

export const AffiliateCommissionsPlaceholder: React.FC = () => (
  <div>
    <PageHero eyebrow="Chưa có API" title="Hoa hồng & chi trả" description="Hoa hồng theo mốc 15, 30, 60 ngày sau khi ứng viên đi làm, và lịch sử chi trả." />
    <NoApiYet feature="Hoa hồng & chi trả" detail="Thuộc MF-05; backend chưa có endpoint xem hoa hồng của Affiliate." />
  </div>
);
