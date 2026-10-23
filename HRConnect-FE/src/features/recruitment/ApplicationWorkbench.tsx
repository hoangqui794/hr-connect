/**
 * @file ApplicationWorkbench.tsx
 * @description Shared application drawer for Internal HR and Client Company users.
 * It reads GET /recruitment/applications/{id} and renders exactly the actions the backend lists in
 * `allowedActions`, so each role only sees what it may do:
 *   Internal HR  → START_SCREENING (automatic), SHORTLIST, REJECT
 *   Client       → the above for CV_APPLICATION, plus MARK_BACKUP, interview scheduling and results,
 *                  backup decisions, offers, planned start date, confirm start of work, not started.
 * Every write sends the latest concurrencyToken and refreshes the caches afterwards.
 */
import React, { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  App as AntApp,
  Button,
  Checkbox,
  DatePicker,
  Drawer,
  Form,
  Input,
  InputNumber,
  Modal,
  Radio,
  Select,
  Skeleton,
  Tag,
  Tooltip,
} from 'antd';
import { CheckOutlined, CloseOutlined, EditOutlined, ExperimentOutlined, FileOutlined, HistoryOutlined, LoadingOutlined, LockOutlined, SendOutlined, WarningOutlined } from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
import { clientActionsApi, interviewHistoryApi, screeningApi, type ConfirmStartWorkInput } from '@/services/api/hrApi';
import { sourcingApi } from '@/services/api/sourcingApi';
import {
  SOURCING_REJECT_REASONS,
  SOURCING_STATUS_CONFIG,
  getRejectReasonLabel,
  getSourcingReviewDeadlineInfo,
} from '@/features/sourcing/sourcingUtils';
import { getApiError, getApiErrorMessage } from '@/services/apiClient';
import { deliveryFeedback, type CandidateDeliveryActionResult } from './candidateDeliveryFeedback';
import type { RecruitmentApplicationDetail } from '@/types/api/hr';
import { Initials, StatusDot } from '@/features/admin-console/ui';
import {
  INTERVIEW_RESULT,
  INTERVIEW_STATUS,
  OFFER_STATUS,
  REJECTION_REASONS,
  SERVICE_TYPE,
  parseHighlights,
  pick,
  reasonLabel,
  applicationStatusOf,
} from '@/features/hr-console/hrLabels';

export type WorkbenchAudience = 'hr' | 'client';

const fmt = (v?: string | null, f = 'HH:mm DD/MM/YYYY') => (v ? dayjs(v).format(f) : '—');
const money = (v: number | null, c: string) => (v == null ? '—' : `${new Intl.NumberFormat('vi-VN').format(v)} ${c === 'VND' ? '₫' : c}`);
const REQUIRED = [{ required: true, whitespace: true, message: 'Vui lòng nhập lý do.' }];

export const Row: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="flex justify-between gap-4 border-0 border-t border-solid border-slate-100 py-2.5 text-sm first:border-t-0">
    <span className="shrink-0 text-slate-600">{label}</span>
    <span className="min-w-0 text-right font-medium text-slate-900">{children}</span>
  </div>
);

export const Panel: React.FC<{ title?: string; children: React.ReactNode; extra?: React.ReactNode }> = ({ title, children, extra }) => (
  <section className="admin-surface p-5">
    {title && (
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="m-0 text-sm font-semibold text-slate-900">{title}</h3>
        {extra}
      </div>
    )}
    {children}
  </section>
);

type ModalKind =
  | 'reject'
  | 'schedule'
  | 'editInterview'
  | 'reschedule'
  | 'cancel'
  | 'result'
  | 'noshow'
  | 'rejectBackup'
  | 'offer'
  | 'withdraw'
  | 'plannedStart'
  | 'startWork'
  | 'notStarted'
  | 'clientRejectSourcing';

const MODAL_TITLE: Record<ModalKind, string> = {
  reject: 'Loại hồ sơ',
  schedule: 'Lên lịch phỏng vấn',
  editInterview: 'Chỉnh sửa thông tin lịch',
  reschedule: 'Dời lịch phỏng vấn',
  cancel: 'Hủy lịch phỏng vấn',
  result: 'Ghi kết quả phỏng vấn',
  noshow: 'Ghi nhận ứng viên vắng mặt',
  rejectBackup: 'Loại ứng viên dự phòng',
  offer: 'Offer cho ứng viên',
  withdraw: 'Thu hồi offer',
  plannedStart: 'Ngày dự kiến nhận việc',
  startWork: 'Xác nhận ứng viên đã đi làm',
  notStarted: 'Ứng viên không nhận việc',
  clientRejectSourcing: 'Từ chối CV (CV Sourcing)',
};

const DANGER_MODALS: ModalKind[] = ['reject', 'cancel', 'noshow', 'rejectBackup', 'withdraw', 'notStarted', 'clientRejectSourcing'];
const INTERVIEW_TYPES = [
  { value: 'OFFLINE', label: 'Trực tiếp' },
  { value: 'ONLINE', label: 'Trực tuyến' },
  { value: 'PHONE', label: 'Điện thoại' },
];
const notPast = (d: Dayjs) => d.isBefore(dayjs().startOf('day'));
const SALARY_BASIS_OPTIONS = [
  { value: 'GROSS', label: 'Gross' },
  { value: 'NET', label: 'Net' },
];
const SALARY_PERIOD_OPTIONS = [
  { value: 'MONTHLY', label: 'Theo tháng' },
  { value: 'ANNUAL', label: 'Theo năm' },
];

type StartWorkAttempt = { applicationId: string; input: ConfirmStartWorkInput };

export const invalidateRecruitment = async (
  qc: ReturnType<typeof useQueryClient>,
  applicationId?: string
) => {
  const promises: Promise<unknown>[] = [
    qc.invalidateQueries({
      predicate: (q) => {
        const k = String(q.queryKey[0] ?? '');
        return k.startsWith('hr-') || k.startsWith('client-');
      },
    }),
  ];
  if (applicationId) {
    promises.push(
      qc.invalidateQueries({ queryKey: ['hr-application', applicationId], refetchType: 'all' }),
      qc.invalidateQueries({ queryKey: ['hr-application-timeline', applicationId], refetchType: 'all' })
    );
  }
  await Promise.all(promises);
};

export const ApplicationWorkbench: React.FC<{
  applicationId?: string;
  audience: WorkbenchAudience;
  onClose: () => void;
}> = ({ applicationId, audience, onClose }) => {
  const { message, modal } = AntApp.useApp();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState<ModalKind | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [historyInterviewId, setHistoryInterviewId] = useState<string | null>(null);
  const [form] = Form.useForm();
  const selectedInterviewType = Form.useWatch('interviewType', form);
  const startedFor = useRef<string>();
  const pendingStartWork = useRef<StartWorkAttempt>();

  const detail = useQuery({
    queryKey: ['hr-application', applicationId],
    queryFn: () => screeningApi.get(applicationId!),
    enabled: Boolean(applicationId),
  });

  const interviewHistory = useQuery({
    queryKey: ['interview-history', historyInterviewId],
    queryFn: () => interviewHistoryApi.get(historyInterviewId!),
    enabled: Boolean(historyInterviewId),
  });
  const timeline = useQuery({
    queryKey: ['hr-application-timeline', applicationId],
    queryFn: () => screeningApi.timeline(applicationId!),
    enabled: Boolean(applicationId),
  });

  const d = detail.data;
  const actions = d?.allowedActions ?? [];
  const has = (a: string) => actions.includes(a);
  const interview = d?.interviews.filter((i) => i.status === 'SCHEDULED').sort((a, b) => (b.scheduledAt ?? '').localeCompare(a.scheduledAt ?? ''))[0];
  const effectiveInterviewType = open === 'reschedule' ? interview?.interviewType : selectedInterviewType;
  const offer = d ? [...d.offers].sort((a, b) => b.offerVersion - a.offerVersion)[0] : undefined;
  const acceptedOffer = d?.offers.find((o) => o.status === 'ACCEPTED') ?? offer;

  // MF-03: opening an application starts screening (idempotent on the backend).
  const start = useMutation({
    mutationFn: (x: RecruitmentApplicationDetail) => screeningApi.startScreening(x.jobId, x.applicationId),
    onSuccess: async (res) => {
      if (res.changed) {
        await invalidateRecruitment(queryClient, applicationId);
        if (applicationId) {
          await Promise.all([detail.refetch(), timeline.refetch()]);
        }
      }
    },
  });
  useEffect(() => {
    if (d && d.allowedActions.includes('START_SCREENING') && startedFor.current !== d.applicationId) {
      startedFor.current = d.applicationId;
      start.mutate(d);
    }
  }, [d, start]);

  const isCvSourcing = d?.serviceTypeCode === 'CV_SOURCING';

  const sourcingDeliveries = useQuery({
    queryKey: ['sourcing-deliveries', d?.jobId],
    queryFn: () => sourcingApi.getDeliveries(d!.jobId),
    enabled: Boolean(d?.jobId && isCvSourcing),
  });

  const sourcingDelivery = sourcingDeliveries.data?.items.find((item) => item.applicationId === d?.applicationId);

  // Deliver CV to Client (Internal HR)
  const deliverMutation = useMutation({
    mutationFn: () => sourcingApi.deliverCvs(d!.jobId, [d!.applicationId]),
    onSuccess: async () => {
      message.success('Đã giao CV cho khách hàng thành công. Doanh nghiệp có 7 ngày để phản hồi.');
      await invalidateRecruitment(queryClient, applicationId);
      queryClient.invalidateQueries({ queryKey: ['sourcing-deliveries', d?.jobId] });
      if (applicationId) {
        await Promise.all([detail.refetch(), timeline.refetch()]);
      }
    },
    onError: (err) => {
      message.error(getApiErrorMessage(err, 'Không thể giao CV cho khách hàng.'));
    },
  });

  // Client accept/reject decision mutation
  const clientDecisionMutation = useMutation({
    mutationFn: (variables: { decision: 'ACCEPTED' | 'REJECTED'; reasonCode?: string; note?: string }) =>
      sourcingApi.decideDelivery(d!.jobId, sourcingDelivery!.deliveryId, variables),
    onSuccess: async (_res, vars) => {
      message.success(vars.decision === 'ACCEPTED' ? 'Đã chấp nhận CV thành công.' : 'Đã từ chối CV với lý do hợp lệ.');
      setOpen(null);
      // N23: show the new status at once instead of waiting for a page reload.
      queryClient.setQueryData<typeof sourcingDeliveries.data>(['sourcing-deliveries', d?.jobId], (old) =>
        old
          ? { ...old, items: old.items.map((item) => (item.deliveryId === sourcingDelivery?.deliveryId ? { ...item, status: vars.decision } : item)) }
          : old
      );
      await invalidateRecruitment(queryClient, applicationId);
      queryClient.invalidateQueries({ queryKey: ['sourcing-deliveries', d?.jobId] });
      await Promise.all([sourcingDeliveries.refetch(), detail.refetch(), timeline.refetch()]);
    },
    onError: (err) => {
      message.error(getApiErrorMessage(err, 'Không thể thực hiện phản hồi cho CV này.'));
    },
  });

  /** Runs one write; closes the modal and refreshes everything on success. */
  const run = useMutation({
    mutationFn: async (job: () => Promise<{ message?: string } | unknown>) => job(),
    onSuccess: async (res, _vars) => {
      pendingStartWork.current = undefined;
      message.success(deliveryFeedback(res as CandidateDeliveryActionResult | undefined, 'Đã cập nhật hồ sơ.'));
      setOpen(null);
      form.resetFields();
      await invalidateRecruitment(queryClient, applicationId);
      if (applicationId) {
        await Promise.all([detail.refetch(), timeline.refetch()]);
      }
    },
    onError: async (err) => {
      const attempt = pendingStartWork.current;
      pendingStartWork.current = undefined;
      const error = getApiError(err, 'Không thực hiện được thao tác.');
      if (attempt && error.code === 'REPLACEMENT_SLOT_ALREADY_FILLED') {
        modal.confirm({
          title: 'Suất thay thế không còn',
          content: 'Suất thay thế không còn. Nếu vẫn nhận ứng viên này thì sẽ tính phí như tuyển mới.',
          okText: 'Nhận như tuyển mới',
          cancelText: 'Hủy',
          onOk: async () => {
            try {
              const res = await clientActionsApi.confirmStartWork(attempt.applicationId, {
                ...attempt.input,
                acceptAsNewHire: true,
              });
              const msg = (res as { message?: string } | undefined)?.message;
              message.success(msg || 'Đã nhận ứng viên như một tuyển dụng mới.');
              setOpen(null);
              form.resetFields();
            } catch (retryError) {
              message.error(getApiErrorMessage(retryError, 'Không thể nhận ứng viên như tuyển mới.'));
            } finally {
              await invalidateRecruitment(queryClient, applicationId);
              if (applicationId) {
                await Promise.all([detail.refetch(), timeline.refetch()]);
              }
            }
          },
        });
      } else {
        message.error(error.message);
      }
      await invalidateRecruitment(queryClient, applicationId); // a 409 means someone else changed it
      if (applicationId) {
        await Promise.all([detail.refetch(), timeline.refetch()]);
      }
    },
  });
  const isUpdating = run.isPending || start.isPending || deliverMutation.isPending || clientDecisionMutation.isPending;
  const isRefetching = detail.isFetching || timeline.isFetching;
  const busy = isUpdating || isRefetching || Boolean(pendingAction);
  const token = d?.concurrencyToken ?? '';

  const retry = useMutation({
    mutationFn: () => screeningApi.retryAiScoring(applicationId!),
    onSuccess: async (res) => {
      message.success(res.message || 'Đã gửi yêu cầu AI chấm lại.');
      await invalidateRecruitment(queryClient, applicationId);
      if (applicationId) {
        await Promise.all([detail.refetch(), timeline.refetch()]);
      }
    },
    onError: (err) => message.error(getApiErrorMessage(err, 'Không gửi được yêu cầu chấm lại.')),
  });

  // Open the tab synchronously (popup blockers allow it), then point it at the signed link.
  const viewCv = useMutation({
    mutationFn: () => screeningApi.cvDownloadUrl(applicationId!),
  });
  const viewMaskedCv = useMutation({ mutationFn: () => screeningApi.maskedCv(applicationId!) });
  const openMaskedCv = () => {
    const tab = window.open('', '_blank');
    if (tab) tab.opener = null;
    viewMaskedCv.mutate(undefined, {
      onSuccess: (blob) => {
        const url = URL.createObjectURL(blob);
        if (tab) tab.location.href = url;
        else window.location.href = url;
        window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      },
      onError: async (err) => {
        tab?.close();
        // Errors come back as a Blob because of responseType: 'blob'.
        const data = (err as { response?: { data?: unknown } })?.response?.data;
        const text = data instanceof Blob ? await data.text().catch(() => '') : '';
        const parsed = (() => { try { return JSON.parse(text) as { message?: string }; } catch { return null; } })();
        message.error(parsed?.message ?? getApiErrorMessage(err, 'Không mở được CV.'));
      },
    });
  };
  const openCv = () => {
    const tab = window.open('', '_blank');
    if (tab) tab.opener = null;
    viewCv.mutate(undefined, {
      onSuccess: (link) => {
        if (tab) tab.location.href = link.downloadUrl;
        else window.location.href = link.downloadUrl;
      },
      onError: (err) => {
        tab?.close();
        message.error(getApiErrorMessage(err, 'Không mở được CV.'));
      },
    });
  };

  const openModal = (kind: ModalKind) => {
    form.resetFields();
    if (kind === 'offer' && has('UPDATE_OFFER') && offer) {
      form.setFieldsValue({
        salary: offer.salary ?? undefined,
        currencyCode: offer.currencyCode || 'VND',
        salaryBasis: offer.salaryBasis ?? 'GROSS',
        salaryPeriod: offer.salaryPeriod ?? 'MONTHLY',
        startDate: offer.startDate ? dayjs(offer.startDate) : undefined,
        expiryDate: offer.expiryDate ? dayjs(offer.expiryDate) : undefined,
        offerDocumentUrl: offer.offerDocumentUrl ?? undefined,
      });
    } else if (kind === 'offer') form.setFieldsValue({ currencyCode: 'VND', salaryBasis: 'GROSS', salaryPeriod: 'MONTHLY' });
    if (kind === 'schedule') form.setFieldsValue({ durationMinutes: 60, interviewType: 'OFFLINE' });
    if (kind === 'editInterview' && interview)
      form.setFieldsValue({
        durationMinutes: interview.durationMinutes ?? 60,
        interviewType: interview.interviewType ?? undefined,
        location: interview.location ?? undefined,
        meetingLink: interview.meetingLink ?? undefined,
      });
    if (kind === 'reschedule' && interview)
      form.setFieldsValue({ durationMinutes: interview.durationMinutes ?? 60, location: interview.location ?? undefined, meetingLink: interview.meetingLink ?? undefined });
    if (kind === 'startWork') form.setFieldsValue({ actualStartDate: dayjs() });
    setOpen(kind);
  };

  const screen = (target: 'SHORTLISTED' | 'BACKUP', extra?: { reason?: string }) =>
    run.mutate(() => screeningApi.updateStatus(d!.jobId, d!.applicationId, { targetStatus: target, concurrencyToken: token, ...extra }));

  const confirmShortlist = () =>
    modal.confirm({
      title: audience === 'hr' ? 'Chọn hồ sơ này gửi Client?' : 'Chọn ứng viên này để phỏng vấn?',
      content:
        audience !== 'hr'
          ? `${d?.candidateFullName} sẽ chuyển sang bước phỏng vấn.`
          : isCvSourcing
            ? `Hồ sơ của ${d?.candidateFullName} được chọn. Bấm "Giao CV cho khách hàng" ở bước tiếp theo để Client chấp nhận hoặc từ chối CV.`
            : `Client sẽ thấy hồ sơ của ${d?.candidateFullName} (đã che liên hệ) và có thể lên lịch phỏng vấn.`,
      okText: audience === 'hr' ? 'Chọn gửi Client' : 'Chọn ứng viên',
      cancelText: 'Hủy',
      okButtonProps: { loading: run.isPending || pendingAction === 'short' },
      onOk: async () => {
        setPendingAction('short');
        try {
          await run.mutateAsync(() => screeningApi.updateStatus(d!.jobId, d!.applicationId, { targetStatus: 'SHORTLISTED', concurrencyToken: token }));
        } finally {
          setPendingAction(null);
        }
      },
    });

  const confirmSendOffer = () =>
    modal.confirm({
      title: 'Gửi offer cho ứng viên?',
      content: `Offer ${money(offer?.salary ?? null, offer?.currencyCode ?? 'VND')} sẽ được gửi tới ${d?.candidateFullName}. Sau khi gửi, bạn không sửa được nội dung.`,
      okText: 'Gửi offer',
      cancelText: 'Hủy',
      okButtonProps: { loading: run.isPending || pendingAction === 'send' },
      onOk: async () => {
        setPendingAction('send');
        try {
          await run.mutateAsync(() => clientActionsApi.sendOffer(offer!.offerId, offer!.concurrencyToken));
        } finally {
          setPendingAction(null);
        }
      },
    });

  const confirmBackup = () =>
    modal.confirm({
      title: 'Đưa hồ sơ vào danh sách dự phòng?',
      content: 'Ứng viên được giữ lại và có thể được chọn sau nếu cần.',
      okText: 'Đưa vào dự phòng',
      cancelText: 'Hủy',
      okButtonProps: { loading: run.isPending || pendingAction === 'backup' },
      onOk: async () => {
        setPendingAction('backup');
        try {
          await run.mutateAsync(() => screeningApi.updateStatus(d!.jobId, d!.applicationId, { targetStatus: 'BACKUP', concurrencyToken: token }));
        } finally {
          setPendingAction(null);
        }
      },
    });

  const submitModal = async (v: Record<string, any>) => {
    if (!d || !open) return;
    const day = (x?: Dayjs) => (x ? x.format('YYYY-MM-DD') : undefined);
    const trim = (x?: string) => x?.trim() || undefined;
    setPendingAction(open);
    try {
      switch (open) {
        case 'reject':
          return await run.mutateAsync(() => screeningApi.updateStatus(d.jobId, d.applicationId, { targetStatus: 'REJECTED', reasonCode: v.reasonCode, reason: trim(v.reason), concurrencyToken: token }));
        case 'schedule':
          return await run.mutateAsync(() =>
            clientActionsApi.scheduleInterview(d.applicationId, {
              scheduledAt: (v.scheduledAt as Dayjs).toISOString(),
              durationMinutes: v.durationMinutes,
              interviewType: v.interviewType,
              location: trim(v.location),
              meetingLink: trim(v.meetingLink),
              applicationConcurrencyToken: token,
            })
          );
        case 'editInterview':
          return await run.mutateAsync(() =>
            clientActionsApi.updateInterview(interview!.interviewId, {
              durationMinutes: v.durationMinutes,
              interviewType: v.interviewType,
              location: trim(v.location),
              meetingLink: trim(v.meetingLink),
              concurrencyToken: interview!.concurrencyToken,
            })
          );
        case 'reschedule':
          return await run.mutateAsync(() =>
            clientActionsApi.rescheduleInterview(interview!.interviewId, {
              newScheduledAt: (v.newScheduledAt as Dayjs).toISOString(),
              reason: v.reason.trim(),
              durationMinutes: v.durationMinutes,
              location: trim(v.location),
              meetingLink: trim(v.meetingLink),
              concurrencyToken: interview!.concurrencyToken,
            })
          );
        case 'cancel':
          return await run.mutateAsync(() => clientActionsApi.cancelInterview(interview!.interviewId, { reason: v.reason.trim(), concurrencyToken: interview!.concurrencyToken }));
        case 'noshow':
          return await run.mutateAsync(() => clientActionsApi.recordNoShow(interview!.interviewId, { reason: v.reason.trim(), concurrencyToken: interview!.concurrencyToken }));
        case 'result':
          return await run.mutateAsync(() =>
            clientActionsApi.recordResult(interview!.interviewId, {
              result: v.result,
              feedback: trim(v.feedback),
              nextAction: v.result === 'PASS' ? v.nextAction || undefined : undefined,
              concurrencyToken: interview!.concurrencyToken,
            })
          );
        case 'rejectBackup':
          return await run.mutateAsync(() => clientActionsApi.decideBackup(d.applicationId, { decision: 'REJECT', reason: trim(v.reason), concurrencyToken: token }));
        case 'offer':
          return await run.mutateAsync(() =>
            has('UPDATE_OFFER') && offer
              ? clientActionsApi.updateOffer(offer.offerId, {
                  salary: v.salary,
                  currencyCode: v.currencyCode,
                  salaryBasis: v.salaryBasis,
                  salaryPeriod: v.salaryPeriod,
                  startDate: day(v.startDate),
                  expiryDate: day(v.expiryDate),
                  // An empty value deliberately clears an existing document link.
                  offerDocumentUrl: trim(v.offerDocumentUrl) ?? '',
                  concurrencyToken: offer.concurrencyToken,
                })
              : clientActionsApi.createOffer(d.applicationId, {
                  salary: v.salary,
                  currencyCode: v.currencyCode,
                  salaryBasis: v.salaryBasis,
                  salaryPeriod: v.salaryPeriod,
                  startDate: day(v.startDate),
                  expiryDate: day(v.expiryDate),
                  offerDocumentUrl: trim(v.offerDocumentUrl),
                  concurrencyToken: token,
                })
          );
        case 'withdraw':
          return await run.mutateAsync(() => clientActionsApi.withdrawOffer(offer!.offerId, { reason: v.reason.trim(), concurrencyToken: offer!.concurrencyToken }));
        case 'plannedStart':
          return await run.mutateAsync(() => clientActionsApi.setPlannedStart(d.applicationId, { plannedStartDate: day(v.plannedStartDate)!, reason: trim(v.reason), concurrencyToken: token }));
        case 'startWork': {
          const input: ConfirmStartWorkInput = {
            offerId: acceptedOffer!.offerId,
            actualStartDate: day(v.actualStartDate)!,
            position: trim(v.position),
            department: trim(v.department),
            confirmationNote: trim(v.note),
            concurrencyToken: token,
          };
          pendingStartWork.current = { applicationId: d.applicationId, input };
          return await run.mutateAsync(() => clientActionsApi.confirmStartWork(d.applicationId, input));
        }
        case 'notStarted':
          return await run.mutateAsync(() => clientActionsApi.markNotStarted(d.applicationId, { reason: v.reason.trim(), concurrencyToken: token }));
        case 'clientRejectSourcing':
          return await clientDecisionMutation.mutateAsync({
            decision: 'REJECTED',
            reasonCode: v.reasonCode,
            note: trim(v.note),
          });
      }
    } finally {
      setPendingAction(null);
    }
  };

  const st = d ? applicationStatusOf(d.status, d.serviceTypeCode, sourcingDelivery?.status) : null;
  const highlights = parseHighlights(d?.aiMatch?.candidateHighlight);

  // Footer buttons: secondary/danger on the left, the main step on the right.
  const footer: React.ReactNode[] = [];
  const btn = (
    key: string,
    label: string,
    onClick: () => void,
    o: { type?: 'primary'; danger?: boolean; icon?: React.ReactNode; loading?: boolean } = {}
  ) =>
    footer.push(
      <Button
        key={key}
        size="large"
        type={o.type}
        danger={o.danger}
        icon={o.icon}
        disabled={busy}
        loading={o.loading ?? (pendingAction === key || (busy && !pendingAction && o.type === 'primary'))}
        onClick={onClick}
      >
        {label}
      </Button>
    );
  if (has('MARK_BACKUP')) btn('backup', 'Đưa vào dự phòng', confirmBackup);
  if (has('REJECT')) btn('reject', 'Loại hồ sơ', () => openModal('reject'), { danger: true, icon: <CloseOutlined /> });
  if (has('REJECT_BACKUP')) btn('rejb', 'Loại dự phòng', () => openModal('rejectBackup'), { danger: true });
  if (has('CANCEL_INTERVIEW')) btn('cancel', 'Hủy lịch', () => openModal('cancel'), { danger: true });
  if (has('RECORD_NO_SHOW')) btn('noshow', 'Vắng mặt', () => openModal('noshow'));
  if (has('UPDATE_INTERVIEW')) btn('editInterview', 'Sửa thông tin lịch', () => openModal('editInterview'), { icon: <EditOutlined /> });
  if (has('RESCHEDULE_INTERVIEW')) btn('resched', 'Dời lịch', () => openModal('reschedule'));
  if (has('WITHDRAW_OFFER')) btn('withdraw', 'Thu hồi offer', () => openModal('withdraw'), { danger: true });
  if (has('MARK_NOT_STARTED')) btn('nostart', 'Không nhận việc', () => openModal('notStarted'), { danger: true });
  if (has('CONFIRM_PLANNED_START_DATE')) btn('planned', 'Ngày dự kiến', () => openModal('plannedStart'));
  if (has('UPDATE_OFFER')) btn('upd', 'Sửa offer', () => openModal('offer'));
  if (has('SELECT_BACKUP'))
    btn(
      'selb',
      'Chọn ứng viên dự phòng',
      async () => {
        setPendingAction('selb');
        try {
          await run.mutateAsync(() => clientActionsApi.decideBackup(d!.applicationId, { decision: 'SELECT', concurrencyToken: token }));
        } finally {
          setPendingAction(null);
        }
      },
      { type: 'primary' }
    );
  if (has('SHORTLIST'))
    btn('short', audience === 'hr' ? 'Chọn gửi Client' : 'Chọn ứng viên', confirmShortlist, { type: 'primary', icon: <CheckOutlined /> });
  if (has('SCHEDULE_INTERVIEW')) btn('sched', 'Lên lịch phỏng vấn', () => openModal('schedule'), { type: 'primary' });
  if (has('RECORD_INTERVIEW_RESULT')) btn('result', 'Ghi kết quả', () => openModal('result'), { type: 'primary' });
  if (has('CREATE_OFFER')) btn('offer', 'Tạo offer', () => openModal('offer'), { type: 'primary' });
  if (has('SEND_OFFER')) btn('send', 'Gửi offer', confirmSendOffer, { type: 'primary' });
  if (has('CONFIRM_PLACEMENT')) btn('place', 'Xác nhận đã đi làm', () => openModal('startWork'), { type: 'primary' });

  // MF-03: CV_SOURCING delivery actions
  if (isCvSourcing) {
    if (audience === 'hr') {
      if (sourcingDelivery) {
        const scfg = SOURCING_STATUS_CONFIG[sourcingDelivery.status];
        btn('sourcingStatus', `CV Sourcing: ${scfg?.label || sourcingDelivery.status}`, () => {}, {
          icon: <CheckOutlined />,
        });
      } else if (d?.status === 'SHORTLISTED') {
        btn(
          'deliverCv',
          'Giao CV cho khách hàng',
          () => {
            modal.confirm({
              title: 'Giao CV cho khách hàng?',
              content: `Bàn giao hồ sơ của ${d.candidateFullName} cho Doanh nghiệp. Doanh nghiệp sẽ có 7 ngày để xem xét và phản hồi.`,
              okText: 'Giao CV cho khách hàng',
              cancelText: 'Hủy',
              okButtonProps: { loading: deliverMutation.isPending },
              onOk: () => deliverMutation.mutateAsync(),
            });
          },
          { type: 'primary', icon: <SendOutlined /> }
        );
      }
    } else if (audience === 'client' && sourcingDelivery && sourcingDelivery.status === 'DELIVERED') {
      const deadline = getSourcingReviewDeadlineInfo(sourcingDelivery);
      if (!deadline.isExpired) {
        btn(
          'clientRejectCv',
          'Từ chối CV',
          () => openModal('clientRejectSourcing'),
          { danger: true, icon: <CloseOutlined /> }
        );
        btn(
          'clientAcceptCv',
          'Chấp nhận CV',
          () => {
            modal.confirm({
              title: 'Xác nhận chấp nhận CV?',
              content: `Xác nhận hồ sơ của ${d?.candidateFullName} phù hợp với yêu cầu tuyển dụng.`,
              okText: 'Chấp nhận CV',
              cancelText: 'Hủy',
              okButtonProps: { loading: clientDecisionMutation.isPending },
              onOk: () => clientDecisionMutation.mutateAsync({ decision: 'ACCEPTED' }),
            });
          },
          { type: 'primary', icon: <CheckOutlined /> }
        );
      }
    }
  }

  const watchedResult = Form.useWatch('result', form);
  const watchedSalary = Form.useWatch('salary', form) as number | undefined;
  const watchedSalaryBasis = Form.useWatch('salaryBasis', form) as 'GROSS' | 'NET' | undefined;
  const watchedSalaryPeriod = Form.useWatch('salaryPeriod', form) as 'MONTHLY' | 'ANNUAL' | undefined;
  const watchedCurrencyCode = Form.useWatch('currencyCode', form) as string | undefined;
  const isHeadhuntCod = d?.serviceTypeCode === 'HEADHUNT_COD';
  const monthlyGrossPreview =
    typeof watchedSalary === 'number' && watchedSalary >= 0 && watchedSalaryBasis === 'GROSS'
      ? watchedSalaryPeriod === 'ANNUAL'
        ? watchedSalary / 12
        : watchedSalary
      : null;

  return (
    <Drawer
      open={Boolean(applicationId)}
      // N7: a fixed width plus a viewport cap keeps the panel on screen at ~800px and on phones.
      width={760}
      onClose={onClose}
      title="Hồ sơ ứng tuyển"
      destroyOnClose
      styles={{ wrapper: { maxWidth: '100vw' }, body: { background: '#F4F7FB', padding: 'clamp(12px, 3vw, 20px)' } }}
      footer={footer.length ? <div className="flex flex-wrap justify-end gap-2 py-1">{footer}</div> : null}
    >
      {detail.isLoading ? (
        <Skeleton active avatar paragraph={{ rows: 10 }} />
      ) : detail.isError || !d ? (
        <Alert type="error" showIcon message={getApiErrorMessage(detail.error, 'Không tải được hồ sơ.')} />
      ) : (
        <div className="space-y-4">
          <Panel>
            <div className="flex items-start gap-4">
              <Initials name={d.candidateFullName} size={56} />
              <div className="min-w-0 flex-1">
                <div className="text-lg font-bold text-slate-900">{d.candidateFullName}</div>
                <div className="truncate text-sm text-slate-600">
                  {d.jobTitle} · {d.companyName}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {st && <StatusDot tone={st.tone}>{st.label}</StatusDot>}
                  {d.serviceTypeCode && (
                    <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">{SERVICE_TYPE[d.serviceTypeCode] ?? d.serviceTypeCode}</span>
                  )}
                  {d.isReplacement && (
                    <span className="rounded-md bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-900">Người thay thế – không tính phí mới</span>
                  )}
                </div>
              </div>
            </div>
            {audience === 'hr' ? (
              <div className="mt-4 rounded-xl bg-sky-50 px-4 py-3 text-[13px] text-sky-950">
                {d.contactOwner === 'InternalHr'
                  ? 'Internal HR là bên liên hệ ứng viên cho job này. Client chỉ thấy thông tin liên hệ khi ứng viên đã đi làm.'
                  : 'Sau khi bạn chọn, HR của Client sẽ tự liên hệ ứng viên.'}
              </div>
            ) : d.isContactMasked ? (
              <div className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-[13px] text-amber-950">
                Thông tin liên hệ được ẩn: HR Connect liên hệ ứng viên thay bạn cho dịch vụ này, và sẽ hiển thị sau khi ứng viên đi làm.
              </div>
            ) : null}
            {d.status === 'REJECTED' && (
              <div className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-[13px] text-red-900">
                <b>Lý do loại:</b> {reasonLabel(d.statusReasonCode) ?? '—'}
                {d.statusReason ? ` — ${d.statusReason}` : ''}
              </div>
            )}
          </Panel>

          {/* Sourcing Delivery Info (MF-03) */}
          {isCvSourcing && (
            <Panel title="Dịch vụ CV Sourcing">
              {sourcingDelivery ? (
                <div className="space-y-2 text-sm">
                  <Row label="Trạng thái bàn giao">
                    <Tag color={SOURCING_STATUS_CONFIG[sourcingDelivery.status]?.tagColor} className="m-0 font-medium">
                      {SOURCING_STATUS_CONFIG[sourcingDelivery.status]?.label || sourcingDelivery.status}
                    </Tag>
                  </Row>
                  <Row label="Bàn giao lúc">{fmt(sourcingDelivery.deliveredAt)}</Row>
                  <Row label="Thời hạn phản hồi">
                    <span>
                      {fmt(sourcingDelivery.reviewDueAt)}
                      {sourcingDelivery.status === 'DELIVERED' && (
                        <span className="ml-2 font-semibold text-amber-700">
                          ({getSourcingReviewDeadlineInfo(sourcingDelivery).countdownText})
                        </span>
                      )}
                    </span>
                  </Row>
                  {sourcingDelivery.rejectReasonCode && (
                    <Row label="Lý do từ chối">
                      <span className="text-red-700 font-medium">
                        {getRejectReasonLabel(sourcingDelivery.rejectReasonCode)}
                      </span>
                      {sourcingDelivery.rejectNote && (
                        <div className="text-xs text-slate-500 italic mt-0.5">"{sourcingDelivery.rejectNote}"</div>
                      )}
                    </Row>
                  )}
                  {sourcingDelivery.decidedAt && (
                    <Row label="Thời điểm phản hồi">{fmt(sourcingDelivery.decidedAt)}</Row>
                  )}
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                  <span className="text-slate-600">
                    {d.status === 'SHORTLISTED'
                      ? 'Hồ sơ đã đạt sàng lọc và sẵn sàng bàn giao cho Doanh nghiệp.'
                      : 'Hồ sơ chưa bàn giao cho Doanh nghiệp.'}
                  </span>
                  {audience === 'hr' && d.status === 'SHORTLISTED' && (
                    <Button
                      type="primary"
                      size="small"
                      icon={<SendOutlined />}
                      loading={deliverMutation.isPending}
                      onClick={() => {
                        modal.confirm({
                          title: 'Giao CV cho khách hàng?',
                          content: `Bàn giao hồ sơ của ${d.candidateFullName} cho Doanh nghiệp. Doanh nghiệp sẽ có 7 ngày để chấp nhận hoặc từ chối CV.`,
                          okText: 'Giao CV cho khách hàng',
                          cancelText: 'Hủy',
                          okButtonProps: { loading: deliverMutation.isPending },
                          onOk: () => deliverMutation.mutateAsync(),
                        });
                      }}
                    >
                      Giao CV ngay
                    </Button>
                  )}
                </div>
              )}
            </Panel>
          )}

          {/* Interview / offer / placement progress (MF-04) */}
          {(d.interviews.length > 0 || d.offers.length > 0 || d.placement) && (
            <Panel title="Tiến độ tuyển dụng">
              <div className="space-y-3 text-sm">
                {d.interviews.map((i) => {
                  const s = pick(INTERVIEW_STATUS, i.status);
                  return (
                    <div key={i.interviewId} className="rounded-xl bg-slate-50 px-4 py-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-medium text-slate-900">Phỏng vấn vòng {i.interviewRound}</span>
                        <StatusDot tone={s.tone}>{s.label}</StatusDot>
                      </div>
                      <div className="mt-1 text-[13px] text-slate-600">
                        {fmt(i.scheduledAt)} · {i.durationMinutes ?? '—'} phút · {i.interviewType ?? '—'}
                        {i.location ? ` · ${i.location}` : ''}
                      </div>
                      {i.meetingLink && <div className="truncate text-[13px] text-slate-600">Link: {i.meetingLink}</div>}
                      {i.result && <div className="mt-1 text-[13px] text-slate-800">Kết quả: {INTERVIEW_RESULT[i.result] ?? i.result}{i.feedback ? ` — ${i.feedback}` : ''}</div>}
                      <div className="mt-2 flex justify-end">
                        <Button size="small" icon={<HistoryOutlined />} onClick={() => setHistoryInterviewId(i.interviewId)}>
                          Lịch sử
                        </Button>
                      </div>
                    </div>
                  );
                })}
                {d.offers.map((o) => {
                  const s = pick(OFFER_STATUS, o.status);
                  return (
                    <div key={o.offerId} className="rounded-xl bg-slate-50 px-4 py-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-medium text-slate-900">Offer v{o.offerVersion} · {money(o.salary, o.currencyCode)}</span>
                        <StatusDot tone={s.tone}>{s.label}</StatusDot>
                      </div>
                      <div className="mt-1 text-[13px] text-slate-600">
                        Bắt đầu {fmt(o.startDate, 'DD/MM/YYYY')} · hạn phản hồi {fmt(o.expiryDate, 'DD/MM/YYYY')}
                      </div>
                      {(o.salaryBasis || o.salaryPeriod) && (
                        <div className="mt-1 text-[13px] text-slate-600">
                          {o.salaryBasis === 'GROSS' ? 'Gross' : o.salaryBasis === 'NET' ? 'Net' : '—'}
                          {' · '}
                          {o.salaryPeriod === 'ANNUAL' ? 'Theo năm' : o.salaryPeriod === 'MONTHLY' ? 'Theo tháng' : '—'}
                          {o.monthlyGrossSalary != null ? ` · Gross tháng quy đổi ${money(o.monthlyGrossSalary, o.currencyCode)}` : ''}
                        </div>
                      )}
                      {o.declineReason && <div className="text-[13px] text-red-800">Lý do từ chối: {o.declineReason}</div>}
                    </div>
                  );
                })}
                {d.plannedStartDate && <Row label="Ngày dự kiến nhận việc">{fmt(d.plannedStartDate, 'DD/MM/YYYY')}</Row>}
                {d.placement && (
                  <div className="rounded-xl bg-emerald-50 px-4 py-3 text-emerald-950">
                    Đã đi làm từ {fmt(d.placement.actualStartDate, 'DD/MM/YYYY')}
                    {d.placement.position ? ` · ${d.placement.position}` : ''}
                    {d.placement.department ? ` · ${d.placement.department}` : ''}
                    {d.placement.isReplacement ? ' · Người thay thế, không tính phí mới' : ''}
                  </div>
                )}
              </div>
            </Panel>
          )}

          <Panel
            title="Đánh giá của AI"
            extra={
              audience === 'hr' && (
                <Tooltip title="Gửi lại hồ sơ cho AI chấm điểm, ví dụ khi lần chấm trước lỗi hoặc job vừa sửa yêu cầu.">
                  <Button size="small" icon={<ExperimentOutlined />} loading={retry.isPending} onClick={() => retry.mutate()}>
                    Yêu cầu chấm lại
                  </Button>
                </Tooltip>
              )
            }
          >
            {(() => {
              if (!d.aiMatch) {
                return <p className="m-0 text-sm text-slate-600">Hồ sơ chưa được AI chấm điểm.</p>;
              }
              const aiStatus = (d.aiMatch.status || '').toUpperCase();
              if (aiStatus === 'PENDING' || aiStatus === 'PROCESSING') {
                return (
                  <div className="flex items-center gap-3 rounded-xl bg-sky-50 px-5 py-4 text-sky-950">
                    <LoadingOutlined className="text-lg text-sky-600" />
                    <div>
                      <div className="font-semibold text-sky-900">AI đang chấm điểm…</div>
                      <div className="mt-0.5 text-xs text-sky-700">
                        Hệ thống đang xử lý và đánh giá độ phù hợp của CV với yêu cầu công việc.
                      </div>
                    </div>
                  </div>
                );
              }
              if (aiStatus === 'FAILED') {
                return (
                  <div className="rounded-xl border border-solid border-amber-200 bg-amber-50/70 p-4 text-amber-950">
                    <div className="flex items-start gap-3">
                      <WarningOutlined className="mt-0.5 text-base text-amber-600" />
                      <div className="flex-1 text-sm">
                        <div className="font-semibold text-amber-900">
                          AI chưa chấm được hồ sơ này, vui lòng xem CV trực tiếp
                        </div>
                        <div className="mt-1 text-xs text-amber-700">
                          Quá trình chấm điểm tự động không thành công hoặc không trích xuất được thông tin CV.
                        </div>
                        {audience === 'hr' && (
                          <div className="mt-3">
                            <Button
                              type="primary"
                              size="small"
                              icon={<ExperimentOutlined />}
                              loading={retry.isPending}
                              onClick={() => retry.mutate()}
                              className="!bg-amber-600 hover:!bg-amber-500 !border-amber-600"
                            >
                              Yêu cầu chấm lại
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              }
              return (
                <div className="flex flex-col gap-4 sm:flex-row">
                  <div className="flex shrink-0 flex-col items-center justify-center rounded-xl bg-slate-50 px-6 py-4">
                    <span className="text-[34px] font-bold leading-none tabular-nums text-slate-900">
                      {d.aiMatch.matchScore != null ? Math.round(d.aiMatch.matchScore) : '—'}
                    </span>
                    <span className="mt-1 text-xs text-slate-600">điểm phù hợp / 100</span>
                    {d.aiMatch.matchTier && (
                      <span className="mt-1.5 inline-flex items-center rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700">
                        Tier {d.aiMatch.matchTier}
                      </span>
                    )}
                    {d.aiMatch.requiresManualReview && (
                      <span className="mt-2 text-xs font-semibold text-amber-800">Cần xem tay</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1 space-y-3 text-sm">
                    {highlights.length > 0 && (
                      <div>
                        <div className="mb-1 font-medium text-slate-900">Điểm khớp</div>
                        <ul className="m-0 space-y-1 pl-5 text-slate-700">
                          {highlights.slice(0, 6).map((h) => (
                            <li key={h}>{h}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {d.aiMatch.missingRequirements.length > 0 && (
                      <div>
                        <div className="mb-1 font-medium text-slate-900">Còn thiếu</div>
                        <ul className="m-0 space-y-1 pl-5 text-slate-700">
                          {d.aiMatch.missingRequirements.map((h) => (
                            <li key={h}>{h}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {d.aiMatch.warnings.length > 0 && (
                      <div className="rounded-lg bg-amber-50 px-3 py-2 text-[13px] text-amber-900">
                        {d.aiMatch.warnings.join(' · ')}
                      </div>
                    )}
                    {highlights.length === 0 && d.aiMatch.missingRequirements.length === 0 && (
                      <p className="m-0 text-slate-600">AI chưa trả về giải thích chi tiết.</p>
                    )}
                  </div>
                </div>
              );
            })()}
          </Panel>

          <Panel title="Thông tin ứng viên">
            <Row label="Email">{d.candidateEmail ?? '—'}</Row>
            <Row label="Điện thoại">{d.candidatePhone ?? '—'}</Row>
            <Row label="Địa chỉ">{d.currentAddress ?? '—'}</Row>
            <Row label="Kinh nghiệm">{d.yearsOfExperience != null ? `${d.yearsOfExperience} năm` : '—'}</Row>
            <Row label="Học vấn">{d.highestEducation ?? '—'}</Row>
            <Row label="CV">
              {!d.cv ? (
                '—'
              ) : audience === 'client' && d.isContactMasked ? (
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    size="small"
                    icon={<FileOutlined />}
                    loading={viewMaskedCv.isPending}
                    onClick={openMaskedCv}
                    aria-label="Xem CV đã che thông tin liên hệ"
                  >
                    Xem CV (đã che liên hệ)
                  </Button>
                  <span className="inline-flex items-center gap-1.5 text-xs font-normal text-slate-600">
                    <LockOutlined aria-hidden /> CV gốc hiển thị sau khi ứng viên đi làm
                  </span>
                </div>
              ) : (
                <Button
                  size="small"
                  icon={<FileOutlined />}
                  loading={viewCv.isPending}
                  onClick={openCv}
                  aria-label={`Xem CV ${d.cv.fileName ?? ''}`}
                >
                  Xem CV
                </Button>
              )}
            </Row>
            <Row label="Nộp lúc">{fmt(d.appliedAt)}</Row>
          </Panel>

          <Panel title="Lịch sử hồ sơ">
            {timeline.isLoading ? (
              <Skeleton active paragraph={{ rows: 3 }} />
            ) : (timeline.data ?? []).length === 0 ? (
              <p className="m-0 text-sm text-slate-600">Chưa có sự kiện.</p>
            ) : (
              <ol className="m-0 list-none space-y-0 p-0">
                {timeline.data!.map((e, i) => (
                  <li key={`${e.eventType}-${e.timestamp}-${i}`} className="relative flex gap-3 pb-4 last:pb-0">
                    <span className="relative flex w-3 justify-center" aria-hidden>
                      <span className="mt-1.5 h-2.5 w-2.5 rounded-full bg-[color:var(--console-accent)]" />
                      {i < timeline.data!.length - 1 && <span className="absolute top-4 h-full w-px bg-slate-200" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-slate-900">{e.title}</div>
                      {e.description && <div className="text-[13px] text-slate-600">{e.description}</div>}
                      {e.reasonCode && <div className="text-[13px] text-red-800">Lý do: {reasonLabel(e.reasonCode)}</div>}
                      <div className="mt-0.5 text-xs text-slate-500">
                        {fmt(e.timestamp)}
                        {e.actorName ? ` · ${e.actorName}` : ''}
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </Panel>
        </div>
      )}

      <Modal
        open={open !== null}
        title={open ? (open === 'offer' && has('UPDATE_OFFER') ? 'Sửa offer' : MODAL_TITLE[open]) : ''}
        okText={open === 'startWork' ? 'Xác nhận' : open === 'schedule' ? 'Lên lịch' : open === 'offer' ? 'Lưu offer' : 'Xác nhận'}
        okButtonProps={{ danger: open ? DANGER_MODALS.includes(open) : false, loading: run.isPending || Boolean(pendingAction) }}
        cancelButtonProps={{ disabled: busy }}
        closable={!busy}
        maskClosable={!busy}
        onCancel={() => !busy && setOpen(null)}
        onOk={() => form.submit()}
        destroyOnClose
      >
        <Form form={form} layout="vertical" requiredMark={false} onFinish={submitModal}>
          {open === 'reject' && (
            <>
              <p className="mt-0 text-sm text-slate-600">Chọn lý do để các bên liên quan hiểu vì sao hồ sơ không được chọn.</p>
              <Form.Item name="reasonCode" label="Lý do" rules={[{ required: true, message: 'Chọn một lý do.' }]}>
                <Select options={REJECTION_REASONS} placeholder="Chọn lý do loại" />
              </Form.Item>
              <Form.Item noStyle shouldUpdate={(a, b) => a.reasonCode !== b.reasonCode}>
                {({ getFieldValue }) => (
                  <Form.Item
                    name="reason"
                    label={getFieldValue('reasonCode') === 'OTHER' ? 'Ghi chú (bắt buộc)' : 'Ghi chú (không bắt buộc)'}
                    rules={[{ required: getFieldValue('reasonCode') === 'OTHER', whitespace: true, message: 'Lý do khác cần ghi chú.' }, { max: 2000, message: 'Tối đa 2000 ký tự.' }]}
                  >
                    <Input.TextArea rows={3} showCount maxLength={2000} />
                  </Form.Item>
                )}
              </Form.Item>
            </>
          )}

          {open === 'clientRejectSourcing' && (
            <>
              <p className="mt-0 text-sm text-slate-600">
                Chọn lý do từ chối hồ sơ ứng viên theo quy định dịch vụ CV Sourcing.
              </p>
              <Form.Item
                name="reasonCode"
                label="Lý do từ chối"
                rules={[{ required: true, message: 'Vui lòng chọn một lý do từ chối.' }]}
              >
                <Select
                  options={SOURCING_REJECT_REASONS.map((r) => ({ value: r.value, label: r.label }))}
                  placeholder="Chọn lý do từ chối"
                />
              </Form.Item>
              <Form.Item noStyle shouldUpdate={(a, b) => a.reasonCode !== b.reasonCode}>
                {({ getFieldValue }) => (
                  <Form.Item
                    name="note"
                    label={getFieldValue('reasonCode') === 'OTHER' ? 'Ghi chú (bắt buộc)' : 'Ghi chú (không bắt buộc)'}
                    rules={[
                      {
                        required: getFieldValue('reasonCode') === 'OTHER',
                        whitespace: true,
                        message: 'Lý do khác cần ghi chú cụ thể để HR Connect xác minh.',
                      },
                      { max: 2000, message: 'Tối đa 2000 ký tự.' },
                    ]}
                  >
                    <Input.TextArea rows={3} showCount maxLength={2000} placeholder="Nhập ghi chú chi tiết..." />
                  </Form.Item>
                )}
              </Form.Item>
            </>
          )}

          {(open === 'schedule' || open === 'reschedule') && (
            <>
              <Form.Item
                name={open === 'schedule' ? 'scheduledAt' : 'newScheduledAt'}
                label="Thời gian"
                rules={[
                  { required: true, message: 'Chọn thời gian phỏng vấn.' },
                  { validator: (_, v: Dayjs | undefined) => (!v || v.isAfter(dayjs()) ? Promise.resolve() : Promise.reject(new Error('Thời gian phải ở tương lai.'))) },
                ]}
              >
                <DatePicker showTime={{ format: 'HH:mm', minuteStep: 5 }} format="HH:mm DD/MM/YYYY" disabledDate={notPast} className="w-full" />
              </Form.Item>
            </>
          )}

          {(open === 'schedule' || open === 'reschedule' || open === 'editInterview') && (
            <>
              <div className="grid gap-x-4 sm:grid-cols-2">
                <Form.Item name="durationMinutes" label="Thời lượng (phút)" rules={[{ type: 'number', min: 1, max: 480, message: 'Từ 1 đến 480 phút.' }]}>
                  <InputNumber min={1} max={480} className="w-full" />
                </Form.Item>
                {(open === 'schedule' || open === 'editInterview') && (
                  <Form.Item name="interviewType" label="Hình thức">
                    <Select options={INTERVIEW_TYPES} />
                  </Form.Item>
                )}
              </div>
              <Form.Item
                name="location"
                label="Địa điểm"
                rules={[
                  { max: 255, message: 'Tối đa 255 ký tự.' },
                  ...(effectiveInterviewType === 'OFFLINE'
                    ? [{ required: true, whitespace: true, message: 'Phỏng vấn trực tiếp cần có địa điểm.' }]
                    : []),
                ]}
              >
                <Input placeholder="Văn phòng, phòng họp…" />
              </Form.Item>
              <Form.Item
                name="meetingLink"
                label="Link họp online"
                rules={[
                  { type: 'url', message: 'Link không hợp lệ.' },
                  ...(effectiveInterviewType === 'ONLINE'
                    ? [{ required: true, whitespace: true, message: 'Phỏng vấn trực tuyến cần có link phòng họp.' }]
                    : []),
                ]}
              >
                <Input placeholder="https://meet.google.com/…" />
              </Form.Item>
              {open === 'reschedule' && (
                <Form.Item name="reason" label="Lý do dời lịch" rules={REQUIRED}>
                  <Input.TextArea rows={2} maxLength={1000} />
                </Form.Item>
              )}
            </>
          )}

          {(open === 'cancel' || open === 'noshow' || open === 'withdraw' || open === 'notStarted') && (
            <Form.Item
              name="reason"
              label={open === 'cancel' ? 'Lý do hủy lịch' : open === 'noshow' ? 'Ghi chú vắng mặt' : open === 'withdraw' ? 'Lý do thu hồi offer' : 'Lý do không nhận việc'}
              rules={REQUIRED}
            >
              <Input.TextArea rows={3} maxLength={1000} showCount />
            </Form.Item>
          )}

          {open === 'rejectBackup' && (
            <Form.Item name="reason" label="Ghi chú (không bắt buộc)">
              <Input.TextArea rows={3} maxLength={1000} showCount />
            </Form.Item>
          )}

          {open === 'result' && (
            <>
              <Form.Item name="result" label="Kết quả" rules={[{ required: true, message: 'Chọn kết quả.' }]}>
                <Radio.Group>
                  <Radio.Button value="PASS">Đạt</Radio.Button>
                  <Radio.Button value="FAIL">Không đạt</Radio.Button>
                  <Radio.Button value="BACKUP">Dự phòng</Radio.Button>
                </Radio.Group>
              </Form.Item>
              {watchedResult === 'PASS' && (
                <Form.Item name="nextAction" label="Bước tiếp theo" initialValue="MAKE_OFFER">
                  <Radio.Group>
                    <Radio value="MAKE_OFFER">Chuyển sang tạo offer</Radio>
                    <Radio value="">Phỏng vấn thêm vòng nữa</Radio>
                  </Radio.Group>
                </Form.Item>
              )}
              {watchedResult === 'FAIL' && (
                <p className="-mt-2 text-sm text-red-700">
                  Kết quả “Không đạt” sẽ kết thúc quy trình tuyển dụng của hồ sơ này.
                </p>
              )}
              <Form.Item name="feedback" label="Nhận xét (không bắt buộc)">
                <Input.TextArea rows={3} maxLength={2000} showCount />
              </Form.Item>
            </>
          )}

          {open === 'offer' && (
            <>
              <div className="grid gap-x-4 sm:grid-cols-[1fr_110px]">
                <Form.Item name="salary" label="Mức lương" rules={[{ required: true, message: 'Nhập mức lương.' }, { type: 'number', min: 0, message: 'Không được âm.' }]}>
                  <InputNumber min={0} className="w-full" formatter={(v) => `${v ?? ''}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.')} parser={(v) => Number(String(v).replace(/\./g, '')) as 0} />
                </Form.Item>
                <Form.Item name="currencyCode" label="Tiền tệ" rules={[{ max: 3, message: 'Tối đa 3 ký tự.' }]}>
                  <Input maxLength={3} />
                </Form.Item>
              </div>
              <div className="grid gap-x-4 sm:grid-cols-2">
                <Form.Item
                  name="salaryBasis"
                  label="Loại lương"
                  rules={[
                    { required: true, message: 'Chọn Gross hoặc Net.' },
                    {
                      validator: (_, value: 'GROSS' | 'NET' | undefined) =>
                        !isHeadhuntCod || value === 'GROSS'
                          ? Promise.resolve()
                          : Promise.reject(new Error('Tin Headhunt chỉ nhận offer lương Gross.')),
                    },
                  ]}
                >
                  <Radio.Group options={SALARY_BASIS_OPTIONS} optionType="button" buttonStyle="solid" />
                </Form.Item>
                <Form.Item name="salaryPeriod" label="Kỳ lương" rules={[{ required: true, message: 'Chọn kỳ lương.' }]}>
                  <Radio.Group options={SALARY_PERIOD_OPTIONS} optionType="button" buttonStyle="solid" />
                </Form.Item>
              </div>
              {isHeadhuntCod && (
                <Alert
                  className="mb-4"
                  type="info"
                  showIcon
                  message="Tin Headhunt tính phí theo lương Gross tháng"
                  description="Chọn Gross. Nếu offer ghi theo năm, hệ thống tự quy đổi về mức Gross theo tháng để tính phí."
                />
              )}
              {monthlyGrossPreview != null && (
                <div className="mb-4 rounded-lg bg-sky-50 px-3 py-2 text-[13px] text-sky-950">
                  Gross theo tháng dùng để tính phí: <b>{money(monthlyGrossPreview, watchedCurrencyCode || 'VND')}</b>
                </div>
              )}
              <div className="grid gap-x-4 sm:grid-cols-2">
                <Form.Item name="expiryDate" label="Hạn phản hồi" rules={[{ required: true, message: 'Chọn hạn phản hồi.' }]}>
                  <DatePicker format="DD/MM/YYYY" disabledDate={notPast} className="w-full" />
                </Form.Item>
                <Form.Item
                  name="startDate"
                  label="Ngày bắt đầu"
                  dependencies={['expiryDate']}
                  rules={[
                    { required: true, message: 'Chọn ngày bắt đầu.' },
                    ({ getFieldValue }) => ({
                      validator: (_, v: Dayjs | undefined) => {
                        const e = getFieldValue('expiryDate') as Dayjs | undefined;
                        return !v || !e || !v.isBefore(e, 'day') ? Promise.resolve() : Promise.reject(new Error('Không được trước hạn phản hồi.'));
                      },
                    }),
                  ]}
                >
                  <DatePicker format="DD/MM/YYYY" disabledDate={notPast} className="w-full" />
                </Form.Item>
              </div>
              <Form.Item
                name="offerDocumentUrl"
                label="Link tài liệu/PDF Offer (không bắt buộc)"
                extra={has('UPDATE_OFFER') ? 'Để trống rồi lưu để gỡ link tài liệu hiện có.' : undefined}
                rules={[
                  { type: 'url', message: 'Link tài liệu không hợp lệ.' },
                  { max: 2048, message: 'Link tối đa 2048 ký tự.' },
                ]}
              >
                <Input placeholder="https://..." />
              </Form.Item>
            </>
          )}

          {open === 'plannedStart' && (
            <>
              <Form.Item name="plannedStartDate" label="Ngày dự kiến" rules={[{ required: true, message: 'Chọn ngày.' }]}>
                <DatePicker format="DD/MM/YYYY" disabledDate={notPast} className="w-full" />
              </Form.Item>
              <Form.Item name="reason" label="Ghi chú (không bắt buộc)">
                <Input.TextArea rows={2} maxLength={1000} />
              </Form.Item>
            </>
          )}

          {open === 'startWork' && (
            <>
              {d?.isReplacement ? (
                <Alert
                  className="mb-4"
                  type="success"
                  showIcon
                  message="Người thay thế – không tính phí mới"
                  description="Nếu suất thay thế còn hiệu lực, xác nhận này sẽ dùng suất đó và khởi động lại thời hạn bảo hành."
                />
              ) : (
                <p className="mt-0 text-sm text-slate-600">Xác nhận ứng viên đã thực sự đi làm. Bước này tạo bản ghi nhận việc và là mốc tính phí dịch vụ.</p>
              )}
              <Form.Item name="actualStartDate" label="Ngày thực tế đi làm" rules={[{ required: true, message: 'Chọn ngày.' }]}>
                <DatePicker format="DD/MM/YYYY" disabledDate={(x) => x.isAfter(dayjs(), 'day')} className="w-full" />
              </Form.Item>
              <div className="grid gap-x-4 sm:grid-cols-2">
                <Form.Item name="position" label="Vị trí" rules={[{ max: 150, message: 'Tối đa 150 ký tự.' }]}>
                  <Input />
                </Form.Item>
                <Form.Item name="department" label="Phòng ban" rules={[{ max: 150, message: 'Tối đa 150 ký tự.' }]}>
                  <Input />
                </Form.Item>
              </div>
              <Form.Item name="note" label="Ghi chú (không bắt buộc)">
                <Input.TextArea rows={2} maxLength={1000} />
              </Form.Item>
            </>
          )}
        </Form>
      </Modal>

      <Drawer
        open={Boolean(historyInterviewId)}
        title="Lịch sử phỏng vấn"
        width="min(520px, 100vw)"
        onClose={() => setHistoryInterviewId(null)}
        destroyOnClose
      >
        {interviewHistory.isLoading ? (
          <Skeleton active paragraph={{ rows: 5 }} />
        ) : interviewHistory.isError ? (
          <Alert type="error" showIcon message={getApiErrorMessage(interviewHistory.error, 'Không tải được lịch sử phỏng vấn.')} />
        ) : (interviewHistory.data ?? []).length === 0 ? (
          <p className="m-0 text-sm text-slate-600">Chưa có lịch sử cập nhật.</p>
        ) : (
          <ol className="m-0 list-none space-y-4 p-0">
            {interviewHistory.data!.map((item) => (
              <li key={item.historyId} className="border-0 border-l-2 border-solid border-blue-300 pl-4 text-sm">
                <div className="font-medium text-slate-900">
                  {item.oldStatus ? `${item.oldStatus} → ${item.newStatus}` : item.newStatus}
                </div>
                {(item.oldScheduledAt || item.newScheduledAt) && (
                  <div className="mt-1 text-slate-600">
                    {item.oldScheduledAt && `Cũ: ${fmt(item.oldScheduledAt)}`}
                    {item.oldScheduledAt && item.newScheduledAt && ' · '}
                    {item.newScheduledAt && `Mới: ${fmt(item.newScheduledAt)}`}
                  </div>
                )}
                {item.reason && <div className="mt-1 text-slate-600">Lý do: {item.reason}</div>}
                <div className="mt-1 text-xs text-slate-500">
                  {fmt(item.changedAt)}{item.changedByName ? ` · ${item.changedByName}` : ''}
                </div>
              </li>
            ))}
          </ol>
        )}
      </Drawer>
    </Drawer>
  );
};

export default ApplicationWorkbench;
