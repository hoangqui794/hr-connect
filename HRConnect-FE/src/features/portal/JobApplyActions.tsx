/**
 * @file JobApplyActions.tsx
 * @description MF-02 entry point on the job page.
 *  - Candidate: "Ứng tuyển" → choose a CV from the vault (primary preselected) or upload a new PDF;
 *    POST /jobs/{id}/apply sends exactly one CV source. Duplicates (409) and visibility rules
 *    (403) come back from the backend and are shown as-is.
 *  - Affiliate: "Giới thiệu ứng viên" → the referral form, preset to this job.
 */
import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { Alert, App as AntApp, Button, Modal, Result, Skeleton } from 'antd';
import { CheckCircleFilled, SendOutlined, UserAddOutlined } from '@ant-design/icons';
import { applyApi, candidateCvApi } from '@/services/api/mf02Api';
import { mf04Api } from '@/services/api/mf04Api';
import { getApiError } from '@/services/apiClient';
import { useAuthStore } from '@/stores/authStore';
import { UserRole } from '@/types/roles';
import type { Job } from '@/types/api/jobs';
import { candidateKeys, useCandidateCvs, useOpenSignedUrl } from './CandidatePages';
import { useCandidateAppliedJobs } from './candidate/useCandidateAppliedJobs';
import { MAX_CV_MB, cvFileError, fileSize } from './mf02Labels';

type Source = { kind: 'vault'; cvId: string } | { kind: 'file'; file: File };

const FONT = "font-['Be_Vietnam_Pro',system-ui,sans-serif]";
const LINK = 'text-[#0369A1] no-underline hover:text-[#075985] hover:underline';
const SECONDARY = `${FONT} h-11 cursor-pointer rounded-md border border-solid border-[#D1D5DB] bg-white px-[18px] text-[14px] font-medium text-[#1F2937] hover:bg-[#F9FAFB]`;
const PRIMARY = `${FONT} h-11 cursor-pointer rounded-md border-0 bg-[#C2410C] px-[22px] text-[14px] font-semibold text-white hover:bg-[#9A3412] disabled:cursor-not-allowed disabled:bg-[#9CA3AF]`;

/** Contact details come from the profile; the apply API takes only a CV, so they are shown, not edited, here. */
const ContactField: React.FC<{ label: string; value?: string | null; type?: string; wide?: boolean }> = ({ label, value, type = 'text', wide }) => (
  <label className={`flex flex-col gap-1.5 ${wide ? 'col-span-full' : ''}`}>
    <span className="text-[13px] text-[#374151]">{label}</span>
    <input
      type={type}
      readOnly
      value={value ?? ''}
      placeholder="Chưa cập nhật"
      className={`${FONT} h-[42px] w-full min-w-0 rounded-md border border-solid border-[#D1D5DB] bg-white px-3 text-[14px] text-[#1F2937]`}
    />
  </label>
);

export const ApplyModal: React.FC<{ job: Job; open: boolean; onClose: () => void }> = ({ job, open, onClose }) => {
  const { message } = AntApp.useApp();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const cvs = useCandidateCvs();
  const openSigned = useOpenSignedUrl();
  const account = useAuthStore((s) => s.user);
  const profile = useQuery({ queryKey: ['candidate', 'profile'], queryFn: () => mf04Api.getProfile(), enabled: open });
  const [source, setSource] = useState<Source | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retryUntil, setRetryUntil] = useState<number | null>(null);
  const [retryRemaining, setRetryRemaining] = useState(0);

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

  // Preselect the primary CV (or the newest) once the vault is loaded.
  useEffect(() => {
    if (open && !source && cvs.data?.length) {
      const primary = cvs.data.find((c) => c.isPrimary) ?? cvs.data[0];
      setSource({ kind: 'vault', cvId: primary.cvId });
    }
  }, [open, cvs.data, source]);

  const apply = useMutation({
    mutationFn: () => applyApi.apply(job.jobId, source!.kind === 'vault' ? { cvId: source!.cvId } : { file: source!.file }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: candidateKeys.applications });
      queryClient.invalidateQueries({ queryKey: candidateKeys.cvs });
    },
    onError: (err) => {
      const apiError = getApiError(err, 'Không nộp được đơn ứng tuyển.');
      setError(apiError.message);
      if (apiError.status === 429 && apiError.retryAfterSeconds) {
        setRetryUntil(Date.now() + apiError.retryAfterSeconds * 1000);
      }
    },
  });

  const close = () => {
    setSource(null);
    setError(null);
    setRetryUntil(null);
    setRetryRemaining(0);
    apply.reset();
    onClose();
  };

  const pickFile = (file?: File) => {
    if (!file) return;
    const problem = cvFileError(file);
    if (problem) {
      message.error(problem);
      return;
    }
    setError(null);
    setSource({ kind: 'file', file });
  };

  const chosenFile = source?.kind === 'file' ? source.file : null;
  const companyLine = [job.companyName, job.location].filter(Boolean).join(' · ');

  return (
    <Modal
      open={open}
      onCancel={close}
      footer={null}
      closable={false}
      centered
      width={620}
      destroyOnHidden
      title={null}
      aria-labelledby="apply-title"
      rootClassName="[&_.ant-modal-content]:!rounded-[10px] [&_.ant-modal-content]:!border-0 [&_.ant-modal-content]:![box-shadow:0_20px_48px_rgba(15,23,42,.25)]"
      styles={{ content: { padding: 0 }, mask: { background: 'rgba(15,23,42,.55)' } }}
    >
      <div className={`${FONT} flex max-h-[min(900px,calc(100vh-40px))] flex-col text-[14px] text-[#1F2937] [line-height:normal]`}>
        {apply.isSuccess ? (
          <Result
            status="success"
            title="Đã nộp đơn ứng tuyển"
            subTitle={`Đơn vào vị trí “${job.title}” đã được tiếp nhận. Hệ thống đang thực hiện đánh giá mức độ phù hợp của hồ sơ.`}
            extra={
              <div className="flex flex-wrap justify-center gap-2.5">
                <button type="button" className={SECONDARY} onClick={close}>Đóng</button>
                <button type="button" className={PRIMARY} onClick={() => navigate(`/candidate/applications/${apply.data.data.applicationId}`)}>Xem đơn vừa nộp</button>
              </div>
            }
          />
        ) : (
          <>
            <div className="flex items-start gap-3 border-0 border-b border-solid border-[#E5E7EB] px-[22px] py-[18px]">
              <div className="min-w-0 flex-1">
                <h2 id="apply-title" className="m-0 text-[18px] font-bold text-[#1F2937]">Ứng tuyển {job.title}</h2>
                {companyLine && <div className="mt-0.5 text-[#4B5563]">{companyLine}</div>}
              </div>
              <button type="button" aria-label="Đóng" onClick={close} className={`${FONT} -mr-2 -mt-2 h-11 w-11 shrink-0 cursor-pointer border-0 bg-transparent text-[20px] text-[#4B5563]`}>×</button>
            </div>

            <form
              id="apply-form"
              onSubmit={(event) => {
                event.preventDefault();
                if (source && retryRemaining === 0 && !apply.isPending) apply.mutate();
              }}
              className="flex flex-col gap-[18px] overflow-auto px-[22px] py-[18px]"
            >
              {error && <Alert type="error" showIcon message={error} />}
              {retryRemaining > 0 && <Alert type="warning" showIcon message={`Bạn có thể thử lại sau ${retryRemaining} giây.`} />}
              {cvs.isError && <Alert type="error" showIcon message={getApiError(cvs.error, 'Không tải được kho CV.').message} />}

              <fieldset className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0">
                <legend className="mb-2 px-0.5 font-semibold">Chọn CV để ứng tuyển</legend>
                {cvs.isLoading ? (
                  <Skeleton active paragraph={{ rows: 2 }} />
                ) : (
                  (cvs.data ?? []).map((cv) => {
                    const selected = source?.kind === 'vault' && source.cvId === cv.cvId;
                    return (
                      <label
                        key={cv.cvId}
                        className={`flex cursor-pointer items-center gap-3 rounded-lg border-solid p-3 ${selected ? 'border-2 border-[#0369A1] bg-[#F0F9FF]' : 'border border-[#E5E7EB] hover:border-[#94A3B8]'}`}
                      >
                        <input
                          type="radio"
                          name="cv"
                          checked={selected}
                          onChange={() => {
                            setError(null);
                            setSource({ kind: 'vault', cvId: cv.cvId });
                          }}
                          className="ml-[5px] mr-[3px] mt-[3px] h-[18px] w-[18px] shrink-0 cursor-pointer accent-[#0369A1]"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-semibold">{cv.title || cv.fileName}</span>
                          <span className="text-[13px] text-[#4B5563]">
                            Cập nhật {dayjs(cv.updatedAt).format('DD/MM/YYYY')}{cv.fileSizeBytes ? ` · ${fileSize(cv.fileSizeBytes)}` : ''}
                          </span>
                        </span>
                        {cv.isPrimary && <span className="shrink-0 rounded bg-[#E0F2FE] px-2 py-0.5 text-[12px] font-semibold text-[#075985]">CV chính</span>}
                        <button
                          type="button"
                          onClick={(event) => {
                            event.preventDefault();
                            void openSigned(() => candidateCvApi.downloadUrl(cv.cvId));
                          }}
                          className={`${FONT} shrink-0 cursor-pointer border-0 bg-transparent p-0 text-[13px] ${LINK}`}
                        >
                          Xem
                        </button>
                      </label>
                    );
                  })
                )}
                <label className={`relative flex cursor-pointer items-center gap-2.5 rounded-lg p-3 text-[#374151] has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-[#0369A1] ${chosenFile ? 'border-2 border-solid border-[#0369A1] bg-[#F0F9FF]' : 'border border-dashed border-[#94A3B8]'}`}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true" className="shrink-0"><path d="M12 16V4M7 9l5-5 5 5M5 20h14" /></svg>
                  {chosenFile ? (
                    <span className="min-w-0 truncate"><b>{chosenFile.name}</b> <span className="text-[#4B5563]">· {fileSize(chosenFile.size)} · bấm để đổi</span></span>
                  ) : (
                    <span><b>Tải CV mới</b> <span className="text-[#4B5563]">· PDF, tối đa {MAX_CV_MB} MB</span></span>
                  )}
                  <input
                    type="file"
                    accept="application/pdf,.pdf"
                    className="absolute h-px w-px opacity-0"
                    onChange={(event) => {
                      pickFile(event.target.files?.[0]);
                      event.target.value = '';
                    }}
                  />
                </label>
              </fieldset>

              <fieldset className="m-0 min-w-0 border-0 p-0">
                <legend className="mb-2 flex w-full justify-between px-0.5 font-semibold">
                  Thông tin liên hệ
                  <Link to="/candidate/profile" className={`text-[13px] font-normal ${LINK}`}>Sửa trong Hồ sơ</Link>
                </legend>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <ContactField wide label="Họ và tên" value={profile.data?.fullName ?? account?.name} />
                  <ContactField label="Email" type="email" value={profile.data?.email ?? account?.email} />
                  <ContactField label="Số điện thoại" type="tel" value={profile.data?.phone} />
                </div>
              </fieldset>

              <p className="m-0 rounded-md border border-solid border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2.5 text-[13px] text-[#4B5563]">
                Nhà tuyển dụng sẽ xem CV và thông tin liên hệ này. Mỗi việc làm chỉ ứng tuyển được một lần; bạn theo dõi kết quả trong <Link to="/candidate/applications" className={LINK}>Đơn ứng tuyển</Link>.
              </p>
            </form>

            <div className="flex justify-end gap-2.5 border-0 border-t border-solid border-[#E5E7EB] px-[22px] py-[14px]">
              <button type="button" onClick={close} className={SECONDARY}>Hủy</button>
              <button type="submit" form="apply-form" disabled={!source || retryRemaining > 0 || apply.isPending} className={PRIMARY}>
                {apply.isPending ? 'Đang nộp…' : 'Nộp hồ sơ'}
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
};

/** Role-aware call to action for a job page. Renders nothing for roles that cannot submit. */
export const JobApplyActions: React.FC<{ job: Job; autoOpen?: boolean }> = ({ job, autoOpen = false }) => {
  const navigate = useNavigate();
  const hasAnyRole = useAuthStore((s) => s.hasAnyRole);
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const { isApplied, getApplication } = useCandidateAppliedJobs();
  const [open, setOpen] = useState(autoOpen);

  if (job.status !== 'ACTIVE') return null;

  if (hasAnyRole([UserRole.CANDIDATE])) {
    const applied = isApplied(job.jobId);
    const appliedApp = applied ? getApplication(job.jobId) : undefined;

    if (applied) {
      return (
        <Button
          type="default"
          size="large"
          icon={<CheckCircleFilled className="text-emerald-600" />}
          className="!border-emerald-300 !bg-emerald-50/70 !text-emerald-800 hover:!border-emerald-500 font-semibold shadow-2xs"
          onClick={() => {
            if (appliedApp?.applicationId) {
              navigate(`/candidate/applications/${appliedApp.applicationId}`);
            } else {
              navigate('/candidate/applications');
            }
          }}
        >
          Đã ứng tuyển · Xem đơn
        </Button>
      );
    }

    if (job.isAcceptingApplications === false) {
      return (
        <div>
          <Button type="primary" size="large" icon={<SendOutlined />} disabled>
            Đã hết hạn nhận hồ sơ
          </Button>
          <p className="m-0 mt-1 text-xs text-slate-500">Bạn vẫn có thể xem thông tin vị trí nhưng không thể nộp đơn mới.</p>
        </div>
      );
    }

    const allowed = hasPermission('application.create');
    return (
      <>
        <Button type="primary" size="large" icon={<SendOutlined />} disabled={!allowed} onClick={() => setOpen(true)}>
          Ứng tuyển
        </Button>
        {!allowed && <p className="m-0 mt-1 text-xs text-slate-500">Tài khoản chưa có quyền tự ứng tuyển.</p>}
        <ApplyModal job={job} open={open} onClose={() => setOpen(false)} />
      </>
    );
  }

  // Affiliates only open job pages they are allowed to see (GET /jobs/{id} applies the service-type
  // rules), so a loaded job here is one they may refer into; the form re-checks it anyway.
  if (hasAnyRole([UserRole.AFFILIATE]) && hasPermission('submission.create')) {
    return (
      <Button type="primary" size="large" icon={<UserAddOutlined />} onClick={() => navigate(`/affiliate/submit-candidate?job=${job.jobId}`)}>
        Giới thiệu ứng viên
      </Button>
    );
  }

  return null;
};
