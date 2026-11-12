/**
 * @file JobApplyActions.tsx
 * @description MF-02 entry point on the job page.
 *  - Candidate: "Ứng tuyển" → choose a CV from the vault (primary preselected) or upload a new PDF;
 *    POST /jobs/{id}/apply sends exactly one CV source. Duplicates (409) and visibility rules
 *    (403) come back from the backend and are shown as-is.
 *  - Affiliate: "Giới thiệu ứng viên" → the referral form, preset to this job.
 */
import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { Alert, App as AntApp, Button, Modal, Result, Skeleton } from 'antd';
import { CheckCircleFilled, SendOutlined, UserAddOutlined, RedoOutlined, InfoCircleOutlined } from '@ant-design/icons';
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
const PRIMARY = `${FONT} h-11 cursor-pointer rounded-xl border-0 bg-gradient-to-r from-sky-500 to-blue-600 px-[22px] text-[14px] font-bold text-white transition-all hover:from-sky-400 hover:to-blue-500 shadow-sm hover:shadow-md hover:shadow-blue-500/25 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-none disabled:bg-[#9CA3AF] disabled:shadow-none`;

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

export interface ApplyModalProps {
  job: Job;
  open: boolean;
  onClose: () => void;
  isReapply?: boolean;
  previousApplicationId?: string;
  onSuccess?: () => void;
}

export const ApplyModal: React.FC<ApplyModalProps> = ({
  job,
  open,
  onClose,
  isReapply = false,
  previousApplicationId,
  onSuccess,
}) => {
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
    mutationFn: () => {
      const payload = source!.kind === 'vault' ? { cvId: source!.cvId } : { file: source!.file };
      return isReapply
        ? applyApi.reapply(job.jobId, payload, previousApplicationId)
        : applyApi.apply(job.jobId, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: candidateKeys.applications });
      queryClient.invalidateQueries({ queryKey: candidateKeys.cvs });
      if (onSuccess) onSuccess();
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
  const hasExistingCvs = Boolean(cvs.data && cvs.data.length > 0);
  const noCvs = Boolean(!cvs.isLoading && !cvs.isError && (!cvs.data || cvs.data.length === 0));

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
            title={isReapply ? 'Đã nộp lại đơn ứng tuyển thành công' : 'Đã nộp đơn ứng tuyển'}
            subTitle={`Đơn vào vị trí “${job.title}” đã được tiếp nhận. Hệ thống đang thực hiện đánh giá mức độ phù hợp của hồ sơ.`}
            extra={
              <div className="flex flex-wrap justify-center gap-2.5">
                <button type="button" className={SECONDARY} onClick={close}>Đóng</button>
                <button
                  type="button"
                  className={PRIMARY}
                  onClick={() => {
                    const targetId = apply.data?.data?.applicationId || previousApplicationId;
                    if (targetId && targetId !== 'reapplied-application') {
                      navigate(`/candidate/applications/${targetId}`);
                    } else {
                      navigate('/candidate/applications');
                    }
                  }}
                >
                  Xem đơn vừa nộp
                </button>
              </div>
            }
          />
        ) : (
          <>
            <div className="flex items-start gap-3 border-0 border-b border-solid border-[#E5E7EB] px-[22px] py-[18px]">
              <div className="min-w-0 flex-1">
                <h2 id="apply-title" className="m-0 text-[18px] font-bold text-[#1F2937]">{isReapply ? `Ứng tuyển lại vị trí ${job.title}` : `Ứng tuyển ${job.title}`}</h2>
                {companyLine && <div className="mt-0.5 text-[#4B5563]">{companyLine}</div>}
              </div>
              <button type="button" aria-label="Đóng" onClick={close} className={`${FONT} -mr-2 -mt-2 h-11 w-11 shrink-0 cursor-pointer border-0 bg-transparent text-[20px] text-[#4B5563]`}>×</button>
            </div>

            <form
              id="apply-form"
              onSubmit={(event) => {
                event.preventDefault();
                if (!source) {
                  const msg = 'Vui lòng chọn 1 bản CV trong danh sách hoặc tải lên CV để nộp hồ sơ!';
                  setError(msg);
                  message.warning(msg);
                  return;
                }
                if (retryRemaining === 0 && !apply.isPending) apply.mutate();
              }}
              className="flex flex-col gap-[18px] overflow-auto px-[22px] py-[18px]"
            >
              {isReapply && (
                <div className="flex items-start gap-2.5 rounded-xl border border-sky-200 bg-sky-50/80 p-3 text-[13px] text-sky-950">
                  <InfoCircleOutlined className="mt-0.5 text-sky-600 text-sm shrink-0" />
                  <div className="leading-relaxed">
                    <strong className="block text-sky-900 font-semibold mb-0.5">Thông tin ứng tuyển lại:</strong>
                    Bạn đã rút đơn trước đó. Bạn có thể chọn bản CV mới để gửi lại hồ sơ ứng tuyển cho vị trí này.
                  </div>
                </div>
              )}
              {error && (
                <Alert
                  type="error"
                  showIcon
                  message={error}
                  action={
                    <Link
                      to="/contact"
                      className="inline-flex items-center text-xs font-semibold text-rose-700 hover:text-rose-800 hover:underline"
                    >
                      Liên hệ hỗ trợ
                    </Link>
                  }
                />
              )}
              {retryRemaining > 0 && <Alert type="warning" showIcon message={`Bạn có thể thử lại sau ${retryRemaining} giây.`} />}
              {cvs.isError && <Alert type="error" showIcon message={getApiError(cvs.error, 'Không tải được kho CV.').message} />}

              <fieldset className="m-0 flex min-w-0 flex-col gap-2.5 border-0 p-0">
                <div className="flex items-center justify-between">
                  <legend className="px-0.5 font-semibold text-[#1F2937]">Chọn CV để ứng tuyển</legend>
                  <Link
                    to="/candidate/cv-builder"
                    onClick={close}
                    className={`text-[13px] font-medium ${LINK} flex items-center gap-1`}
                  >
                    <span>+ Tạo CV online mới</span>
                  </Link>
                </div>

                {cvs.isLoading ? (
                  <Skeleton active paragraph={{ rows: 2 }} />
                ) : noCvs && !chosenFile ? (
                  <div className="rounded-lg border border-solid border-[#FDE68A] bg-[#FEFCE8] p-4 text-[#1F2937]">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#FEF3C7] text-[#D97706]">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                          <polyline points="14 2 14 8 20 8" />
                          <line x1="12" y1="18" x2="12" y2="12" />
                          <line x1="9" y1="15" x2="15" y2="15" />
                        </svg>
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="m-0 text-[15px] font-semibold text-[#92400E]">
                          Bạn chưa có bản CV nào trong hệ thống
                        </h4>
                        <p className="m-0 mt-1 text-[13px] leading-relaxed text-[#78350F]">
                          Để ứng tuyển vị trí này, bạn cần có một bản CV. Bạn có thể tạo CV mới chuẩn ATS trực tuyến hoặc tải lên file CV có sẵn (PDF).
                        </p>

                        <div className="mt-3.5 flex flex-wrap items-center gap-2.5">
                          <button
                            type="button"
                            onClick={() => {
                              close();
                              navigate('/candidate/cv-builder');
                            }}
                            className={`${FONT} inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-md border-0 bg-[#0284C7] px-3.5 text-[13px] font-semibold text-white shadow-xs transition-colors hover:bg-[#0369A1]`}
                          >
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M12 20h9" />
                              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                            </svg>
                            Tạo CV online ngay
                          </button>

                          <label className={`${FONT} inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-md border border-solid border-[#D1D5DB] bg-white px-3.5 text-[13px] font-semibold text-[#1F2937] shadow-xs transition-colors hover:bg-[#F9FAFB] hover:border-[#9CA3AF]`}>
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                              <polyline points="17 8 12 3 7 8" />
                              <line x1="12" y1="3" x2="12" y2="15" />
                            </svg>
                            <span>Tải lên CV (PDF)</span>
                            <input
                              type="file"
                              accept="application/pdf,.pdf"
                              className="hidden"
                              onChange={(event) => {
                                pickFile(event.target.files?.[0]);
                                event.target.value = '';
                              }}
                            />
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    {(cvs.data ?? []).map((cv) => {
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
                    })}

                    {chosenFile ? (
                      <div className="flex items-center justify-between rounded-lg border-2 border-solid border-[#0284C7] bg-[#F0F9FF] p-3 text-[#1F2937]">
                        <div className="flex min-w-0 items-center gap-2.5">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[#E0F2FE] text-[#0284C7]">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                          </div>
                          <div className="min-w-0">
                            <div className="truncate font-semibold text-[14px] text-[#0F172A]">{chosenFile.name}</div>
                            <div className="text-[12px] text-[#0369A1]">
                              {fileSize(chosenFile.size)} · Đã chọn để nộp hồ sơ
                            </div>
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-3">
                          <label className={`${FONT} cursor-pointer text-[13px] font-medium text-[#0284C7] hover:underline`}>
                            Đổi file
                            <input
                              type="file"
                              accept="application/pdf,.pdf"
                              className="hidden"
                              onChange={(event) => {
                                pickFile(event.target.files?.[0]);
                                event.target.value = '';
                              }}
                            />
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              setSource(null);
                              if (cvs.data?.length) {
                                const primary = cvs.data.find((c) => c.isPrimary) ?? cvs.data[0];
                                setSource({ kind: 'vault', cvId: primary.cvId });
                              }
                            }}
                            className={`${FONT} cursor-pointer border-0 bg-transparent text-[13px] text-[#EF4444] hover:underline`}
                          >
                            Hủy
                          </button>
                        </div>
                      </div>
                    ) : (
                      <label className="relative flex cursor-pointer items-center gap-2.5 rounded-lg border border-dashed border-[#94A3B8] p-3 text-[#374151] hover:border-[#0369A1] has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-[#0369A1]">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true" className="shrink-0"><path d="M12 16V4M7 9l5-5 5 5M5 20h14" /></svg>
                        <span><b>Tải CV mới</b> <span className="text-[#4B5563]">· PDF, tối đa {MAX_CV_MB} MB</span></span>
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
                    )}
                  </>
                )}
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

            <div className="flex items-center justify-between border-0 border-t border-solid border-[#E5E7EB] px-[22px] py-[14px]">
              <div className="text-[13px]">
                {!source ? (
                  <span className="font-medium text-[#D97706]">⚠️ Chưa chọn bản CV nào</span>
                ) : (
                  <span className="font-medium text-[#059669]">✓ Đã sẵn sàng nộp hồ sơ</span>
                )}
              </div>
              <div className="flex gap-2.5">
                <button type="button" onClick={close} className={SECONDARY}>Hủy</button>
                <button
                  type="submit"
                  form="apply-form"
                  disabled={!source || retryRemaining > 0 || apply.isPending}
                  className={PRIMARY}
                >
                  {apply.isPending ? 'Đang nộp…' : 'Xác nhận nộp hồ sơ'}
                </button>
              </div>
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
  const [searchParams] = useSearchParams();
  const hasAnyRole = useAuthStore((s) => s.hasAnyRole);
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const { isApplied, isWithdrawn, getApplication } = useCandidateAppliedJobs();
  const shouldAutoOpen = autoOpen || searchParams.get('reapply') === 'true';
  const [open, setOpen] = useState(shouldAutoOpen);

  if (job.status !== 'ACTIVE') return null;

  if (hasAnyRole([UserRole.CANDIDATE])) {
    const applied = isApplied(job.jobId);
    const withdrawn = isWithdrawn(job.jobId);
    const appliedApp = getApplication(job.jobId);

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
        <Button
          type="primary"
          size="large"
          icon={withdrawn ? <RedoOutlined /> : <SendOutlined />}
          disabled={!allowed}
          onClick={() => setOpen(true)}
          className={withdrawn ? "!bg-blue-600 hover:!bg-blue-700 text-white font-bold" : undefined}
        >
          {withdrawn ? 'Ứng tuyển lại' : 'Ứng tuyển'}
        </Button>
        {withdrawn && (
          <p className="m-0 mt-1 text-xs text-slate-500">
            Bạn đã rút đơn trước đó. Bạn có thể chọn bản CV mới để nộp lại.
          </p>
        )}
        {!allowed && <p className="m-0 mt-1 text-xs text-slate-500">Tài khoản chưa có quyền tự ứng tuyển.</p>}
        <ApplyModal
          job={job}
          open={open}
          onClose={() => setOpen(false)}
          isReapply={withdrawn}
          previousApplicationId={appliedApp?.applicationId}
        />
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
