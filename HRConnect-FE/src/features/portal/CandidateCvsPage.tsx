/**
 * @file CandidateCvsPage.tsx
 * @description Candidate's CV vault (mockup 03/11) on /candidates/cv plus CVs built in the CV Builder.
 *  CVs sent along with an Affiliate referral have their own page; the second tab links to it.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, App as AntApp, Input, Modal, Popconfirm, Skeleton } from 'antd';
import { FilePdfOutlined, FileTextOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { candidateAffiliateCvApi, candidateCvApi } from '@/services/api/mf02Api';
import { getApiErrorMessage } from '@/services/apiClient';
import { useAuthStore } from '@/stores/authStore';
import type { CandidateCv } from '@/types/api/mf02';
import { CandidateAccountFrame } from './candidate/CandidateAccountFrame';
import {
  cvStorage,
  deleteSavedCv,
  setPrimarySavedCv,
  updateSavedCvTitle,
  CV_STORAGE_EVENT,
  CANDIDATE_CV_UPDATED_EVENT,
} from './candidate/cv-builder/services/cvStorage';
import { candidateKeys, useCandidateCvs, useOpenSignedUrl } from './CandidatePages';
import { MAX_CV_MB, cvFileError, fileSize } from './mf02Labels';

const FONT = "font-['Be_Vietnam_Pro',system-ui,sans-serif]";
const ACTION = `${FONT} flex h-10 cursor-pointer items-center rounded-md border border-solid border-[#D1D5DB] bg-white px-3 text-[14px] text-[#1F2937] hover:bg-[#F9FAFB] disabled:cursor-not-allowed disabled:opacity-60`;
const MAX_TITLE = 180;

const idOf = (cv: CandidateCv) => cv.cvId || cv.id || '';
const titleOf = (cv: CandidateCv) => cv.title || cv.name || cv.fileName || 'CV';
const isBuilt = (cv: CandidateCv) => cv.creationMethod === 'TEMPLATE_FORM' || cv.creationMethod === 'PLATFORM_BUILDER';
/** CVs still kept in this browser by the CV Builder are changed locally, not through the API. */
const isLocal = (cv: CandidateCv) => {
  const id = idOf(cv);
  return Boolean(cv.isOnlineCv || id.startsWith('cv_builder_') || cvStorage.getById(id));
};

export const CandidateCvsPage: React.FC = () => {
  const { message } = AntApp.useApp();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const hasPermission = useAuthStore((state) => state.hasPermission);
  const cvs = useCandidateCvs();
  const openSigned = useOpenSignedUrl();
  const [busyId, setBusyId] = useState<string>();
  const [editing, setEditing] = useState<{ cvId: string; title: string }>();
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const dropZone = useRef<HTMLLabelElement>(null);

  const canView = hasPermission('cv.view_own');
  const canCreate = hasPermission('cv.create');
  const canUpdate = hasPermission('cv.update_own');
  const canDelete = hasPermission('cv.delete_own');

  const partnerCvs = useQuery({
    queryKey: ['candidate-affiliate-cvs', 'count'],
    queryFn: async () => (await candidateAffiliateCvApi.list(1, 1)).total,
    enabled: canView,
  });

  const action = searchParams.get('action');
  useEffect(() => {
    if (action === 'builder' || action === 'new') navigate('/candidate/cv-builder', { replace: true });
    if (action === 'upload') dropZone.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [action, navigate]);

  useEffect(() => {
    const refresh = () => void queryClient.invalidateQueries({ queryKey: candidateKeys.cvs });
    window.addEventListener(CANDIDATE_CV_UPDATED_EVENT, refresh);
    window.addEventListener(CV_STORAGE_EVENT, refresh);
    return () => {
      window.removeEventListener(CANDIDATE_CV_UPDATED_EVENT, refresh);
      window.removeEventListener(CV_STORAGE_EVENT, refresh);
    };
  }, [queryClient]);

  const upload = useMutation({
    mutationFn: (file: File) => candidateCvApi.upload(file, file.name.replace(/\.pdf$/i, '')),
    onSuccess: (result) => {
      message.success(result.message || 'Đã tải CV lên.');
      void queryClient.invalidateQueries({ queryKey: candidateKeys.cvs });
    },
    onError: (error) => message.error(getApiErrorMessage(error, 'Không tải được CV lên.')),
  });

  const pickFile = (file?: File) => {
    if (!file || upload.isPending) return;
    const problem = cvFileError(file);
    if (problem) message.error(problem);
    else upload.mutate(file);
  };

  const act = async (cvId: string, run: () => Promise<{ message?: string }>, done: string) => {
    setBusyId(cvId);
    try {
      const result = await run();
      message.success(result.message || done);
      await queryClient.invalidateQueries({ queryKey: candidateKeys.cvs });
    } catch (error) {
      message.error(getApiErrorMessage(error));
    } finally {
      setBusyId(undefined);
    }
  };

  /** Runs a change on the browser copy or through the API, depending on where the CV lives. */
  const change = (cv: CandidateCv, local: () => void, remote: () => Promise<{ message?: string }>, done: string) => {
    if (isLocal(cv)) {
      local();
      message.success(done);
      void queryClient.invalidateQueries({ queryKey: candidateKeys.cvs });
      return Promise.resolve();
    }
    return act(idOf(cv), remote, done);
  };

  const list = cvs.data ?? [];

  const saveTitle = async () => {
    if (!editing) return;
    const title = editing.title.trim();
    const cv = list.find((item) => idOf(item) === editing.cvId);
    if (!title || title.length > MAX_TITLE || !cv) return;
    await change(cv, () => updateSavedCvTitle(editing.cvId, title), () => candidateCvApi.updateTitle(editing.cvId, title), 'Đã cập nhật tên CV.');
    setEditing(undefined);
  };

  const view = (cv: CandidateCv) => {
    if (isLocal(cv) || isBuilt(cv) && !cv.fileName) navigate(`/candidate/cv-builder/${idOf(cv)}?action=preview`);
    else void openSigned(() => candidateCvApi.downloadUrl(cv.cvId));
  };

  return (
    <CandidateAccountFrame>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="m-0 mb-1 text-[22px] font-bold text-[#1F2937]">Kho CV</h1>
          <p className="m-0 text-[#4B5563]">CV chính được chọn sẵn khi bạn bấm Ứng tuyển và dùng để gợi ý việc làm phù hợp.</p>
        </div>
        {canCreate && (
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => navigate('/candidate/cv-builder')} className={`${FONT} h-[42px] cursor-pointer rounded-xl border border-solid border-sky-600 bg-white px-4 text-[14px] font-semibold text-sky-700 transition-all hover:bg-sky-50 active:scale-[0.98]`}>
              Tạo CV với CV Builder
            </button>
            <button type="button" disabled={upload.isPending} onClick={() => fileInput.current?.click()} className={`${FONT} h-[42px] cursor-pointer rounded-xl border-0 bg-gradient-to-r from-sky-500 to-blue-600 px-4 text-[14px] font-bold text-white shadow-sm shadow-blue-500/20 transition-all hover:from-sky-400 hover:to-blue-500 hover:shadow-md hover:shadow-blue-500/30 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60`}>
              {upload.isPending ? 'Đang tải lên…' : 'Tải CV lên'}
            </button>
          </div>
        )}
      </div>

      {!canView && <Alert className="!mb-3" type="error" showIcon message="Bạn không có quyền xem kho CV cá nhân." />}

      <nav aria-label="Loại CV" className="mb-3 flex flex-wrap gap-1 border-0 border-b border-solid border-[#E5E7EB]">
        <span aria-current="page" className="relative -mb-px flex h-11 items-center border-0 border-b-2 border-solid border-sky-600 px-3 font-bold text-sky-700">CV của tôi ({list.length})</span>
        <Link to="/candidate/affiliate-cvs" className="relative -mb-px flex h-11 items-center border-0 border-b-2 border-solid border-transparent px-3 text-[#4B5563] no-underline transition-colors duration-200 hover:text-sky-700">
          <span className="relative inline-flex flex-col items-center">
            <span aria-hidden="true" className="invisible select-none font-semibold">
              CV đối tác gửi kèm giới thiệu{partnerCvs.data !== undefined ? ` (${partnerCvs.data})` : ''}
            </span>
            <span className="absolute inset-0 flex items-center font-medium">
              CV đối tác gửi kèm giới thiệu{partnerCvs.data !== undefined ? ` (${partnerCvs.data})` : ''}
            </span>
          </span>
        </Link>
      </nav>

      {cvs.isLoading ? (
        <div className="rounded-lg border border-solid border-[#E5E7EB] bg-white p-4"><Skeleton active paragraph={{ rows: 5 }} /></div>
      ) : cvs.isError ? (
        <Alert type="error" showIcon message={getApiErrorMessage(cvs.error)} />
      ) : list.length === 0 ? (
        <div className="rounded-lg border border-solid border-[#E5E7EB] bg-white px-6 py-10 text-center">
          <h2 className="m-0 text-[16px] font-bold">Bạn chưa có CV nào</h2>
          <p className="m-0 mt-2 text-[#4B5563]">Tạo CV bằng CV Builder hoặc tải lên bản PDF có sẵn.</p>
        </div>
      ) : (
        <div className="rounded-lg border border-solid border-[#E5E7EB] bg-white">
          {list.map((cv) => {
            const id = idOf(cv);
            const title = titleOf(cv);
            const built = isBuilt(cv) || isLocal(cv);
            const size = fileSize(cv.fileSizeBytes);
            return (
              <article key={id} className="flex flex-wrap items-center gap-[14px] border-0 border-b border-solid border-[#F1F5F9] p-4">
                <div
                  aria-hidden="true"
                  className={`relative flex h-14 w-11 shrink-0 flex-col items-center justify-between rounded-md border p-1 shadow-xs select-none ${
                    built
                      ? 'border-sky-200 bg-sky-50/80 text-sky-700'
                      : 'border-rose-200 bg-rose-50/80 text-rose-700'
                  }`}
                >
                  <span
                    className={`absolute right-0 top-0 h-2.5 w-2.5 rounded-bl border-b border-l bg-white ${
                      built ? 'border-sky-200' : 'border-rose-200'
                    }`}
                  />
                  <div className="mt-1 flex flex-1 items-center justify-center">
                    {built ? (
                      <FileTextOutlined className="text-[20px] text-sky-600" />
                    ) : (
                      <FilePdfOutlined className="text-[20px] text-rose-600" />
                    )}
                  </div>
                  <span
                    className={`w-full rounded-[3px] py-0.5 text-center text-[9px] font-extrabold uppercase tracking-wider ${
                      built
                        ? 'bg-sky-100 text-sky-800'
                        : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    {built ? 'CV' : 'PDF'}
                  </span>
                </div>
                <div className="min-w-0 flex-[1_1_300px]">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[15px] font-semibold">{title}</span>
                    {cv.isPrimary && <span className="rounded-md bg-sky-50 border border-sky-200 px-2 py-0.5 text-[12px] font-bold text-sky-700">CV chính</span>}
                    {canUpdate && (
                      <button type="button" aria-label={`Đổi tên ${title}`} title="Đổi tên" onClick={() => setEditing({ cvId: id, title })} className="-my-1 flex h-6 w-6 cursor-pointer items-center justify-center rounded border-0 bg-transparent p-0 text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#1F2937]">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4" /></svg>
                      </button>
                    )}
                  </div>
                  <div className="mt-0.5 text-[13px] text-[#4B5563]">
                    {[built ? 'Tạo bằng CV Builder' : 'Tải lên', `Cập nhật ${dayjs(cv.updatedAt || cv.createdAt).format('DD/MM/YYYY')}`, size].filter(Boolean).join(' · ')}
                  </div>
                  <div className="mt-0.5 text-[13px] text-[#6B7280]">Đã dùng ứng tuyển {cv.applicationUsageCount ?? 0} việc</div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {canView && <button type="button" aria-label={`Xem ${title}`} onClick={() => view(cv)} className={ACTION}>Xem</button>}
                  {canUpdate && built && <button type="button" aria-label={`Sửa nội dung ${title}`} onClick={() => navigate(`/candidate/cv-builder/${id}`)} className={ACTION}>Sửa</button>}
                  {canUpdate && !cv.isPrimary && (
                    <button
                      type="button"
                      disabled={busyId === id}
                      onClick={() => void change(cv, () => setPrimarySavedCv(id), () => candidateCvApi.setPrimary(id), 'Đã đặt làm CV chính.')}
                      className={ACTION}
                    >
                      Đặt làm CV chính
                    </button>
                  )}
                  {canDelete && (
                    <Popconfirm
                      title="Gỡ CV khỏi kho?"
                      description={cv.deleteBehavior === 'ARCHIVE_HISTORY'
                        ? 'CV sẽ ẩn khỏi kho cá nhân nhưng bản đã gắn với lượt nộp và đơn ứng tuyển vẫn được giữ làm lịch sử.'
                        : 'CV chưa được sử dụng nên sẽ được xóa khỏi kho.'}
                      okText="Gỡ khỏi kho"
                      okButtonProps={{ danger: true }}
                      cancelText="Hủy"
                      onConfirm={() => change(cv, () => deleteSavedCv(id), () => candidateCvApi.remove(id), 'Đã gỡ CV khỏi kho.')}
                    >
                      <button type="button" aria-label={`Gỡ ${title} khỏi kho`} className="flex h-10 w-11 cursor-pointer items-center justify-center rounded-md border border-solid border-[#D1D5DB] bg-white text-[#B91C1C] hover:bg-[#FEF2F2]">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></svg>
                      </button>
                    </Popconfirm>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {canCreate && (
        <label
          ref={dropZone}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            pickFile(event.dataTransfer.files?.[0]);
          }}
          className={`relative mt-4 flex cursor-pointer flex-col items-center gap-1.5 rounded-lg border border-dashed p-7 text-center text-[#374151] has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-[#0369A1] ${dragging ? 'border-[#0369A1] bg-[#F0F9FF]' : 'border-[#94A3B8] bg-white'}`}
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#0369A1" strokeWidth="1.8" aria-hidden="true"><path d="M12 16V4M7 9l5-5 5 5M5 20h14" /></svg>
          <b>{upload.isPending ? 'Đang tải lên…' : 'Kéo thả CV vào đây hoặc bấm để chọn tệp'}</b>
          <span className="text-[13px] text-[#6B7280]">Chỉ nhận PDF, tối đa {MAX_CV_MB} MB.</span>
          <input
            ref={fileInput}
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

      <Modal
        title="Đổi tên CV"
        open={Boolean(editing)}
        okText="Lưu thay đổi"
        cancelText="Hủy"
        confirmLoading={Boolean(editing && busyId === editing.cvId)}
        okButtonProps={{ disabled: !editing?.title.trim() }}
        onOk={saveTitle}
        onCancel={() => setEditing(undefined)}
      >
        <Input
          autoFocus
          maxLength={MAX_TITLE}
          showCount
          value={editing?.title ?? ''}
          aria-label="Tiêu đề CV"
          onChange={(event) => setEditing((current) => (current ? { ...current, title: event.target.value } : current))}
          onPressEnter={saveTitle}
        />
      </Modal>
    </CandidateAccountFrame>
  );
};
