/**
 * @file JobReviewQueuePage.tsx
 * @description Internal HR Job Review Queue (/hr/jobs/review).
 * Conforms to MF-01 scenario A-03: Review, Approve, and Reject job postings.
 * Consumes GET /api/v1/internal/jobs/review, POST /approve, and POST /reject.
 */

import React, { useState } from 'react';
import {
  Table, Tag, Button, Modal, Drawer, Space, Typography,
  Input, Popconfirm, message, Empty, Tooltip, Row, Col, Card, Badge,
} from 'antd';
import {
  CheckCircleOutlined, StopOutlined, EyeOutlined,
  SafetyCertificateOutlined, ClockCircleOutlined,
  DollarOutlined, TeamOutlined, EnvironmentOutlined,
  CheckCircleFilled, ReloadOutlined, FileTextOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useJobsForReview, useApproveJob, useRejectJob } from '@/services/queries/useJobs';
import type { JobDetailDto } from '@/types/mf01';
import dayjs from 'dayjs';

const { Title, Text, Paragraph } = Typography;

export const JobReviewQueuePage: React.FC = () => {
  const { data: reviewJobs = [], isLoading, refetch, isFetching } = useJobsForReview();
  const approveJobMutation = useApproveJob();
  const rejectJobMutation = useRejectJob();

  // Detail Drawer state
  const [selectedJob, setSelectedJob] = useState<JobDetailDto | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Reject Modal state
  const [rejectModal, setRejectModal] = useState<{
    isOpen: boolean;
    jobId: string;
    jobTitle: string;
  }>({
    isOpen: false,
    jobId: '',
    jobTitle: '',
  });
  const [rejectReason, setRejectReason] = useState('');

  const isMutating = approveJobMutation.isPending || rejectJobMutation.isPending;

  const handleOpenDetail = (job: JobDetailDto) => {
    setSelectedJob(job);
    setIsDrawerOpen(true);
  };

  const handleApprove = async (jobId: string) => {
    try {
      await approveJobMutation.mutateAsync(jobId);
      message.success('✅ Đã phê duyệt và công bố tin tuyển dụng lên toàn hệ thống!');
      setIsDrawerOpen(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Phê duyệt thất bại.';
      message.error(msg);
    }
  };

  const handleOpenReject = (jobId: string, jobTitle: string) => {
    setRejectReason('');
    setRejectModal({
      isOpen: true,
      jobId,
      jobTitle,
    });
  };

  const handleConfirmReject = async () => {
    if (!rejectReason.trim()) {
      message.warning('Vui lòng nhập lý do từ chối để phản hồi cho doanh nghiệp.');
      return;
    }
    try {
      await rejectJobMutation.mutateAsync({
        jobId: rejectModal.jobId,
        reason: rejectReason.trim(),
      });
      message.error('Đã từ chối tin tuyển dụng và chuyển lý do cho doanh nghiệp.');
      setRejectModal({ isOpen: false, jobId: '', jobTitle: '' });
      setIsDrawerOpen(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Từ chối thất bại.';
      message.error(msg);
    }
  };

  const columns: ColumnsType<JobDetailDto> = [
    {
      title: 'Vị trí tuyển dụng & Doanh nghiệp',
      key: 'title',
      width: 320,
      fixed: 'left',
      render: (_, record) => (
        <div>
          <div className="font-bold text-slate-900 text-sm">{record.title}</div>
          <div className="text-xs text-blue-600 font-semibold mt-0.5">{record.companyName || 'Doanh nghiệp'}</div>
          <div className="text-xs text-slate-500 mt-1 flex items-center gap-2">
            <EnvironmentOutlined className="text-slate-400" />
            <span>{record.location || 'Hồ Chí Minh'}</span>
            {record.employmentType === 'REMOTE' && (
              <Tag color="cyan" className="m-0 text-[10px] leading-tight">Remote</Tag>
            )}
          </div>
        </div>
      ),
    },
    {
      title: 'Gói dịch vụ',
      key: 'serviceType',
      width: 200,
      render: (_, record) => {
        const typeStr = String(record.serviceTypeId || '').toUpperCase();
        if (typeStr.includes('COD') || typeStr.includes('HEADHUNT')) {
          return (
            <div>
              <Tag color="gold" className="font-bold rounded-md">Tuyển dụng trọn gói (COD)</Tag>
              <div className="text-[11px] text-sky-600 flex items-center gap-1 mt-1 font-medium">
                <SafetyCertificateOutlined /> Bảo hành 60 ngày
              </div>
            </div>
          );
        }
        if (typeStr.includes('SOURCING')) {
          return <Tag color="cyan" className="font-semibold rounded-md">CV Sourcing</Tag>;
        }
        return <Tag color="purple" className="font-semibold rounded-md">CV Application (Mở)</Tag>;
      },
    },
    {
      title: 'Mức lương dự kiến',
      key: 'salary',
      width: 190,
      render: (_, record) => (
        <div className="font-semibold text-emerald-600 text-xs">
          {record.salaryMin && record.salaryMax
            ? `${record.salaryMin.toLocaleString('vi-VN')} - ${record.salaryMax.toLocaleString('vi-VN')} ${record.currencyCode || 'VND'}`
            : 'Thỏa thuận'}
        </div>
      ),
    },
    {
      title: 'Tiêu chuẩn yêu cầu',
      key: 'requirements',
      width: 210,
      render: (_, record) => {
        const mustHave = (record.requirements || []).filter((r) => r.requirementType === 'MUST_HAVE');
        const shouldHave = (record.requirements || []).filter((r) => r.requirementType === 'SHOULD_HAVE');
        return (
          <Space direction="vertical" size={2}>
            <span className="text-xs text-red-600 font-semibold">
              • Must-have: {mustHave.length} tiêu chí
            </span>
            <span className="text-xs text-emerald-600 font-semibold">
              • Should-have: {shouldHave.length} tiêu chí
            </span>
          </Space>
        );
      },
    },
    {
      title: 'Thời gian gửi',
      key: 'createdAt',
      width: 150,
      render: (_, record) => (
        <div className="text-xs text-slate-500">
          <div>{dayjs(record.createdAt).format('DD/MM/YYYY')}</div>
          <div className="text-slate-400 text-[11px]">{dayjs(record.createdAt).format('HH:mm')}</div>
        </div>
      ),
    },
    {
      title: 'Thao tác xét duyệt',
      key: 'actions',
      width: 260,
      fixed: 'right',
      render: (_, record) => (
        <Space size={6}>
          {/* Xem chi tiết */}
          <Button
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleOpenDetail(record)}
            className="rounded-lg text-xs"
            disabled={isMutating}
          >
            Chi tiết
          </Button>

          {/* Duyệt & Công bố */}
          <Popconfirm
            title="Duyệt và công bố tin tuyển dụng này?"
            description="Tin tuyển dụng sẽ được chuyển sang ACTIVE và hiển thị ngay trên sàn."
            onConfirm={() => handleApprove(record.id)}
            okText="Duyệt ngay"
            cancelText="Hủy"
            disabled={isMutating}
          >
            <Button
              type="primary"
              size="small"
              icon={<CheckCircleOutlined />}
              loading={approveJobMutation.isPending}
              disabled={isMutating}
              className="rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white border-none"
            >
              Duyệt
            </Button>
          </Popconfirm>

          {/* Từ chối */}
          <Button
            size="small"
            danger
            icon={<StopOutlined />}
            onClick={() => handleOpenReject(record.id, record.title)}
            disabled={isMutating}
            className="rounded-lg text-xs font-medium"
          >
            Từ chối
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* ── Header ── */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-2xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex orientation-row orientation-row items-center gap-3">
            <Title level={3} style={{ margin: 0, fontWeight: 800, color: '#0f172a' }}>
              Hàng Đợi Xét Duyệt Tin Tuyển Dụng
            </Title>
            <Tag color="processing" className="font-bold text-xs rounded-full px-3 py-0.5">
              SLA 48H
            </Tag>
          </div>
          <Text className="text-slate-500 text-xs block mt-1">
            Kiểm tra thông tin chi tiết, đối chiếu tiêu chuẩn sàng lọc Must-have / Should-have và phê duyệt công bố việc làm lên sàn HRConnect.
          </Text>
        </div>

        <div className="flex items-center gap-3 orientation-row">
          <Badge count={reviewJobs.length} overflowCount={99}>
            <div className="px-3.5 py-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold flex orientation-row items-center gap-2">
              <ClockCircleOutlined />
              <span>Chờ xử lý</span>
            </div>
          </Badge>
          <Button
            icon={<ReloadOutlined spin={isFetching} />}
            onClick={() => void refetch()}
            className="rounded-xl font-semibold"
          >
            Làm mới
          </Button>
        </div>
      </div>

      {/* ── Table / Content ── */}
      <Card className="rounded-2xl border-slate-200 shadow-2xs" styles={{ body: { padding: 0 } }}>
        <Table
          columns={columns}
          dataSource={reviewJobs}
          rowKey="id"
          loading={isLoading}
          scroll={{ x: 1200 }}
          pagination={{ pageSize: 10, showTotal: (total) => `Tổng ${total} tin trong hàng đợi` }}
          locale={{
            emptyText: (
              <div className="py-12 text-center">
                <CheckCircleFilled className="text-emerald-500 text-5xl mb-3" />
                <h3 className="text-base font-bold text-slate-800 m-0">Hàng đợi trống — Đạt chỉ tiêu SLA!</h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
                  Hiện không có tin tuyển dụng nào đang chờ phê duyệt. Mọi yêu cầu từ doanh nghiệp đều đã được xử lý kịp thời.
                </p>
              </div>
            ),
          }}
        />
      </Card>

      {/* ── Detail Drawer ── */}
      <Drawer
        title={
          <div>
            <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Chi Tiết Kiểm Định Tin Tuyển Dụng</div>
            <div className="text-lg font-bold text-slate-900 mt-1">{selectedJob?.title}</div>
          </div>
        }
        width={720}
        open={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        extra={
          selectedJob && (
            <Space>
              <Button
                danger
                icon={<StopOutlined />}
                onClick={() => handleOpenReject(selectedJob.id, selectedJob.title)}
                disabled={isMutating}
                className="rounded-lg font-semibold"
              >
                Từ chối
              </Button>
              <Button
                type="primary"
                icon={<CheckCircleOutlined />}
                onClick={() => handleApprove(selectedJob.id)}
                loading={approveJobMutation.isPending}
                disabled={isMutating}
                className="rounded-lg font-bold bg-emerald-600 hover:bg-emerald-700 text-white border-none"
              >
                Duyệt &amp; Công bố
              </Button>
            </Space>
          )
        }
      >
        {selectedJob && (
          <div className="space-y-6">
            {/* Summary Cards */}
            <Row gutter={[12, 12]}>
              <Col span={12}>
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="text-xs text-slate-500 font-medium">Doanh nghiệp đăng tuyển</div>
                  <div className="text-sm font-bold text-slate-900 mt-0.5">{selectedJob.companyName || 'TechCorp'}</div>
                </div>
              </Col>
              <Col span={12}>
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="text-xs text-slate-500 font-medium">Mức lương dự kiến</div>
                  <div className="text-sm font-bold text-emerald-600 mt-0.5">
                    {selectedJob.salaryMin?.toLocaleString('vi-VN')} - {selectedJob.salaryMax?.toLocaleString('vi-VN')} {selectedJob.currencyCode || 'VND'}
                  </div>
                </div>
              </Col>
              <Col span={12}>
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="text-xs text-slate-500 font-medium">Số lượng cần tuyển</div>
                  <div className="text-sm font-bold text-slate-900 mt-0.5">{selectedJob.quantity || 1} nhân sự</div>
                </div>
              </Col>
              <Col span={12}>
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="text-xs text-slate-500 font-medium">Địa điểm làm việc</div>
                  <div className="text-sm font-bold text-slate-900 mt-0.5">{selectedJob.location || 'TP. Hồ Chí Minh'}</div>
                </div>
              </Col>
            </Row>

            {/* Must-have / Should-have Table Matrix */}
            <div>
              <h4 className="text-sm font-bold text-slate-900 mb-2">Tiêu Chuẩn Tuyển Chọn (Sentence-BERT ATS Matrix)</h4>
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-100 text-slate-600 border-b border-slate-200">
                    <tr>
                      <th className="p-2.5">Phân loại</th>
                      <th className="p-2.5">Nội dung kỹ năng / Tiêu chí</th>
                      <th className="p-2.5 text-center">Trọng số (Weight)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(selectedJob.requirements || []).length > 0 ? (
                      (selectedJob.requirements || []).map((req, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="p-2.5">
                            {req.requirementType === 'MUST_HAVE' ? (
                              <Tag color="red" className="font-bold rounded-md">Bắt buộc (Must-Have)</Tag>
                            ) : (
                              <Tag color="green" className="font-bold rounded-md">Ưu tiên (Should-Have)</Tag>
                            )}
                          </td>
                          <td className="p-2.5 font-medium text-slate-800">{req.content}</td>
                          <td className="p-2.5 text-center font-mono font-bold text-slate-600">
                            {req.weight ?? (req.requirementType === 'MUST_HAVE' ? 1.0 : 0.5)}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={3} className="p-4 text-center text-slate-400">
                          Chưa có tiêu chuẩn chi tiết
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Job Description */}
            <div>
              <h4 className="text-sm font-bold text-slate-900 mb-2">Mô Tả Công Việc (Job Description)</h4>
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">
                {selectedJob.description || 'Không có mô tả chi tiết.'}
              </div>
            </div>
          </div>
        )}
      </Drawer>

      {/* ── Reject Reason Modal ── */}
      <Modal
        title={
          <span className="text-red-600 font-bold flex items-center gap-2">
            <StopOutlined />
            Từ chối tin tuyển dụng &amp; Yêu cầu chỉnh sửa
          </span>
        }
        open={rejectModal.isOpen}
        onOk={handleConfirmReject}
        onCancel={() => setRejectModal({ isOpen: false, jobId: '', jobTitle: '' })}
        confirmLoading={rejectJobMutation.isPending}
        okText="Xác nhận từ chối"
        cancelText="Hủy"
        okButtonProps={{ danger: true }}
      >
        <div className="space-y-3 mt-3">
          <p className="text-xs text-slate-600 m-0">
            Vui lòng nhập lý do từ chối cụ thể đối với vị trí{' '}
            <strong className="text-slate-900">{rejectModal.jobTitle}</strong> để doanh nghiệp có cơ sở hoàn thiện lại tin tuyển dụng:
          </p>
          <Input.TextArea
            rows={4}
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Ví dụ: Thiếu tiêu chuẩn bắt buộc (Must-have tags), mức lương không tương xứng với JD, yêu cầu sửa đổi điều khoản thử việc..."
            maxLength={400}
            showCount
          />
        </div>
      </Modal>
    </div>
  );
};

export default JobReviewQueuePage;
