/**
 * @file PlacementDetailView.tsx
 * @description Core component for viewing Placement Detail with complete state handling,
 * countdown/progress bars for probation and warranty, candidate & job metrics,
 * financial links, and resignation action workflows.
 */

import React, { useState } from 'react';
import {
  Card,
  Tag,
  Button,
  Alert,
  Skeleton,
  Empty,
  Progress,
  Modal,
  Form,
  Input,
  DatePicker,
  Radio,
  Typography,
  Space,
  Divider,
} from 'antd';
import {
  UserOutlined,
  BankOutlined,
  CalendarOutlined,
  DollarOutlined,
  FilePdfOutlined,
  SafetyCertificateOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  InfoCircleOutlined,
  AuditOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { usePlacementDetail } from '@/hooks/usePlacementDetail';
import type { PlacementDetailDto } from '@/types/api/placement';
import { money, date } from './financeLabels';

const { Title, Text, Paragraph } = Typography;

export interface PlacementDetailViewProps {
  placementId: string;
  initialData?: PlacementDetailDto;
  mode?: 'client' | 'hr' | 'affiliate';
  onBack?: () => void;
  showBackAction?: boolean;
}

export const PlacementDetailView: React.FC<PlacementDetailViewProps> = ({
  placementId,
  initialData,
  mode = 'client',
  onBack,
  showBackAction = false,
}) => {
  const {
    placement: fetchedPlacement,
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
    reportResignation,
    isReportingResignation,
    resolveResignation,
    isResolvingResignation,
  } = usePlacementDetail(placementId);

  const placement = fetchedPlacement || initialData;

  const [resignationModalOpen, setResignationModalOpen] = useState(false);
  const [resolveModalOpen, setResolveModalOpen] = useState(false);
  const [resignationForm] = Form.useForm();
  const [resolveForm] = Form.useForm();

  // Handle Client Report Resignation
  const handleReportResignationSubmit = async () => {
    try {
      const values = await resignationForm.validateFields();
      await reportResignation({
        lastWorkingDate: values.lastWorkingDate.format('YYYY-MM-DD'),
        reason: values.reason,
      });
      setResignationModalOpen(false);
      resignationForm.resetFields();
    } catch {
      // Form validation error
    }
  };

  // Handle Internal HR Resolve Resignation
  const handleResolveResignationSubmit = async () => {
    try {
      const values = await resolveForm.validateFields();
      await resolveResignation({
        confirmed: values.decision === 'confirm',
        note: values.note,
      });
      setResolveModalOpen(false);
      resolveForm.resetFields();
    } catch {
      // Form validation error
    }
  };

  // 1. Loading State
  if (isLoading && !placement) {
    return (
      <div className="p-4 space-y-4" data-testid="placement-detail-loading">
        <Skeleton active paragraph={{ rows: 2 }} />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card size="small" className="rounded-xl border border-slate-200">
            <Skeleton active paragraph={{ rows: 2 }} />
          </Card>
          <Card size="small" className="rounded-xl border border-slate-200">
            <Skeleton active paragraph={{ rows: 2 }} />
          </Card>
          <Card size="small" className="rounded-xl border border-slate-200">
            <Skeleton active paragraph={{ rows: 2 }} />
          </Card>
        </div>
        <Card size="small" className="rounded-xl border border-slate-200">
          <Skeleton active paragraph={{ rows: 4 }} />
        </Card>
      </div>
    );
  }

  // 2. Error State
  if (isError && !placement) {
    return (
      <div className="p-6" data-testid="placement-detail-error">
        <Alert
          type="error"
          showIcon
          icon={<ExclamationCircleOutlined />}
          message="Không thể tải chi tiết tiếp nhận việc"
          description={
            <div className="space-y-3 mt-1">
              <p className="m-0 text-slate-700">
                {error?.message || 'Đã có lỗi xảy ra khi truy vấn dữ liệu từ máy chủ. Vui lòng thử lại.'}
              </p>
              <Button
                type="primary"
                danger
                icon={<ReloadOutlined spin={isRefetching} />}
                onClick={() => refetch()}
              >
                Thử lại
              </Button>
            </div>
          }
        />
      </div>
    );
  }

  // 3. Empty State
  if (!placement) {
    return (
      <div className="p-12 text-center" data-testid="placement-detail-empty">
        <Empty
          description="Không tìm thấy thông tin tiếp nhận việc hoặc bạn không có quyền xem."
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        >
          {showBackAction && onBack && (
            <Button type="primary" onClick={onBack}>
              Quay lại
            </Button>
          )}
        </Empty>
      </div>
    );
  }

  // Status Badge Mapper
  const getStatusBadge = (status: string) => {
    const map: Record<string, { color: string; label: string; icon: React.ReactNode }> = {
      STARTED: { color: 'processing', label: 'Đã tiếp nhận việc', icon: <CheckCircleOutlined /> },
      ONBOARDED: { color: 'processing', label: 'Đã đi làm', icon: <CheckCircleOutlined /> },
      PROBATION: { color: 'cyan', label: 'Đang thử việc', icon: <ClockCircleOutlined /> },
      ACTIVE: { color: 'success', label: 'Đang làm việc', icon: <CheckCircleOutlined /> },
      PASSED: { color: 'green', label: 'Hoàn thành thử việc', icon: <CheckCircleOutlined /> },
      COMPLETED: { color: 'green', label: 'Hoàn tất bảo hành', icon: <CheckCircleOutlined /> },
      RESIGNED: { color: 'magenta', label: 'Đã nghỉ việc', icon: <CloseCircleOutlined /> },
      CLAIMED: { color: 'warning', label: 'Chờ xác minh báo nghỉ', icon: <ClockCircleOutlined /> },
      VOIDED: { color: 'volcano', label: 'Nghỉ trong bảo hành', icon: <ExclamationCircleOutlined /> },
    };
    const s = map[status.toUpperCase()] || { color: 'default', label: status, icon: null };
    return (
      <Tag color={s.color} className="px-2.5 py-1 text-sm font-semibold rounded-md inline-flex items-center gap-1.5">
        {s.icon}
        {s.label}
      </Tag>
    );
  };

  // Progress calculations
  const calculateProgress = (startDateStr?: string | null, endDateStr?: string | null) => {
    if (!startDateStr || !endDateStr) return { percent: 0, daysTotal: 0, daysPassed: 0, daysLeft: 0, isExpired: false };
    const start = dayjs(startDateStr);
    const end = dayjs(endDateStr);
    const now = dayjs();

    const daysTotal = Math.max(1, end.diff(start, 'day'));
    const daysPassed = Math.max(0, Math.min(daysTotal, now.diff(start, 'day')));
    const daysLeft = Math.max(0, end.diff(now, 'day'));
    const percent = Math.min(100, Math.round((daysPassed / daysTotal) * 100));
    const isExpired = now.isAfter(end);

    return { percent, daysTotal, daysPassed, daysLeft, isExpired };
  };

  const probationProgress = calculateProgress(placement.probation?.startDate, placement.probation?.endDate);
  const warrantyProgress = calculateProgress(placement.warranty?.startDate, placement.warranty?.endDate);

  const canClientReportResignation =
    mode === 'client' &&
    (placement.warranty?.status === 'ACTIVE' || (!placement.warranty && placement.status === 'STARTED'));

  const canHrResolveResignation =
    mode === 'hr' &&
    (placement.warranty?.status === 'CLAIMED' || placement.status === 'CLAIMED');

  return (
    <div className="space-y-6" data-testid="placement-detail-content">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-blue-50 via-indigo-50/40 to-white p-5 rounded-2xl border border-blue-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            {getStatusBadge(placement.status)}
            {placement.warranty && (
              <Tag color="blue" className="font-medium">
                Bảo hành: {placement.warranty.status}
              </Tag>
            )}
            {placement.position && (
              <Tag color="geekblue" className="font-medium">
                {placement.position}
              </Tag>
            )}
          </div>
          <Title level={4} className="!m-0 text-slate-900 font-extrabold">
            {placement.candidate.fullName}
          </Title>
          <div className="flex items-center gap-2 mt-1.5 text-sm text-slate-600">
            <span className="font-semibold text-slate-800">{placement.job.title}</span>
            <span>•</span>
            <span className="text-slate-600">{placement.job.companyName}</span>
          </div>
        </div>

        {/* Actions in Header */}
        <div className="flex items-center gap-2 flex-wrap">
          {showBackAction && onBack && (
            <Button onClick={onBack}>
              Quay lại
            </Button>
          )}
          <Button icon={<ReloadOutlined spin={isRefetching} />} onClick={() => refetch()}>
            Làm mới
          </Button>
          {placement.offer.offerDocumentUrl && (
            <Button
              type="primary"
              icon={<FilePdfOutlined />}
              href={placement.offer.offerDocumentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm transition-all active:scale-[0.98]"
            >
              Hợp đồng Offer
            </Button>
          )}
        </div>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Onboard Salary */}
        <Card size="small" className="rounded-xl border border-slate-200 shadow-sm">
          <div className="text-xs text-slate-500 font-medium flex items-center gap-1.5 mb-1">
            <DollarOutlined className="text-emerald-600" />
            <span>Mức lương chính thức</span>
          </div>
          <div className="text-lg font-black text-emerald-700">
            {placement.offer.salary != null ? money(placement.offer.salary) : 'Thương lượng'}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Theo thư mời nhận việc (Offer)</div>
        </Card>

        {/* Actual Start Date */}
        <Card size="small" className="rounded-xl border border-slate-200 shadow-sm">
          <div className="text-xs text-slate-500 font-medium flex items-center gap-1.5 mb-1">
            <CalendarOutlined className="text-blue-600" />
            <span>Ngày đi làm chính thức</span>
          </div>
          <div className="text-lg font-black text-slate-800">
            {placement.actualStartDate ? date(placement.actualStartDate) : '—'}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Xác nhận bởi Doanh nghiệp</div>
        </Card>

        {/* Probation Period */}
        <Card size="small" className="rounded-xl border border-slate-200 shadow-sm">
          <div className="text-xs text-slate-500 font-medium flex items-center gap-1.5 mb-1">
            <ClockCircleOutlined className="text-cyan-600" />
            <span>Thời gian thử việc</span>
          </div>
          <div className="text-base font-bold text-slate-800">
            {placement.probation
              ? `${date(placement.probation.startDate)} → ${date(placement.probation.endDate)}`
              : '60 ngày (Mặc định)'}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            Kết quả: <strong>{placement.probation?.result || 'Đang theo dõi'}</strong>
          </div>
        </Card>

        {/* Warranty Window */}
        <Card size="small" className="rounded-xl border border-slate-200 shadow-sm">
          <div className="text-xs text-slate-500 font-medium flex items-center gap-1.5 mb-1">
            <SafetyCertificateOutlined className="text-amber-600" />
            <span>Thời hạn bảo hành</span>
          </div>
          <div className="text-base font-bold text-slate-800">
            {placement.warranty?.endDate ? date(placement.warranty.endDate) : 'Đang cập nhật'}
          </div>
          <div className="text-[11px] text-amber-600 font-semibold mt-0.5">
            {warrantyProgress.daysLeft > 0 ? `Còn ${warrantyProgress.daysLeft} ngày bảo hành` : 'Đã hết bảo hành'}
          </div>
        </Card>
      </div>

      {/* Probation & Warranty Progress Bars */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Probation Progress Card */}
        <Card
          size="small"
          className="rounded-xl border border-slate-200 shadow-sm"
          title={
            <div className="flex items-center gap-2 text-slate-800 font-bold text-sm">
              <ClockCircleOutlined className="text-cyan-600" />
              <span>Tiến độ thử việc (Probation)</span>
            </div>
          }
        >
          <div className="py-2 space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-600">
              <span>Đã qua: <strong>{probationProgress.daysPassed} ngày</strong></span>
              <span>Tổng thời gian: <strong>{probationProgress.daysTotal} ngày</strong></span>
            </div>
            <Progress
              percent={probationProgress.percent}
              status={probationProgress.isExpired ? 'success' : 'active'}
              strokeColor="#0284c7"
            />
            <div className="text-xs text-slate-500 bg-slate-50 p-2.5 rounded-lg border border-slate-200/60">
              {placement.probation?.notes || 'Ứng viên đang trong giai đoạn thử việc và hòa nhập môi trường doanh nghiệp.'}
            </div>
          </div>
        </Card>

        {/* Warranty Progress Card */}
        <Card
          size="small"
          className="rounded-xl border border-slate-200 shadow-sm"
          title={
            <div className="flex items-center gap-2 text-slate-800 font-bold text-sm">
              <SafetyCertificateOutlined className="text-amber-600" />
              <span>Tiến độ bảo hành (Warranty Period)</span>
            </div>
          }
        >
          <div className="py-2 space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-600">
              <span>Đã qua: <strong>{warrantyProgress.daysPassed} ngày</strong></span>
              <span>Còn lại: <strong className="text-amber-700">{warrantyProgress.daysLeft} ngày</strong></span>
            </div>
            <Progress
              percent={warrantyProgress.percent}
              strokeColor={
                placement.warranty?.status === 'VOIDED'
                  ? '#ef4444'
                  : placement.warranty?.status === 'CLAIMED'
                  ? '#f59e0b'
                  : '#10b981'
              }
            />
            <div className="text-xs text-slate-500 bg-slate-50 p-2.5 rounded-lg border border-slate-200/60 flex items-center justify-between">
              <span>Trạng thái: <strong>{placement.warranty?.status || 'ACTIVE'}</strong></span>
              {placement.warranty?.resultNote && (
                <span className="text-slate-600 italic">Ghi chú: {placement.warranty.resultNote}</span>
              )}
            </div>
          </div>
        </Card>
      </div>

      {/* Candidate & Job Information Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Candidate Information Card */}
        <Card
          size="small"
          className="rounded-xl border border-slate-200 shadow-sm"
          title={
            <div className="flex items-center gap-2 text-slate-800 font-bold text-sm">
              <UserOutlined className="text-indigo-600" />
              <span>Thông tin ứng viên</span>
            </div>
          }
        >
          <div className="space-y-2 py-1 text-xs">
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">Họ và tên:</span>
              <strong className="text-slate-900">{placement.candidate.fullName}</strong>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">Email:</span>
              <span className="text-slate-800 font-mono">{placement.candidate.email || '—'}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">Số điện thoại:</span>
              <span className="text-slate-800">{placement.candidate.phone || '—'}</span>
            </div>
            {placement.candidate.summary && (
              <div className="pt-1">
                <span className="text-slate-500 block mb-1">Tóm tắt chuyên môn:</span>
                <Paragraph ellipsis={{ rows: 3, expandable: true }} className="text-slate-700 bg-slate-50 p-2 rounded">
                  {placement.candidate.summary}
                </Paragraph>
              </div>
            )}
          </div>
        </Card>

        {/* Job & Offer Details Card */}
        <Card
          size="small"
          className="rounded-xl border border-slate-200 shadow-sm"
          title={
            <div className="flex items-center gap-2 text-slate-800 font-bold text-sm">
              <BankOutlined className="text-blue-600" />
              <span>Thông tin Vị trí & Doanh nghiệp</span>
            </div>
          }
        >
          <div className="space-y-2 py-1 text-xs">
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">Tin tuyển dụng:</span>
              <strong className="text-slate-900">{placement.job.title}</strong>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">Doanh nghiệp:</span>
              <span className="text-slate-800">{placement.job.companyName}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">Vị trí đảm nhiệm:</span>
              <span className="text-slate-800">{placement.position || placement.job.title}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">Phòng ban:</span>
              <span className="text-slate-800">{placement.department || 'Đang cập nhật'}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-500">Người xác nhận đi làm:</span>
              <span className="text-slate-800">{placement.confirmedByName || 'Hệ thống'}</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Linked Financial Information (MF-05 Integration) */}
      {placement.financial && (
        <Card
          size="small"
          className="rounded-xl border border-slate-200 shadow-sm"
          title={
            <div className="flex items-center gap-2 text-slate-800 font-bold text-sm">
              <AuditOutlined className="text-emerald-600" />
              <span>Phí dịch vụ và hoa hồng</span>
            </div>
          }
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-1">
            {/* Service Fee */}
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200/80 space-y-1">
              <div className="text-xs text-slate-500 font-medium">Phí dịch vụ tuyển dụng (Doanh nghiệp)</div>
              <div className="text-base font-black text-slate-900">
                {placement.financial.serviceFeeAmount != null ? money(placement.financial.serviceFeeAmount) : '—'}
              </div>
              <div>
                <Tag color={placement.financial.serviceFeeStatus === 'PAID' ? 'green' : 'orange'}>
                  {placement.financial.serviceFeeStatus || 'Chưa thanh toán'}
                </Tag>
              </div>
            </div>

            {/* Commission */}
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200/80 space-y-1">
              <div className="text-xs text-slate-500 font-medium">Hoa hồng Cộng tác viên / Recruiter</div>
              <div className="text-base font-black text-emerald-700">
                {placement.financial.commissionAmount != null ? money(placement.financial.commissionAmount) : '—'}
              </div>
              <div>
                <Tag color={placement.financial.commissionStatus === 'APPROVED' ? 'green' : 'blue'}>
                  {placement.financial.commissionStatus || 'Chưa tính'}
                </Tag>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Actions Toolbar */}
      <Card size="small" className="rounded-xl border border-slate-200 bg-slate-50/50 shadow-sm">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-1">
          <div className="text-xs text-slate-600">
            {mode === 'client'
              ? 'Nếu ứng viên nghỉ việc trong thời gian bảo hành, vui lòng báo nghỉ việc để kích hoạt quyền lợi bảo hành hoặc suất tuyển thay thế.'
              : 'Xác minh và theo dõi tiến độ đi làm của ứng viên theo cam kết dịch vụ.'}
          </div>

          <Space wrap>
            {canClientReportResignation && (
              <Button
                danger
                type="primary"
                onClick={() => {
                  resignationForm.setFieldsValue({ lastWorkingDate: dayjs() });
                  setResignationModalOpen(true);
                }}
              >
                Báo nghỉ việc
              </Button>
            )}

            {canHrResolveResignation && (
              <Button
                type="primary"
                className="bg-amber-600 hover:bg-amber-700 font-semibold"
                onClick={() => {
                  resolveForm.setFieldsValue({ decision: 'confirm' });
                  setResolveModalOpen(true);
                }}
              >
                Xác minh báo nghỉ
              </Button>
            )}
          </Space>
        </div>
      </Card>

      {/* Modal: Client Report Resignation */}
      <Modal
        title="Báo ứng viên nghỉ việc trong thời gian bảo hành"
        open={resignationModalOpen}
        onCancel={() => setResignationModalOpen(false)}
        onOk={handleReportResignationSubmit}
        confirmLoading={isReportingResignation}
        okText="Gửi báo nghỉ việc"
        cancelText="Đóng"
        okButtonProps={{ danger: true }}
      >
        <div className="text-xs text-slate-600 mb-4 bg-amber-50 p-3 rounded-lg border border-amber-200">
          Ứng viên <strong>{placement.candidate.fullName}</strong> được bảo hành đến{' '}
          <strong>{date(placement.warranty?.endDate)}</strong>. Sau khi báo nghỉ, Internal HR sẽ xác minh để áp dụng chính sách tìm ứng viên thay thế miễn phí hoặc hoàn phí theo hợp đồng.
        </div>

        <Form form={resignationForm} layout="vertical">
          <Form.Item
            name="lastWorkingDate"
            label="Ngày làm việc cuối cùng"
            rules={[{ required: true, message: 'Vui lòng chọn ngày làm việc cuối cùng' }]}
          >
            <DatePicker className="w-full" format="YYYY-MM-DD" />
          </Form.Item>

          <Form.Item
            name="reason"
            label="Lý do nghỉ việc"
            rules={[{ required: true, message: 'Vui lòng nhập lý do nghỉ việc' }]}
          >
            <Input.TextArea rows={3} placeholder="Ví dụ: Ứng viên xin nghỉ vì lý do cá nhân..." />
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal: Internal HR Resolve Resignation */}
      <Modal
        title="Xác minh báo nghỉ việc của Doanh nghiệp"
        open={resolveModalOpen}
        onCancel={() => setResolveModalOpen(false)}
        onOk={handleResolveResignationSubmit}
        confirmLoading={isResolvingResignation}
        okText="Lưu kết quả xác minh"
        cancelText="Đóng"
      >
        <Form form={resolveForm} layout="vertical">
          <Form.Item
            name="decision"
            label="Kết quả xác minh"
            rules={[{ required: true, message: 'Chọn kết quả' }]}
          >
            <Radio.Group>
              <Radio value="confirm">Xác nhận ứng viên nghỉ đúng hạn (Hợp lệ)</Radio>
              <Radio value="reject">Bác bỏ báo nghỉ (Không hợp lệ)</Radio>
            </Radio.Group>
          </Form.Item>

          <Form.Item name="note" label="Ghi chú xác minh">
            <Input.TextArea rows={3} placeholder="Ghi chú đối soát hoặc căn cứ xác minh..." />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default PlacementDetailView;
