/**
 * @file CandidatePages.tsx
 * @description MF-02 branch A for the Candidate: overview, my applications (stage tracker from
 * GET /candidates/applications) and the CV vault (GET/POST/PATCH/DELETE /candidates/cv).
 * Applying itself happens on the job page through <ApplyButton />.
 */
import React, { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, App as AntApp, Button, DatePicker, Input, Modal, Pagination, Popconfirm, Select, Skeleton, Tooltip, Upload } from 'antd';
import {
  CheckCircleFilled,
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  FilePdfOutlined,
  InboxOutlined,
  SearchOutlined,
  ArrowLeftOutlined,
  StarFilled,
  StarOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import relativeTimePlugin from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/vi';
import { candidateApplicationsApi, candidateCvApi } from '@/services/api/mf02Api';
import { getApiErrorMessage } from '@/services/apiClient';
import { useAuthStore } from '@/stores/authStore';
import type { CandidateApplication } from '@/types/api/mf02';
import { PageHero, StatusDot, Surface } from '@/features/admin-console/ui';
import { CANDIDATE_STEPS, MAX_CV_MB, candidateStage, cvFileError, fileSize } from './mf02Labels';

dayjs.extend(relativeTimePlugin);
dayjs.locale('vi');

export const candidateKeys = {
  cvs: ['candidate-cvs'] as const,
  applications: ['candidate-applications'] as const,
  applicationDetail: (applicationId: string) => ['candidate-applications', applicationId] as const,
};

export const useCandidateCvs = () => useQuery({ queryKey: candidateKeys.cvs, queryFn: () => candidateCvApi.list() });
const useMyApplications = () =>
  useQuery({ queryKey: [...candidateKeys.applications, 'overview'], queryFn: () => candidateApplicationsApi.list({ page: 1, pageSize: 50 }) });

/** Opens a signed CV link in a new tab (tab opened first so popup blockers allow it). */
export const useOpenSignedUrl = () => {
  const { message } = AntApp.useApp();
  return async (getUrl: () => Promise<{ downloadUrl: string }>) => {
    const tab = window.open('', '_blank');
    if (tab) tab.opener = null;
    try {
      const { downloadUrl } = await getUrl();
      if (tab) tab.location.href = downloadUrl;
      else window.location.href = downloadUrl;
    } catch (err) {
      tab?.close();
      message.error(getApiErrorMessage(err, 'Không mở được CV.'));
    }
  };
};

// ─── Stage tracker ──────────────────────────────────────────────────────────

const StageTracker: React.FC<{ status: string }> = ({ status }) => {
  const st = candidateStage(status);
  return (
    <ol className="m-0 flex list-none items-center gap-1 p-0" aria-label={`Tiến độ: ${st.label}`}>
      {CANDIDATE_STEPS.map((label, i) => {
        const reached = i <= st.step;
        const color = st.closed && i === st.step && st.tone !== 'success' ? 'bg-slate-400' : reached ? 'bg-[color:var(--console-accent)]' : 'bg-slate-200';
        return (
          <li key={label} className="flex flex-1 flex-col gap-1">
            <span className={`h-1.5 rounded-full ${color}`} aria-hidden />
            <span className={`hidden text-[11px] sm:block ${reached ? 'font-medium text-slate-700' : 'text-slate-400'}`}>{label}</span>
          </li>
        );
      })}
    </ol>
  );
};

const ApplicationCard: React.FC<{ a: CandidateApplication }> = ({ a }) => {
  const navigate = useNavigate();
  const st = candidateStage(a.status);
  return (
    <article className="admin-surface flex flex-col gap-3 p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[16px] font-semibold leading-snug text-slate-900">{a.jobTitle}</div>
          <div className="text-[13px] text-slate-600">{a.companyName}</div>
        </div>
        <StatusDot tone={st.tone}>{st.label}</StatusDot>
      </div>
      <StageTracker status={a.status} />
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
        <span>Nộp {dayjs(a.appliedAt).fromNow()}</span>
        {a.cvTitle && (
          <span className="inline-flex items-center gap-1">
            <FilePdfOutlined aria-hidden /> {a.cvTitle}
          </span>
        )}
      </div>
      <div>
        <Button type="link" className="!h-auto !p-0" onClick={() => navigate(`/candidate/applications/${a.applicationId}`)}>
          Xem chi tiết
        </Button>
      </div>
    </article>
  );
};

// ─── Overview ───────────────────────────────────────────────────────────────

export const CandidateHomePage: React.FC = () => {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const apps = useMyApplications();
  const cvs = useCandidateCvs();
  const items = apps.data?.items ?? [];
  const active = items.filter((a) => !candidateStage(a.status).closed);
  const interviewing = items.filter((a) => a.status === 'INTERVIEW' || a.status === 'SHORTLISTED').length;
  const firstName = (user?.name || 'bạn').trim().split(/\s+/).slice(-1)[0];

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[22px] bg-gradient-to-br from-teal-50 via-white to-emerald-50 p-7 shadow-[0_0_0_1px_rgba(15,118,110,0.1)] sm:p-9">
        <div aria-hidden className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-teal-200/50 blur-3xl" />
        <div className="relative">
          <h1 className="m-0 text-[30px] font-extrabold leading-tight tracking-[-0.02em] text-slate-900">Chào {firstName},</h1>
          <p className="m-0 mt-2 max-w-xl text-[15px] leading-relaxed text-slate-600">
            {apps.isLoading
              ? 'Đang tải đơn ứng tuyển của bạn...'
              : items.length === 0
                ? 'Bạn chưa ứng tuyển công việc nào. Tìm việc phù hợp và ứng tuyển chỉ với một CV.'
                : `Bạn có ${active.length} đơn đang được xử lý${interviewing ? `, trong đó ${interviewing} đơn đã được chọn hoặc đang phỏng vấn` : ''}.`}
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <Button type="primary" size="large" icon={<SearchOutlined />} className="!rounded-full !px-6" onClick={() => navigate('/candidate/jobs')}>
              Tìm việc làm
            </Button>
            <Button size="large" className="!rounded-full !px-6" onClick={() => navigate('/candidate/cvs')}>
              Quản lý CV
            </Button>
          </div>
        </div>
      </section>

      {!cvs.isLoading && (cvs.data ?? []).length === 0 && (
        <Alert
          type="info"
          showIcon
          message="Bạn chưa có CV nào trong kho"
          description="Tải một CV dạng PDF lên trước để ứng tuyển nhanh hơn."
          action={<Button onClick={() => navigate('/candidate/cvs')}>Tải CV</Button>}
        />
      )}

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-3">
        {[
          { label: 'Đơn đã nộp', value: items.length, to: '/candidate/applications' },
          { label: 'Đang xử lý', value: active.length, to: '/candidate/applications' },
          { label: 'CV trong kho', value: cvs.data?.length ?? 0, to: '/candidate/cvs' },
        ].map((k) => (
          <button
            key={k.label}
            type="button"
            onClick={() => navigate(k.to)}
            className="admin-surface cursor-pointer border-0 p-5 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--console-accent)]"
          >
            <span className="block text-[13px] font-medium text-slate-600">{k.label}</span>
            <span className="mt-1 block text-[28px] font-bold tabular-nums text-slate-900">
              {apps.isLoading || cvs.isLoading ? <Skeleton.Input active size="small" /> : k.value}
            </span>
          </button>
        ))}
      </div>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="m-0 text-base font-bold text-slate-900">Đơn gần đây</h2>
          {items.length > 0 && (
            <Button type="link" className="!px-0" onClick={() => navigate('/candidate/applications')}>
              Xem tất cả
            </Button>
          )}
        </div>
        {apps.isLoading ? (
          <Skeleton active paragraph={{ rows: 4 }} />
        ) : apps.isError ? (
          <Alert type="error" showIcon message={getApiErrorMessage(apps.error)} />
        ) : items.length === 0 ? (
          <Surface className="p-8 text-center text-sm text-slate-600">Chưa có đơn ứng tuyển nào.</Surface>
        ) : (
          <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-2">
            {items.slice(0, 4).map((a) => (
              <ApplicationCard key={a.applicationId} a={a} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

// ─── Applications ───────────────────────────────────────────────────────────

export const CandidateApplicationsPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const status = searchParams.get('status') || undefined;
  const jobId = searchParams.get('jobId') || undefined;
  const fromDate = searchParams.get('fromDate') || undefined;
  const toDate = searchParams.get('toDate') || undefined;
  const filters = { status, jobId, fromDate, toDate, page, pageSize: 10 };
  const apps = useQuery({
    queryKey: [...candidateKeys.applications, filters],
    queryFn: () => candidateApplicationsApi.list(filters),
    placeholderData: (previous) => previous,
  });
  const items = apps.data?.items ?? [];

  const updateFilters = (updates: Record<string, string | undefined>) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([key, value]) => {
      if (value) next.set(key, value);
      else next.delete(key);
    });
    if (!Object.prototype.hasOwnProperty.call(updates, 'page')) next.delete('page');
    setSearchParams(next);
  };

  return (
    <div>
      <PageHero
        eyebrow="Ứng tuyển"
        title="Đơn ứng tuyển của tôi"
        description="Theo dõi từng đơn từ lúc nộp đến khi nhận việc. Trạng thái được cập nhật ngay khi nhà tuyển dụng xử lý."
        actions={
          <Button type="primary" size="large" icon={<SearchOutlined />} onClick={() => navigate('/candidate/jobs')}>
            Tìm việc làm
          </Button>
        }
      />
      <div className="mb-4 flex flex-wrap gap-3">
        <Select
          aria-label="Lọc theo trạng thái"
          allowClear
          placeholder="Tất cả trạng thái"
          value={status}
          onChange={(value) => updateFilters({ status: value })}
          className="min-w-52"
          options={[
            ['SUBMITTED', 'Đã nộp'],
            ['SCREENING', 'Đang được xem'],
            ['SHORTLISTED', 'Được chọn'],
            ['INTERVIEW', 'Phỏng vấn'],
            ['OFFER_PENDING', 'Đang chuẩn bị offer'],
            ['OFFER_ACCEPTED', 'Đã nhận offer'],
            ['PLACED', 'Đã đi làm'],
            ['REJECTED', 'Chưa phù hợp'],
            ['WITHDRAWN', 'Đã rút đơn'],
          ].map(([value, label]) => ({ value, label }))}
        />
        <DatePicker.RangePicker
          aria-label="Lọc theo ngày ứng tuyển"
          format="DD/MM/YYYY"
          value={fromDate && toDate ? [dayjs(fromDate), dayjs(toDate)] : null}
          onChange={(dates) =>
            updateFilters({
              fromDate: dates?.[0]?.startOf('day').toISOString(),
              toDate: dates?.[1]?.endOf('day').toISOString(),
            })
          }
        />
        {(status || fromDate || toDate || jobId) && <Button onClick={() => setSearchParams({})}>Xóa bộ lọc</Button>}
      </div>
      {apps.isLoading ? (
        <Skeleton active paragraph={{ rows: 6 }} />
      ) : apps.isError ? (
        <Alert type="error" showIcon message="Không tải được đơn ứng tuyển" description={getApiErrorMessage(apps.error)} />
      ) : items.length === 0 ? (
        <Surface className="p-10 text-center">
          <p className="m-0 text-sm text-slate-600">{status || fromDate || toDate || jobId ? 'Không có đơn nào phù hợp bộ lọc.' : 'Bạn chưa ứng tuyển công việc nào.'}</p>
          {!status && !fromDate && !toDate && !jobId && (
            <Button type="primary" className="mt-3" icon={<SearchOutlined />} onClick={() => navigate('/jobs')}>
              Tìm việc làm
            </Button>
          )}
        </Surface>
      ) : (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-2">
          {items.map((a) => (
            <ApplicationCard key={a.applicationId} a={a} />
          ))}
        </div>
      )}
      {(apps.data?.totalPages ?? 0) > 1 && (
        <div className="mt-6 flex justify-center">
          <Pagination
            current={page}
            pageSize={10}
            total={apps.data?.total ?? 0}
            showSizeChanger={false}
            onChange={(nextPage) => updateFilters({ page: String(nextPage) })}
          />
        </div>
      )}
    </div>
  );
};

export const CandidateApplicationDetailPage: React.FC = () => {
  const navigate = useNavigate();
  const { applicationId = '' } = useParams();
  const detail = useQuery({
    queryKey: candidateKeys.applicationDetail(applicationId),
    queryFn: () => candidateApplicationsApi.detail(applicationId),
    enabled: Boolean(applicationId),
  });

  if (detail.isLoading) return <Skeleton active paragraph={{ rows: 8 }} />;

  if (detail.isError || !detail.data) {
    return (
      <Surface className="p-6">
        <Alert
          type="error"
          showIcon
          message="Không tải được chi tiết đơn ứng tuyển"
          description={getApiErrorMessage(detail.error)}
          action={<Button onClick={() => navigate('/candidate/applications')}>Về danh sách</Button>}
        />
      </Surface>
    );
  }

  const application = detail.data;
  const stage = candidateStage(application.status);

  return (
    <div className="space-y-5">
      <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/candidate/applications')}>
        Đơn ứng tuyển
      </Button>
      <PageHero
        eyebrow="Chi tiết ứng tuyển"
        title={application.jobTitle}
        description={application.companyName}
        actions={<StatusDot tone={stage.tone}>{stage.label}</StatusDot>}
      />
      <Surface className="space-y-5 p-6">
        <StageTracker status={application.status} />
        <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-slate-500">CV đã nộp</dt>
            <dd className="m-0 mt-1 font-medium text-slate-900">{application.cvTitle || application.cvFileName || 'Không có tên CV'}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Nguồn hồ sơ</dt>
            <dd className="m-0 mt-1 font-medium text-slate-900">
              {application.submissionSource === 'AFFILIATE' ? 'Affiliate giới thiệu' : 'Candidate tự ứng tuyển'}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Ngày ứng tuyển</dt>
            <dd className="m-0 mt-1 font-medium text-slate-900">{dayjs(application.appliedAt).format('HH:mm DD/MM/YYYY')}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Cập nhật gần nhất</dt>
            <dd className="m-0 mt-1 font-medium text-slate-900">{dayjs(application.updatedAt).format('HH:mm DD/MM/YYYY')}</dd>
          </div>
        </dl>
        {application.statusReason && <Alert type="info" showIcon message="Thông tin trạng thái" description={application.statusReason} />}
      </Surface>
      <Surface className="p-6">
        <h2 className="m-0 text-base font-bold text-slate-900">Kết quả AI</h2>
        <div className="mt-3 grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
          <div><span className="text-slate-500">Trạng thái</span><strong className="mt-1 block text-slate-900">{application.aiStatus || 'Chưa có kết quả'}</strong></div>
          <div><span className="text-slate-500">Điểm phù hợp</span><strong className="mt-1 block text-slate-900">{application.aiMatchScore == null ? '—' : `${application.aiMatchScore}%`}</strong></div>
          <div><span className="text-slate-500">Mức phù hợp</span><strong className="mt-1 block text-slate-900">{application.aiMatchTier || '—'}</strong></div>
        </div>
      </Surface>
    </div>
  );
};

// ─── CV vault ───────────────────────────────────────────────────────────────

export const CvUploader: React.FC<{ onUploaded?: () => void; compact?: boolean }> = ({ onUploaded, compact }) => {
  const { message } = AntApp.useApp();
  const queryClient = useQueryClient();
  const upload = useMutation({
    mutationFn: (file: File) => candidateCvApi.upload(file, file.name.replace(/\.pdf$/i, '')),
    onSuccess: (res) => {
      message.success(res.message || 'Đã tải CV lên.');
      queryClient.invalidateQueries({ queryKey: candidateKeys.cvs });
      onUploaded?.();
    },
    onError: (err) => message.error(getApiErrorMessage(err, 'Không tải được CV lên.')),
  });

  return (
    <Upload.Dragger
      accept="application/pdf,.pdf"
      multiple={false}
      showUploadList={false}
      disabled={upload.isPending}
      beforeUpload={(file) => {
        const error = cvFileError(file);
        if (error) message.error(error);
        else upload.mutate(file);
        return false; // we upload ourselves through the API client
      }}
      className={compact ? '!rounded-2xl' : '!rounded-2xl !bg-white'}
    >
      <p className="ant-upload-drag-icon">
        <InboxOutlined className="!text-[color:var(--console-accent)]" />
      </p>
      <p className="ant-upload-text">{upload.isPending ? 'Đang tải lên...' : 'Kéo thả CV vào đây hoặc bấm để chọn file'}</p>
      <p className="ant-upload-hint">Chỉ nhận PDF, tối đa {MAX_CV_MB}MB.</p>
    </Upload.Dragger>
  );
};

export const CandidateCvsPage: React.FC = () => {
  const { message } = AntApp.useApp();
  const queryClient = useQueryClient();
  const hasPermission = useAuthStore((state) => state.hasPermission);
  const cvs = useCandidateCvs();
  const openSigned = useOpenSignedUrl();
  const [busyId, setBusyId] = useState<string>();
  const [editing, setEditing] = useState<{ cvId: string; title: string }>();
  const canView = hasPermission('cv.view_own');
  const canCreate = hasPermission('cv.create');
  const canUpdate = hasPermission('cv.update_own');
  const canDelete = hasPermission('cv.delete_own');

  const act = async (cvId: string, run: () => Promise<{ message?: string }>, ok: string) => {
    setBusyId(cvId);
    try {
      const res = await run();
      message.success(res.message || ok);
      await queryClient.invalidateQueries({ queryKey: candidateKeys.cvs });
    } catch (err) {
      message.error(getApiErrorMessage(err));
    } finally {
      setBusyId(undefined);
    }
  };

  const list = cvs.data ?? [];

  const saveTitle = async () => {
    if (!editing) return;
    const title = editing.title.trim();
    if (!title) {
      message.error('Tiêu đề CV không được để trống.');
      return;
    }
    if (title.length > 180) {
      message.error('Tiêu đề CV không được vượt quá 180 ký tự.');
      return;
    }
    await act(editing.cvId, () => candidateCvApi.updateTitle(editing.cvId, title), 'Đã cập nhật tên CV.');
    setEditing(undefined);
  };

  return (
    <div>
      <PageHero eyebrow="Hồ sơ" title="Kho CV" description="CV bạn tải lên được dùng để ứng tuyển. CV chính được chọn sẵn khi bạn bấm Ứng tuyển." />
      {!canView && <Alert className="mb-5" type="error" showIcon message="Bạn không có quyền xem kho CV cá nhân." />}
      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-3">
          {cvs.isLoading ? (
            <Skeleton active paragraph={{ rows: 5 }} />
          ) : cvs.isError ? (
            <Alert type="error" showIcon message={getApiErrorMessage(cvs.error)} />
          ) : list.length === 0 ? (
            <Surface className="p-10 text-center text-sm text-slate-600">Chưa có CV nào. Tải CV đầu tiên ở khung bên cạnh.</Surface>
          ) : (
            list.map((cv) => (
              <article key={cv.cvId} className="admin-surface flex flex-wrap items-center gap-4 p-4 sm:flex-nowrap">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-red-50 text-2xl text-red-700" aria-hidden>
                  <FilePdfOutlined />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-semibold text-slate-900">{cv.title || cv.fileName || 'CV'}</span>
                    {cv.isPrimary && (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[color:var(--console-accent-soft)] px-2 py-0.5 text-xs font-medium text-[color:var(--console-accent-strong)]">
                        <CheckCircleFilled aria-hidden /> CV chính
                      </span>
                    )}
                  </div>
                  <div className="truncate text-xs text-slate-500">
                    {cv.fileName} · {fileSize(cv.fileSizeBytes)} · cập nhật {dayjs(cv.updatedAt).format('DD/MM/YYYY')}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {canView && (
                    <Tooltip title="Xem CV">
                      <Button icon={<EyeOutlined />} aria-label={`Xem ${cv.title ?? 'CV'}`} onClick={() => openSigned(() => candidateCvApi.downloadUrl(cv.cvId))} />
                    </Tooltip>
                  )}
                  {canUpdate && (
                    <Tooltip title="Đổi tên CV">
                      <Button icon={<EditOutlined />} aria-label={`Đổi tên ${cv.title ?? 'CV'}`} onClick={() => setEditing({ cvId: cv.cvId, title: cv.title || cv.fileName || '' })} />
                    </Tooltip>
                  )}
                  {canUpdate && !cv.isPrimary && (
                    <Tooltip title="Đặt làm CV chính">
                      <Button
                        icon={busyId === cv.cvId ? undefined : <StarOutlined />}
                        loading={busyId === cv.cvId}
                        aria-label="Đặt làm CV chính"
                        onClick={() => act(cv.cvId, () => candidateCvApi.setPrimary(cv.cvId), 'Đã đặt làm CV chính.')}
                      />
                    </Tooltip>
                  )}
                  {cv.isPrimary && (
                    <Button icon={<StarFilled />} disabled aria-label="CV chính" className="!text-amber-600" />
                  )}
                  {canDelete && <Popconfirm
                    title="Gỡ CV khỏi kho?"
                    description="CV đã dùng trong đơn ứng tuyển vẫn được giữ cho nhà tuyển dụng."
                    okText="Gỡ khỏi kho"
                    okButtonProps={{ danger: true }}
                    cancelText="Hủy"
                    onConfirm={() => act(cv.cvId, () => candidateCvApi.remove(cv.cvId), 'Đã gỡ CV khỏi kho.')}
                  >
                    <Button danger icon={<DeleteOutlined />} aria-label={`Gỡ ${cv.title ?? 'CV'} khỏi kho`} />
                  </Popconfirm>}
                </div>
              </article>
            ))
          )}
        </div>
        {canCreate && <aside className="lg:sticky lg:top-24 lg:self-start">
          <Surface className="p-5">
            <h2 className="m-0 mb-3 text-base font-semibold text-slate-900">Tải CV mới</h2>
            <CvUploader />
          </Surface>
        </aside>}
      </div>
      <Modal
        title="Đổi tên CV"
        open={Boolean(editing)}
        okText="Lưu thay đổi"
        cancelText="Hủy"
        confirmLoading={Boolean(editing && busyId === editing.cvId)}
        okButtonProps={{ disabled: !editing?.title.trim() || (editing?.title.trim().length ?? 0) > 180 }}
        onOk={saveTitle}
        onCancel={() => setEditing(undefined)}
      >
        <Input
          autoFocus
          maxLength={180}
          showCount
          value={editing?.title ?? ''}
          aria-label="Tiêu đề CV"
          onChange={(event) => setEditing((current) => current ? { ...current, title: event.target.value } : current)}
          onPressEnter={saveTitle}
        />
      </Modal>
    </div>
  );
};
