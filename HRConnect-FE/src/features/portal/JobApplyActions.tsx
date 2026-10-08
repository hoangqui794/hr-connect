/**
 * @file JobApplyActions.tsx
 * @description MF-02 entry point on the job page.
 *  - Candidate: "Ứng tuyển" → choose a CV from the vault (primary preselected) or upload a new PDF;
 *    POST /jobs/{id}/apply sends exactly one CV source. Duplicates (409) and visibility rules
 *    (403) come back from the backend and are shown as-is.
 *  - Affiliate: "Giới thiệu ứng viên" → the referral form, preset to this job.
 */
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Alert, App as AntApp, Button, Modal, Result, Skeleton, Upload } from 'antd';
import { CheckCircleFilled, FilePdfOutlined, InboxOutlined, SendOutlined, UserAddOutlined } from '@ant-design/icons';
import { applyApi } from '@/services/api/mf02Api';
import { getApiErrorMessage } from '@/services/apiClient';
import { useAuthStore } from '@/stores/authStore';
import { UserRole } from '@/types/roles';
import type { Job } from '@/types/api/jobs';
import { candidateKeys, useCandidateCvs } from './CandidatePages';
import { MAX_CV_MB, cvFileError, fileSize } from './mf02Labels';

type Source = { kind: 'vault'; cvId: string } | { kind: 'file'; file: File };

const ApplyModal: React.FC<{ job: Job; open: boolean; onClose: () => void }> = ({ job, open, onClose }) => {
  const { message } = AntApp.useApp();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const cvs = useCandidateCvs();
  const [source, setSource] = useState<Source | null>(null);
  const [error, setError] = useState<string | null>(null);

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
    onError: (err) => setError(getApiErrorMessage(err, 'Không nộp được đơn ứng tuyển.')),
  });

  const close = () => {
    setSource(null);
    setError(null);
    apply.reset();
    onClose();
  };

  return (
    <Modal open={open} onCancel={close} footer={null} width={560} destroyOnClose title={apply.isSuccess ? null : 'Ứng tuyển'}>
      {apply.isSuccess ? (
        <Result
          status="success"
          title="Đã nộp đơn ứng tuyển"
          subTitle={`Đơn của bạn vào vị trí “${job.title}” đã được gửi. Bạn có thể theo dõi tiến độ ở mục Đơn ứng tuyển.`}
          extra={[
            <Button key="go" type="primary" onClick={() => navigate('/candidate/applications')}>
              Xem đơn của tôi
            </Button>,
            <Button key="close" onClick={close}>
              Đóng
            </Button>,
          ]}
        />
      ) : (
        <div className="space-y-4">
          <div className="rounded-xl bg-slate-50 px-4 py-3">
            <div className="font-semibold text-slate-900">{job.title}</div>
            <div className="text-[13px] text-slate-600">{job.companyName}</div>
          </div>

          {error && <Alert type="error" showIcon message={error} />}

          <div>
            <div className="mb-2 text-sm font-semibold text-slate-900">Chọn CV gửi kèm</div>
            {cvs.isLoading ? (
              <Skeleton active paragraph={{ rows: 2 }} />
            ) : (
              <div role="radiogroup" aria-label="Chọn CV" className="space-y-2">
                {(cvs.data ?? []).map((cv) => {
                  const selected = source?.kind === 'vault' && source.cvId === cv.cvId;
                  return (
                    <label
                      key={cv.cvId}
                      className={`flex cursor-pointer items-center gap-3 rounded-xl border border-solid px-3 py-2.5 transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-[color:var(--console-accent)] ${
                        selected ? 'border-[color:var(--console-accent)] bg-[color:var(--console-accent-soft)]' : 'border-slate-200 hover:border-slate-400'
                      }`}
                    >
                      <input
                        type="radio"
                        name="cv"
                        className="sr-only"
                        checked={selected}
                        onChange={() => {
                          setError(null);
                          setSource({ kind: 'vault', cvId: cv.cvId });
                        }}
                      />
                      <FilePdfOutlined className="text-xl text-red-700" aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-slate-900">{cv.title || cv.fileName}</span>
                        <span className="block truncate text-xs text-slate-500">
                          {cv.fileName} · {fileSize(cv.fileSizeBytes)}
                          {cv.isPrimary ? ' · CV chính' : ''}
                        </span>
                      </span>
                      {selected && <CheckCircleFilled className="text-[color:var(--console-accent)]" aria-hidden />}
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <div className="mb-2 text-sm font-semibold text-slate-900">
              {(cvs.data ?? []).length ? 'Hoặc tải CV khác' : 'Tải CV của bạn'}
            </div>
            <Upload.Dragger
              accept="application/pdf,.pdf"
              multiple={false}
              showUploadList={false}
              beforeUpload={(file) => {
                const e = cvFileError(file);
                if (e) message.error(e);
                else {
                  setError(null);
                  setSource({ kind: 'file', file });
                }
                return false;
              }}
              className="!rounded-xl"
            >
              {source?.kind === 'file' ? (
                <p className="m-0 py-1 text-sm text-slate-800">
                  <FilePdfOutlined className="mr-1.5 text-red-700" aria-hidden />
                  {source.file.name} · {fileSize(source.file.size)} <span className="text-slate-500">(bấm để đổi)</span>
                </p>
              ) : (
                <>
                  <p className="ant-upload-drag-icon !mb-1">
                    <InboxOutlined className="!text-[color:var(--console-accent)]" />
                  </p>
                  <p className="ant-upload-hint">PDF, tối đa {MAX_CV_MB}MB. CV mới cũng được lưu vào kho của bạn.</p>
                </>
              )}
            </Upload.Dragger>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button onClick={close}>Hủy</Button>
            <Button type="primary" icon={<SendOutlined />} disabled={!source} loading={apply.isPending} onClick={() => apply.mutate()}>
              Nộp đơn
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
};

/** Role-aware call to action for a job page. Renders nothing for roles that cannot submit. */
export const JobApplyActions: React.FC<{ job: Job }> = ({ job }) => {
  const navigate = useNavigate();
  const role = useAuthStore((s) => s.user?.role);
  const [open, setOpen] = useState(false);

  if (job.status !== 'ACTIVE') return null;

  if (role === UserRole.CANDIDATE) {
    const allowed = job.visibility === 'PUBLIC';
    return (
      <>
        <Button type="primary" size="large" icon={<SendOutlined />} disabled={!allowed} onClick={() => setOpen(true)}>
          Ứng tuyển
        </Button>
        {!allowed && <p className="m-0 mt-1 text-xs text-slate-500">Tin này chỉ nhận hồ sơ qua đối tác.</p>}
        <ApplyModal job={job} open={open} onClose={() => setOpen(false)} />
      </>
    );
  }

  // Affiliates only open job pages they are allowed to see (GET /jobs/{id} applies the service-type
  // rules), so a loaded job here is one they may refer into; the form re-checks it anyway.
  if (role === UserRole.AFFILIATE) {
    return (
      <Button type="primary" size="large" icon={<UserAddOutlined />} onClick={() => navigate(`/affiliate/submit-candidate?job=${job.jobId}`)}>
        Giới thiệu ứng viên
      </Button>
    );
  }

  return null;
};
