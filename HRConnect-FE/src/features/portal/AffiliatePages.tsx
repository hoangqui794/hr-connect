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
  CheckCircleOutlined,
  ClockCircleOutlined,
  CalendarOutlined,
  EnvironmentOutlined,
  RightOutlined,
  TeamOutlined,
  TrophyOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import relativeTimePlugin from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/vi';
import { affiliateApi } from '@/services/api/mf02Api';
import { jobsApi } from '@/services/api/jobsApi';
import { getApiError, getApiErrorMessage } from '@/services/apiClient';
import { useAuthStore } from '@/stores/authStore';
import type { AffiliateAttribution, AffiliateSubmission, LibraryCandidate } from '@/types/api/mf02';
import { FilterPills, PersonCell, StatusDot, Surface } from '@/features/admin-console/ui';
import { ATTRIBUTION_STATUS, MAX_CV_MB, cvFileError, fileSize, submissionStatus } from './mf02Labels';
import { useOpenSignedUrl } from './CandidatePages';
import {
  AffiliateFlowSteps,
  AffiliatePageHeader,
  AffiliateSectionHeading,
  AffiliateStatCard,
} from './affiliate/AffiliateUi';

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
  const opportunities = useQuery({
    queryKey: ['aff-jobs', 'dashboard'],
    queryFn: async () => (await jobsApi.search({ page: 1, pageSize: 3 })).items,
  });
  const verified = profile.data?.status === 'ACTIVE' || Boolean(profile.data?.verifiedAt);
  const p = perf.data;

  const kpis = [
    { label: 'Lượt giới thiệu', value: p?.totalSubmissions, hint: 'Tổng hồ sơ bạn đã gửi', icon: <SendOutlined />, color: '#5b3fd6', soft: '#f1efff' },
    { label: 'Được doanh nghiệp chọn', value: p?.totalShortlisted, hint: 'Hồ sơ đã qua sàng lọc', icon: <CheckCircleOutlined />, color: '#087a55', soft: '#eafaf3' },
    { label: 'Đã vào phỏng vấn', value: p?.totalInterviews, hint: 'Ứng viên có lịch phỏng vấn', icon: <TeamOutlined />, color: '#2563eb', soft: '#eef4ff' },
    { label: 'Tuyển dụng thành công', value: p?.totalPlacements, hint: `Tỉ lệ thành công ${Math.round((p?.submissionToHireRate ?? 0) * 100)}%`, icon: <TrophyOutlined />, color: '#a9550a', soft: '#fff6e8' },
  ];

  const total = Math.max(1, p?.totalSubmissions ?? 0);
  const chart = [
    { label: 'Đã được ghi nhận', value: p?.totalShortlisted ?? 0, color: '#18a36f' },
    { label: 'Đang xử lý', value: Math.max(0, (p?.totalSubmissions ?? 0) - (p?.totalShortlisted ?? 0)), color: '#6c4df6' },
    { label: 'Không phù hợp', value: Math.max(0, total - (p?.totalShortlisted ?? 0) - Math.max(0, (p?.totalSubmissions ?? 0) - (p?.totalShortlisted ?? 0))), color: '#d8deea' },
  ];

  return (
    <div className="affiliate-dashboard space-y-5">
      <AffiliatePageHeader
        title="Tổng quan"
        description="Chào mừng bạn trở lại! Cùng tạo thêm nhiều cơ hội việc làm chất lượng nhé."
        actions={
          <Button className="affiliate-month-button" icon={<CalendarOutlined />}>Tháng {dayjs().format('M/YYYY')}</Button>
        }
      />

      {profile.data && !verified && (
        <Alert type="warning" showIcon message="Hồ sơ cộng tác viên đang chờ duyệt" description="Bạn có thể xem cơ hội tuyển dụng ngay. Chức năng giới thiệu ứng viên sẽ mở sau khi HR Connect duyệt hồ sơ." />
      )}

      <div className="affiliate-kpi-grid">
        {kpis.map((k) => (
          <AffiliateStatCard
            key={k.label}
            label={k.label}
            value={perf.isLoading ? <Skeleton.Input active size="small" /> : k.value ?? 0}
            hint={k.hint}
            icon={k.icon}
            color={k.color}
            softColor={k.soft}
          />
        ))}
      </div>

      {pending.data ? (
        <section className="affiliate-action-panel flex flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <span className="affiliate-stat-card__icon !bg-white !text-amber-700"><ClockCircleOutlined /></span>
            <div>
              <h2 className="m-0 text-[16px] font-bold text-slate-900">Việc cần bạn theo dõi</h2>
              <p className="m-0 mt-1 text-sm leading-relaxed text-slate-600">Có {pending.data} lượt giới thiệu đang chờ ứng viên xác nhận qua email.</p>
            </div>
          </div>
          <Button onClick={() => navigate('/affiliate/submissions?status=PENDING_CONSENT')}>Xem và nhắc xác nhận</Button>
        </section>
      ) : null}

      <div className="affiliate-dashboard-grid">
        <Surface className="affiliate-task-card p-5">
          <AffiliateSectionHeading
            title="Việc cần bạn xử lý"
            description="Các hồ sơ cần chú ý để không bỏ lỡ thời hạn."
            action={<Button type="link" className="!px-0" onClick={() => navigate('/affiliate/submissions')}>Xem tất cả <RightOutlined /></Button>}
          />
          {recent.isLoading ? <Skeleton active paragraph={{ rows: 4 }} /> : (
            <ul className="affiliate-task-list">
              {(recent.data ?? []).slice(0, 4).map((s, index) => {
                const st = submissionStatus(s.status);
                return (
                  <li key={s.submissionId}>
                    <span className={`affiliate-task-icon tone-${index % 4}`}><FilePdfOutlined /></span>
                    <button type="button" onClick={() => navigate(`/affiliate/submissions/${s.submissionId}`)}>
                      <strong>{s.candidateName}</strong>
                      <small>Vị trí: {s.jobTitle}</small>
                    </button>
                    <span className="affiliate-task-meta"><StatusDot tone={st.tone}>{st.label}</StatusDot><small>{dayjs(s.submittedAt).fromNow()}</small></span>
                  </li>
                );
              })}
            </ul>
          )}
        </Surface>

        <Surface className="affiliate-progress-card p-5">
          <AffiliateSectionHeading title="Tiến độ giới thiệu trong tháng" />
          <div className="affiliate-progress-content">
            <div className="affiliate-donut" style={{ '--donut-value': `${Math.min(100, Math.round(((p?.totalShortlisted ?? 0) / total) * 100))}%` } as React.CSSProperties}>
              <span><strong>{p?.totalSubmissions ?? 0}</strong><small>lượt giới thiệu</small></span>
            </div>
            <ul>
              {chart.map((item) => <li key={item.label}><i style={{ background: item.color }} /><span>{item.label}</span><strong>{item.value}</strong></li>)}
            </ul>
          </div>
          <div className="affiliate-thankyou"><CheckCircleOutlined /><span><strong>Cảm ơn bạn đã đồng hành!</strong><small>Mỗi lượt giới thiệu là một cơ hội thay đổi sự nghiệp.</small></span></div>
        </Surface>
      </div>

      <section>
        <AffiliateSectionHeading
          title="Cơ hội tuyển dụng nổi bật"
          description="Những vị trí đang ưu tiên nhận ứng viên từ cộng tác viên."
          action={<Button type="link" className="!px-0" onClick={() => navigate('/affiliate/jobs')}>Xem tất cả <RightOutlined /></Button>}
        />
        <div className="affiliate-opportunity-grid">
          {(opportunities.data ?? []).map((job) => (
            <article key={job.jobId} className="affiliate-opportunity-card">
              <div className="affiliate-opportunity-card__head"><span><UserAddOutlined /></span><button type="button" aria-label={`Lưu ${job.title}`}>♡</button></div>
              <h3>{job.title}</h3>
              <p>{job.companyName || 'Doanh nghiệp tuyển dụng'}</p>
              <div className="affiliate-opportunity-meta"><span><EnvironmentOutlined /> {job.location || 'Toàn quốc'}</span></div>
              <strong>Hoa hồng theo chính sách</strong>
              <Button type="primary" block onClick={() => navigate(`/affiliate/submit-candidate?job=${job.jobId}`)} disabled={!verified}>Giới thiệu ngay <RightOutlined /></Button>
            </article>
          ))}
          {opportunities.isLoading && [0, 1, 2].map((item) => <Surface key={item} className="p-5"><Skeleton active /></Surface>)}
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
      <AffiliateFlowSteps active={jobId ? (mode === 'library' ? (candidateId ? 3 : 2) : 2) : 1} />
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
                    <Form.Item name="phone" label="Số điện thoại của ứng viên" rules={[{ pattern: /^[0-9+() \-.]{8,20}$/, message: 'Số điện thoại không hợp lệ.' }]}>
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
                        <p className="ant-upload-text !mb-1 !text-sm !font-semibold">Kéo thả CV vào đây hoặc bấm để chọn file</p>
                        <p className="ant-upload-hint">Chỉ nhận PDF, dung lượng tối đa {MAX_CV_MB}MB.</p>
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
              <h2 className="m-0 mb-1 text-base font-semibold text-slate-900">3. Thông tin bổ sung</h2>
              <p className="mb-4 mt-0 text-[13px] text-slate-600">Không bắt buộc. Nêu ngắn gọn điểm mạnh giúp doanh nghiệp hiểu ứng viên nhanh hơn.</p>
              <Form.Item name="note" className="mb-0" rules={[{ max: 2000, message: 'Tối đa 2000 ký tự.' }]}>
                <Input.TextArea rows={3} showCount maxLength={2000} placeholder="Ví dụ: 3 năm kinh nghiệm Java, có thể nhận việc sau 30 ngày, mong muốn làm việc tại Hà Nội…" />
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
                <p className="m-0 mt-2 text-sm text-slate-500">Chưa chọn vị trí tuyển dụng.</p>
              )}
              <ul className="m-0 mt-4 space-y-1.5 pl-4 text-[13px] text-slate-600">
                <li>Ứng viên sẽ nhận email để đồng ý cho bạn gửi hồ sơ.</li>
                <li>Quyền ghi nhận được tạo ngay sau khi ứng viên xác nhận.</li>
                <li>Hệ thống tự cảnh báo nếu ứng viên đã có hồ sơ cho vị trí này.</li>
              </ul>
            </Surface>
            <Button type="primary" size="large" block htmlType="submit" icon={<SendOutlined />} loading={submit.isPending}>
              Gửi yêu cầu xác nhận
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
    { title: 'Thời gian gửi', dataIndex: 'submittedAt', width: 150, render: (v: string) => <span className="tabular-nums">{fmt(v)}</span> },
    {
      title: <span className="sr-only">Thao tác</span>,
      key: 'a',
      width: 235,
      render: (_, r) => (
        <div className="flex gap-2">
          <Button size="small" onClick={() => navigate(`/affiliate/submissions/${r.submissionId}`)}>
            Xem chi tiết
          </Button>
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
  return (
    <div className="space-y-5">
      <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/affiliate/submissions')}>
        Lượt giới thiệu
      </Button>
      <AffiliatePageHeader
        title={submission.candidateName}
        description={`${submission.jobTitle} — ${submission.companyName}`}
        actions={<StatusDot tone={status.tone}>{status.label}</StatusDot>}
      />
      <Surface className="p-6">
        <dl className="grid grid-cols-1 gap-5 text-sm sm:grid-cols-2 lg:grid-cols-3">
          {[
            ['Email ứng viên', submission.candidateEmail || '—'],
            ['Số điện thoại ứng viên', submission.candidatePhone || '—'],
            ['CV đã gửi', submission.cvTitle || submission.cvFileName || '—'],
            ['Thời gian gửi hồ sơ', fmt(submission.submittedAt)],
            ['Thời gian gửi email xác nhận', fmt(submission.consentEmailSentAt)],
            ['Hạn ứng viên xác nhận', fmt(submission.consentExpiresAt)],
            ['Thời gian ứng viên phản hồi', fmt(submission.consentRespondedAt)],
            ['Hồ sơ ứng tuyển', submission.applicationId ? 'Đã được tạo' : 'Chưa được tạo'],
            ['Quyền ghi nhận', submission.attributionId ? 'Đã ghi nhận cho bạn' : 'Chưa được ghi nhận'],
          ].map(([label, value]) => (
            <div key={label}>
              <dt className="text-slate-500">{label}</dt>
              <dd className="m-0 mt-1 break-words font-medium text-slate-900">{value}</dd>
            </div>
          ))}
        </dl>
        {submission.reason && <Alert className="mt-5" type="info" showIcon message="Thông tin xử lý" description={submission.reason} />}
        {submission.status === 'PENDING_CONSENT' && (
          <Alert
            className="mt-5"
            type="warning"
            showIcon
            message="Đang chờ ứng viên xác nhận"
            description="Hồ sơ ứng tuyển và quyền ghi nhận của bạn chỉ được tạo sau khi ứng viên xác nhận cho phép giới thiệu vào vị trí này."
          />
        )}
        {resend.data && (
          <Alert
            className="mt-5"
            type={resend.data.emailDeliveryStatus === 'FAILED' ? 'warning' : 'success'}
            showIcon
            message={resend.data.message}
            description={`Hạn xác nhận mới: ${fmt(resend.data.expiresAt)} · Đã gửi ${resend.data.emailSendCount} lần.`}
          />
        )}
        {submission.status === 'PENDING_CONSENT' && canResend && (
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Button
              type="primary"
              icon={<MailOutlined />}
              loading={resend.isPending}
              disabled={resentInThisView || retryRemaining > 0}
              onClick={() => resend.mutate()}
            >
              {retryRemaining > 0
                ? `Thử lại sau ${retryRemaining} giây`
                : resentInThisView
                  ? 'Đã gửi lại yêu cầu'
                  : 'Gửi lại yêu cầu xác nhận'}
            </Button>
            <span className="text-xs text-slate-500">Liên kết xác nhận cũ sẽ bị vô hiệu hóa.</span>
          </div>
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
    { title: 'CV có thể dùng', dataIndex: 'activeCvCount', width: 110 },
    { title: 'Lượt đã xác nhận', dataIndex: 'acceptedSubmissionCount', width: 130 },
    { title: 'Lần cuối giới thiệu', dataIndex: 'lastSubmittedAt', width: 170, render: (v: string | null) => fmt(v) },
  ];

  return (
    <div>
      <AffiliatePageHeader title="Kho ứng viên" description="Lưu các ứng viên bạn đã giới thiệu để theo dõi CV và dùng lại hồ sơ cho cơ hội phù hợp khác." />
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

      <Drawer open={Boolean(openId)} onClose={() => setOpenId(undefined)} width="min(560px, 100vw)" title="Ứng viên trong kho" destroyOnHidden>
        {detail.isLoading ? (
          <Skeleton active paragraph={{ rows: 6 }} />
        ) : detail.data ? (
          <div className="space-y-4">
            <PersonCell name={detail.data.fullName} secondary={[detail.data.email, detail.data.phone].filter(Boolean).join(' · ')} size={48} />
            <Button type="primary" icon={<UserAddOutlined />} onClick={() => navigate(`/affiliate/submit-candidate?candidate=${detail.data!.candidateId}`)}>
              Giới thiệu vào cơ hội mới
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
                        {cv.status === 'ACTIVE' ? 'Có thể sử dụng' : 'Không thể sử dụng'} · đã dùng {cv.acceptedSubmissionCount} lần
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
    { title: 'Thời gian ghi nhận', dataIndex: 'establishedAt', width: 170, render: (v: string) => <span className="tabular-nums">{fmt(v)}</span> },
  ];
  return (
    <div>
      <AffiliatePageHeader
        title="Quyền ghi nhận"
        description="Danh sách ứng viên đã xác nhận bạn là người giới thiệu. Đây là căn cứ để theo dõi và tính hoa hồng khi tuyển dụng thành công."
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
          locale={{ emptyText: <div className="py-10 text-slate-600">Chưa có quyền ghi nhận nào. Quyền này được tạo sau khi ứng viên đồng ý yêu cầu xác nhận.</div> }}
        />
      </Surface>
    </div>
  );
};
