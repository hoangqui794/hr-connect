/**
 * @file ClientInterviewDetailDrawer.tsx
 * @description Dedicated drawer for Client Company to view interview details,
 * edit interview information (PUT /api/v1/interviews/{id}), reschedule, record results,
 * and view complete change history (GET /api/v1/interviews/{id}/history).
 */

import React, { useState } from 'react';
import {
  Drawer,
  Tabs,
  Button,
  Tag,
  Skeleton,
  Alert,
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  DatePicker,
  App as AntApp,
} from 'antd';
import {
  CalendarOutlined,
  ClockCircleOutlined,
  EnvironmentOutlined,
  VideoCameraOutlined,
  CopyOutlined,
  EditOutlined,
  HistoryOutlined,
  CheckOutlined,
  CloseOutlined,
  LinkOutlined,
  UserOutlined,
} from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { candidateInterviewApi } from '@/services/api/candidateInterviewApi';
import { clientActionsApi, interviewHistoryApi } from '@/services/api/hrApi';
import { getApiErrorMessage } from '@/services/apiClient';
import { StatusDot } from '@/features/admin-console/ui';
import { INTERVIEW_STATUS, INTERVIEW_RESULT, pick } from '@/features/hr-console/hrLabels';
import type { CandidateInterviewDetailDto } from '@/types/api/candidateInterview';

export interface ClientInterviewDetailDrawerProps {
  interviewId?: string | null;
  onClose: () => void;
  onOpenApplication?: (applicationId: string) => void;
}

const fmt = (v?: string | null, format = 'HH:mm DD/MM/YYYY') => (v ? dayjs(v).format(format) : '—');

export const ClientInterviewDetailDrawer: React.FC<ClientInterviewDetailDrawerProps> = ({
  interviewId,
  onClose,
  onOpenApplication,
}) => {
  const { message, modal } = AntApp.useApp();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'info' | 'history'>('info');
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [rescheduleModalOpen, setRescheduleModalOpen] = useState(false);
  const [resultModalOpen, setResultModalOpen] = useState(false);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);

  const [editForm] = Form.useForm();
  const [rescheduleForm] = Form.useForm();
  const [resultForm] = Form.useForm();
  const [cancelForm] = Form.useForm();
  const selectedInterviewType = Form.useWatch('interviewType', editForm);

  // Fetch interview detail
  const {
    data: interview,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['client-interview-detail', interviewId],
    queryFn: () => candidateInterviewApi.getClientInterviewDetail(interviewId!),
    enabled: Boolean(interviewId),
  });

  // Fetch interview history
  const historyQuery = useQuery({
    queryKey: ['interview-history', interviewId],
    queryFn: () => interviewHistoryApi.get(interviewId!),
    enabled: Boolean(interviewId && activeTab === 'history'),
  });

  const invalidateAll = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['client-interview-detail', interviewId] }),
      queryClient.invalidateQueries({ queryKey: ['interview-history', interviewId] }),
      queryClient.invalidateQueries({ queryKey: ['hr-pipeline'] }),
      queryClient.invalidateQueries({ queryKey: ['hr-application'] }),
    ]);
  };

  // PUT /api/v1/interviews/{id} (Edit interview info)
  const updateMutation = useMutation({
    mutationFn: async (values: any) => {
      if (!interviewId || !interview) return;
      return clientActionsApi.updateInterview(interviewId, {
        durationMinutes: values.durationMinutes,
        interviewType: values.interviewType,
        location: values.location?.trim() || undefined,
        meetingLink: values.meetingLink?.trim() || undefined,
        concurrencyToken: interview.concurrencyToken || '',
      });
    },
    onSuccess: async (res: any) => {
      message.success(res?.message || 'Đã cập nhật thông tin phỏng vấn.');
      setEditModalOpen(false);
      editForm.resetFields();
      await invalidateAll();
    },
    onError: (err) => message.error(getApiErrorMessage(err, 'Không thể cập nhật thông tin phỏng vấn.')),
  });

  // POST /api/v1/interviews/{id}/reschedule
  const rescheduleMutation = useMutation({
    mutationFn: async (values: any) => {
      if (!interviewId || !interview) return;
      return clientActionsApi.rescheduleInterview(interviewId, {
        newScheduledAt: (values.newScheduledAt as Dayjs).toISOString(),
        reason: values.reason.trim(),
        durationMinutes: values.durationMinutes,
        location: values.location?.trim() || undefined,
        meetingLink: values.meetingLink?.trim() || undefined,
        concurrencyToken: interview.concurrencyToken || '',
      });
    },
    onSuccess: async (res: any) => {
      message.success(res?.message || 'Đã dời lịch phỏng vấn thành công.');
      setRescheduleModalOpen(false);
      rescheduleForm.resetFields();
      await invalidateAll();
    },
    onError: (err) => message.error(getApiErrorMessage(err, 'Không thể dời lịch phỏng vấn.')),
  });

  // POST /api/v1/interviews/{id}/result
  const resultMutation = useMutation({
    mutationFn: async (values: any) => {
      if (!interviewId || !interview) return;
      return clientActionsApi.recordResult(interviewId, {
        result: values.result,
        feedback: values.feedback?.trim() || undefined,
        isFinalRound: values.isFinalRound ?? false,
        nextAction: values.nextAction || undefined,
        concurrencyToken: interview.concurrencyToken || '',
      });
    },
    onSuccess: async (res: any) => {
      message.success(res?.message || 'Đã ghi nhận kết quả phỏng vấn.');
      setResultModalOpen(false);
      resultForm.resetFields();
      await invalidateAll();
    },
    onError: (err) => message.error(getApiErrorMessage(err, 'Không thể ghi nhận kết quả phỏng vấn.')),
  });

  // POST /api/v1/interviews/{id}/cancel
  const cancelMutation = useMutation({
    mutationFn: async (values: any) => {
      if (!interviewId || !interview) return;
      return clientActionsApi.cancelInterview(interviewId, {
        reason: values.reason.trim(),
        concurrencyToken: interview.concurrencyToken || '',
      });
    },
    onSuccess: async (res: any) => {
      message.success(res?.message || 'Đã hủy lịch phỏng vấn.');
      setCancelModalOpen(false);
      cancelForm.resetFields();
      await invalidateAll();
    },
    onError: (err) => message.error(getApiErrorMessage(err, 'Không thể hủy lịch phỏng vấn.')),
  });

  const handleOpenEdit = () => {
    if (!interview) return;
    editForm.setFieldsValue({
      durationMinutes: interview.durationMinutes ?? 60,
      interviewType: interview.interviewType ?? 'ONLINE',
      location: interview.location ?? undefined,
      meetingLink: interview.meetingLink ?? undefined,
    });
    setEditModalOpen(true);
  };

  const handleOpenReschedule = () => {
    if (!interview) return;
    rescheduleForm.setFieldsValue({
      durationMinutes: interview.durationMinutes ?? 60,
      location: interview.location ?? undefined,
      meetingLink: interview.meetingLink ?? undefined,
    });
    setRescheduleModalOpen(true);
  };

  const handleCopy = (text: string, label: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      message.success(`Đã sao chép ${label}.`);
    } else {
      message.info(`Nội dung: ${text}`);
    }
  };

  const st = interview ? pick(INTERVIEW_STATUS, interview.status) : null;
  const isScheduled = interview?.status === 'SCHEDULED';
  const busy =
    updateMutation.isPending ||
    rescheduleMutation.isPending ||
    resultMutation.isPending ||
    cancelMutation.isPending;

  return (
    <>
      <Drawer
        open={Boolean(interviewId)}
        onClose={onClose}
        width="min(680px, 100vw)"
        title="Chi tiết buổi phỏng vấn"
        destroyOnClose
        styles={{ body: { background: '#F8FAFC', padding: 20 } }}
        footer={
          interview && isScheduled ? (
            <div className="flex flex-wrap justify-end gap-2 py-1">
              <Button danger onClick={() => setCancelModalOpen(true)} disabled={busy}>
                Hủy lịch
              </Button>
              <Button onClick={handleOpenReschedule} disabled={busy}>
                Dời lịch
              </Button>
              <Button icon={<EditOutlined />} onClick={handleOpenEdit} disabled={busy}>
                Sửa thông tin
              </Button>
              <Button
                type="primary"
                icon={<CheckOutlined />}
                onClick={() => setResultModalOpen(true)}
                disabled={busy}
              >
                Ghi kết quả
              </Button>
            </div>
          ) : interview?.applicationId && onOpenApplication ? (
            <div className="flex justify-end gap-2 py-1">
              <Button type="primary" onClick={() => onOpenApplication(interview.applicationId)}>
                Xem hồ sơ ứng viên
              </Button>
            </div>
          ) : null
        }
      >
        {isLoading ? (
          <Skeleton active paragraph={{ rows: 8 }} />
        ) : isError || !interview ? (
          <Alert
            type="error"
            showIcon
            message={getApiErrorMessage(error, 'Không thể tải chi tiết lịch phỏng vấn.')}
          />
        ) : (
          <div className="space-y-4">
            {/* Header info card */}
            <div className="rounded-2xl border border-solid border-slate-200/80 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-blue-600">
                      Phỏng vấn vòng {interview.interviewRound}
                    </span>
                    {st && <StatusDot tone={st.tone}>{st.label}</StatusDot>}
                  </div>
                  <h2 className="m-0 mt-1 text-xl font-bold text-slate-900">
                    {interview.candidateFullName || interview.candidateName || 'Ứng viên'}
                  </h2>
                  <div className="mt-0.5 text-sm text-slate-600">
                    {interview.jobTitle} · {interview.companyName}
                  </div>
                </div>

                {interview.applicationId && onOpenApplication && (
                  <Button
                    size="small"
                    type="link"
                    className="!px-0"
                    onClick={() => onOpenApplication(interview.applicationId)}
                  >
                    Mở hồ sơ ứng tuyển →
                  </Button>
                )}
              </div>

              {(interview.candidateEmail || interview.candidatePhone) && (
                <div className="mt-4 flex flex-wrap gap-4 border-0 border-t border-solid border-slate-100 pt-3 text-xs text-slate-600">
                  {interview.candidateEmail && (
                    <span>
                      <b>Email:</b> {interview.candidateEmail}
                    </span>
                  )}
                  {interview.candidatePhone && (
                    <span>
                      <b>SĐT:</b> {interview.candidatePhone}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Tabs for Info and History */}
            <div className="rounded-2xl border border-solid border-slate-200/80 bg-white p-5 shadow-sm">
              <Tabs
                activeKey={activeTab}
                onChange={(key) => setActiveTab(key as 'info' | 'history')}
                items={[
                  {
                    key: 'info',
                    label: (
                      <span>
                        <CalendarOutlined /> Thông tin buổi hẹn
                      </span>
                    ),
                    children: (
                      <div className="space-y-4 pt-2">
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div className="rounded-xl bg-slate-50 p-4">
                            <span className="text-xs font-medium text-slate-500">Thời gian hẹn</span>
                            <div className="mt-1 text-base font-semibold text-slate-900">
                              {fmt(interview.scheduledAt)}
                            </div>
                            <div className="mt-1 text-xs text-slate-500">
                              Thời lượng: {interview.durationMinutes ?? 60} phút
                            </div>
                          </div>

                          <div className="rounded-xl bg-slate-50 p-4">
                            <span className="text-xs font-medium text-slate-500">Hình thức phỏng vấn</span>
                            <div className="mt-1 text-base font-semibold text-slate-900">
                              {interview.interviewType === 'ONLINE'
                                ? 'Trực tuyến (Online)'
                                : interview.interviewType === 'OFFLINE'
                                  ? 'Trực tiếp (Tại văn phòng)'
                                  : interview.interviewType === 'PHONE'
                                    ? 'Điện thoại'
                                    : interview.interviewType || 'Trực tuyến'}
                            </div>
                            <div className="mt-1 text-xs text-slate-500">
                              Trạng thái: {st?.label ?? interview.status}
                            </div>
                          </div>
                        </div>

                        <div
                          className={`rounded-xl border border-solid p-4 ${
                            interview.candidateAttendanceStatus === 'CONFIRMED'
                              ? 'border-emerald-200 bg-emerald-50'
                              : 'border-amber-200 bg-amber-50'
                          }`}
                        >
                          <div className="text-xs font-medium text-slate-600">Phản hồi tham gia của ứng viên</div>
                          <div className="mt-1 flex flex-wrap items-center gap-2">
                            <Tag color={interview.candidateAttendanceStatus === 'CONFIRMED' ? 'success' : 'warning'}>
                              {interview.candidateAttendanceStatus === 'CONFIRMED'
                                ? 'Đã xác nhận tham gia'
                                : 'Chưa xác nhận'}
                            </Tag>
                            {interview.candidateRespondedAt && (
                              <span className="text-xs text-slate-500">
                                Phản hồi lúc: {fmt(interview.candidateRespondedAt)}
                              </span>
                            )}
                          </div>
                          {interview.candidateAttendanceStatus !== 'CONFIRMED' && (
                            <div className="mt-1 text-xs text-slate-600">
                              Lịch vẫn có hiệu lực; chưa xác nhận không đồng nghĩa ứng viên từ chối.
                            </div>
                          )}
                        </div>

                        {/* Location / Meeting link details */}
                        {interview.meetingLink && (
                          <div className="rounded-xl border border-solid border-blue-100 bg-blue-50/60 p-4">
                            <div className="flex items-center justify-between">
                              <span className="flex items-center gap-1.5 text-xs font-semibold text-blue-900">
                                <VideoCameraOutlined /> Link phòng họp trực tuyến
                              </span>
                              <div className="flex gap-2">
                                <Button
                                  size="small"
                                  icon={<CopyOutlined />}
                                  onClick={() => handleCopy(interview.meetingLink!, 'link họp')}
                                >
                                  Sao chép
                                </Button>
                                <Button
                                  size="small"
                                  type="primary"
                                  href={interview.meetingLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  Vào phòng
                                </Button>
                              </div>
                            </div>
                            <div className="mt-2 truncate font-mono text-xs text-blue-800">
                              {interview.meetingLink}
                            </div>
                          </div>
                        )}

                        {interview.location && (
                          <div className="rounded-xl bg-slate-50 p-4 text-sm">
                            <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                              <EnvironmentOutlined /> Địa điểm phỏng vấn
                            </span>
                            <div className="mt-1 text-slate-900">{interview.location}</div>
                          </div>
                        )}

                        {/* Result & Evaluation */}
                        {interview.result && (
                          <div className="rounded-xl border border-solid border-slate-200 bg-slate-50 p-4">
                            <span className="text-xs font-semibold text-slate-600">Kết quả đánh giá</span>
                            <div className="mt-1 flex items-center gap-2">
                              <Tag color={interview.result === 'PASS' ? 'success' : interview.result === 'FAIL' ? 'error' : 'warning'}>
                                {INTERVIEW_RESULT[interview.result] ?? interview.result}
                              </Tag>
                              {interview.recordedByName && (
                                <span className="text-xs text-slate-500">
                                  Ghi nhận bởi: {interview.recordedByName}
                                </span>
                              )}
                            </div>
                            {interview.feedback && (
                              <div className="mt-2 text-sm text-slate-700">
                                <b>Nhận xét:</b> {interview.feedback}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Metadata */}
                        <div className="flex flex-wrap justify-between gap-3 text-xs text-slate-500 pt-2 border-0 border-t border-solid border-slate-100">
                          {interview.createdByName && <span>Tạo bởi: {interview.createdByName}</span>}
                          <span>Tạo lúc: {fmt(interview.createdAt)}</span>
                        </div>
                      </div>
                    ),
                  },
                  {
                    key: 'history',
                    label: (
                      <span>
                        <HistoryOutlined /> Lịch sử thay đổi
                      </span>
                    ),
                    children: (
                      <div className="pt-2">
                        {historyQuery.isLoading ? (
                          <Skeleton active paragraph={{ rows: 4 }} />
                        ) : historyQuery.isError ? (
                          <Alert
                            type="error"
                            showIcon
                            message={getApiErrorMessage(historyQuery.error, 'Không tải được lịch sử phỏng vấn.')}
                          />
                        ) : (historyQuery.data ?? []).length === 0 ? (
                          <div className="py-8 text-center text-sm text-slate-500">
                            Chưa có bản ghi thay đổi lịch sử nào cho buổi phỏng vấn này.
                          </div>
                        ) : (
                          <ol className="m-0 list-none space-y-4 p-0">
                            {historyQuery.data!.map((item) => (
                              <li
                                key={item.historyId}
                                className="border-0 border-l-2 border-solid border-blue-400 pl-4 text-sm"
                              >
                                <div className="font-semibold text-slate-900">
                                  {item.oldStatus
                                    ? `${item.oldStatus} → ${item.newStatus}`
                                    : item.newStatus}
                                </div>
                                {(item.oldScheduledAt || item.newScheduledAt) && (
                                  <div className="mt-1 text-xs text-slate-600">
                                    {item.oldScheduledAt && `Cũ: ${fmt(item.oldScheduledAt)}`}
                                    {item.oldScheduledAt && item.newScheduledAt && ' · '}
                                    {item.newScheduledAt && `Mới: ${fmt(item.newScheduledAt)}`}
                                  </div>
                                )}
                                {item.reason && (
                                  <div className="mt-1 text-xs text-slate-700">
                                    <b>Lý do:</b> {item.reason}
                                  </div>
                                )}
                                <div className="mt-1 text-[11px] text-slate-400">
                                  {fmt(item.changedAt)}
                                  {item.changedByName ? ` · Thực hiện bởi: ${item.changedByName}` : ''}
                                </div>
                              </li>
                            ))}
                          </ol>
                        )}
                      </div>
                    ),
                  },
                ]}
              />
            </div>
          </div>
        )}
      </Drawer>

      {/* Modal 1: Edit Interview Info (PUT /api/v1/interviews/{id}) */}
      <Modal
        open={editModalOpen}
        title="Chỉnh sửa thông tin phỏng vấn"
        okText="Lưu thay đổi"
        cancelText="Hủy"
        onCancel={() => setEditModalOpen(false)}
        onOk={() => editForm.submit()}
        confirmLoading={updateMutation.isPending}
        destroyOnClose
      >
        <p className="text-xs text-slate-500">
          Chỉnh sửa thời lượng, hình thức, địa điểm và link họp trực tuyến. Để đổi giờ hẹn, vui lòng dùng chức năng "Dời lịch".
        </p>
        <Form form={editForm} layout="vertical" onFinish={(v) => updateMutation.mutate(v)}>
          <div className="grid grid-cols-2 gap-3">
            <Form.Item name="durationMinutes" label="Thời lượng (phút)" rules={[{ required: true }]}>
              <InputNumber min={15} max={480} step={15} className="w-full" />
            </Form.Item>
            <Form.Item name="interviewType" label="Hình thức">
              <Select
                options={[
                  { value: 'ONLINE', label: 'Trực tuyến (Online)' },
                  { value: 'OFFLINE', label: 'Trực tiếp (Tại văn phòng)' },
                  { value: 'PHONE', label: 'Điện thoại' },
                ]}
              />
            </Form.Item>
          </div>
          <Form.Item
            name="meetingLink"
            label="Link phòng họp trực tuyến"
            rules={[
              { type: 'url', message: 'Vui lòng nhập URL hợp lệ.' },
              ...(selectedInterviewType === 'ONLINE'
                ? [{ required: true, whitespace: true, message: 'Phỏng vấn trực tuyến cần có link phòng họp.' }]
                : []),
            ]}
          >
            <Input placeholder="https://meet.google.com/... hoặc Zoom" />
          </Form.Item>
          <Form.Item
            name="location"
            label="Địa điểm (nếu trực tiếp)"
            rules={selectedInterviewType === 'OFFLINE'
              ? [{ required: true, whitespace: true, message: 'Phỏng vấn trực tiếp cần có địa điểm.' }]
              : []}
          >
            <Input placeholder="Phòng họp A, tầng 5, tòa nhà..." />
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal 2: Reschedule Interview (POST /api/v1/interviews/{id}/reschedule) */}
      <Modal
        open={rescheduleModalOpen}
        title="Dời lịch phỏng vấn"
        okText="Xác nhận dời lịch"
        cancelText="Hủy"
        onCancel={() => setRescheduleModalOpen(false)}
        onOk={() => rescheduleForm.submit()}
        confirmLoading={rescheduleMutation.isPending}
        destroyOnClose
      >
        <Form form={rescheduleForm} layout="vertical" onFinish={(v) => rescheduleMutation.mutate(v)}>
          <Form.Item
            name="newScheduledAt"
            label="Thời gian phỏng vấn mới"
            rules={[{ required: true, message: 'Vui lòng chọn thời gian mới.' }]}
          >
            <DatePicker showTime format="HH:mm DD/MM/YYYY" className="w-full" />
          </Form.Item>
          <Form.Item
            name="reason"
            label="Lý do dời lịch (bắt buộc)"
            rules={[{ required: true, whitespace: true, message: 'Nhập lý do dời lịch để thông báo tới ứng viên.' }]}
          >
            <Input.TextArea rows={3} placeholder="Người phỏng vấn bận đột xuất..." />
          </Form.Item>
          <div className="grid grid-cols-2 gap-3">
            <Form.Item name="durationMinutes" label="Thời lượng (phút)">
              <InputNumber min={15} max={480} step={15} className="w-full" />
            </Form.Item>
            <Form.Item
              name="meetingLink"
              label="Link phòng họp mới"
              rules={[
                { type: 'url', message: 'Vui lòng nhập URL hợp lệ.' },
                ...(interview?.interviewType === 'ONLINE'
                  ? [{ required: true, whitespace: true, message: 'Phỏng vấn trực tuyến cần có link phòng họp.' }]
                  : []),
              ]}
            >
              <Input placeholder="https://..." />
            </Form.Item>
          </div>
          <Form.Item
            name="location"
            label="Địa điểm mới (nếu có)"
            rules={interview?.interviewType === 'OFFLINE'
              ? [{ required: true, whitespace: true, message: 'Phỏng vấn trực tiếp cần có địa điểm.' }]
              : []}
          >
            <Input />
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal 3: Record Result (POST /api/v1/interviews/{id}/result) */}
      <Modal
        open={resultModalOpen}
        title="Ghi nhận kết quả phỏng vấn"
        okText="Lưu kết quả"
        cancelText="Hủy"
        onCancel={() => setResultModalOpen(false)}
        onOk={() => resultForm.submit()}
        confirmLoading={resultMutation.isPending}
        destroyOnClose
      >
        <Form form={resultForm} layout="vertical" onFinish={(v) => resultMutation.mutate(v)}>
          <Form.Item name="result" label="Kết quả đánh giá" rules={[{ required: true, message: 'Chọn kết quả.' }]}>
            <Select
              options={[
                { value: 'PASS', label: 'Đạt (PASS) - Sẵn sàng gửi Offer hoặc vào vòng tiếp theo' },
                { value: 'FAIL', label: 'Không đạt (FAIL)' },
                { value: 'BACKUP', label: 'Dự phòng (BACKUP)' },
              ]}
            />
          </Form.Item>
          <Form.Item name="feedback" label="Nhận xét / Đánh giá chi tiết">
            <Input.TextArea rows={3} placeholder="Ứng viên nắm vững kiến thức chuyên môn, giao tiếp tốt..." />
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal 4: Cancel Interview (POST /api/v1/interviews/{id}/cancel) */}
      <Modal
        open={cancelModalOpen}
        title="Hủy lịch phỏng vấn"
        okText="Xác nhận hủy"
        cancelText="Đóng"
        okButtonProps={{ danger: true }}
        onCancel={() => setCancelModalOpen(false)}
        onOk={() => cancelForm.submit()}
        confirmLoading={cancelMutation.isPending}
        destroyOnClose
      >
        <Form form={cancelForm} layout="vertical" onFinish={(v) => cancelMutation.mutate(v)}>
          <p className="text-sm text-red-600">
            Lịch phỏng vấn sẽ bị hủy. Vui lòng nhập lý do để lưu vào lịch sử và thông báo tới các bên liên quan.
          </p>
          <Form.Item
            name="reason"
            label="Lý do hủy lịch"
            rules={[{ required: true, whitespace: true, message: 'Vui lòng nhập lý do hủy lịch.' }]}
          >
            <Input.TextArea rows={3} placeholder="Doanh nghiệp thay đổi kế hoạch tuyển dụng..." />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

export default ClientInterviewDetailDrawer;
