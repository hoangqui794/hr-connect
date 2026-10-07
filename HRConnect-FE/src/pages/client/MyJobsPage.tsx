/**
 * @file MyJobsPage.tsx
 * @description Client Company Jobs Console (GET /api/v1/jobs/mine).
 * Implements MF-01 for Client Company User (A-04).
 * Features:
 *   - Status tabs (ALL, DRAFT, PENDING_REVIEW, ACTIVE, PAUSED, CLOSED, REJECTED)
 *   - State-machine driven actions (Edit, Submit, Pause with Reason, Resume, Close)
 *   - Warning banner for Rejected jobs with rejection reason
 */

import React, { useState, useMemo } from 'react';
import {
  Table, Tag, Button, Tabs, Dropdown, Modal, Alert,
  Space, Typography, Input, Card, Popconfirm, message, Badge, Tooltip, Row, Col,
} from 'antd';
import {
  PlusOutlined, EditOutlined, SendOutlined,
  PauseCircleOutlined, PlayCircleOutlined, StopOutlined,
  MoreOutlined, ExclamationCircleOutlined, CheckCircleOutlined,
  ReloadOutlined, SafetyCertificateOutlined, TeamOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { MenuProps } from 'antd';
import { useNavigate } from 'react-router-dom';
import {
  useMyJobs,
  useSubmitJob,
  usePauseJob,
  useResumeJob,
  useCloseJob,
} from '@/services/queries/useJobs';
import type { JobDetailDto } from '@/types/mf01';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

export const MyJobsPage: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<string>('ALL');
  const [search, setSearch] = useState<string>('');

  // Reason Modal for Pause & Close
  const [reasonModal, setReasonModal] = useState<{
    isOpen: boolean;
    type: 'PAUSE' | 'CLOSE';
    jobId: string;
    jobTitle: string;
  }>({
    isOpen: false,
    type: 'PAUSE',
    jobId: '',
    jobTitle: '',
  });
  const [reasonText, setReasonText] = useState('');

  // React Query Hooks
  const { data: jobs = [], isLoading, refetch, isFetching } = useMyJobs(activeTab);
  const submitJobMutation = useSubmitJob();
  const pauseJobMutation = usePauseJob();
  const resumeJobMutation = useResumeJob();
  const closeJobMutation = useCloseJob();

  const isMutating =
    submitJobMutation.isPending ||
    pauseJobMutation.isPending ||
    resumeJobMutation.isPending ||
    closeJobMutation.isPending;

  // Filter jobs by search
  const filteredJobs = useMemo(() => {
    if (!search.trim()) return jobs;
    const term = search.toLowerCase();
    return jobs.filter((j) =>
      j.title.toLowerCase().includes(term) ||
      (j.requirements || []).some((r) => r.content.toLowerCase().includes(term))
    );
  }, [jobs, search]);

  // Rejected jobs for warning banner
  const rejectedJobs = useMemo(() => {
    return jobs.filter((j) => String(j.status).toUpperCase() === 'REJECTED');
  }, [jobs]);

  // Handlers
  const handleSubmitJob = async (jobId: string) => {
    try {
      await submitJobMutation.mutateAsync(jobId);
      message.success('Đã gửi tin tuyển dụng đến Internal HR để xét duyệt!');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gửi duyệt thất bại.';
      message.error(msg);
    }
  };

  const handleResumeJob = async (jobId: string) => {
    try {
      await resumeJobMutation.mutateAsync(jobId);
      message.success('Đã mở lại tin tuyển dụng thành công!');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Mở lại thất bại.';
      message.error(msg);
    }
  };

  const handleOpenPauseModal = (job: JobDetailDto) => {
    setReasonText('');
    setReasonModal({
      isOpen: true,
      type: 'PAUSE',
      jobId: job.id,
      jobTitle: job.title,
    });
  };

  const handleOpenCloseModal = (job: JobDetailDto) => {
    setReasonText('');
    setReasonModal({
      isOpen: true,
      type: 'CLOSE',
      jobId: job.id,
      jobTitle: job.title,
    });
  };

  const handleConfirmReasonModal = async () => {
    if (!reasonText.trim()) {
      message.warning('Vui lòng nhập lý do thực hiện thao tác.');
      return;
    }
    try {
      if (reasonModal.type === 'PAUSE') {
        await pauseJobMutation.mutateAsync({ jobId: reasonModal.jobId, reason: reasonText });
        message.success('Đã tạm dừng tin tuyển dụng.');
      } else {
        await closeJobMutation.mutateAsync({ jobId: reasonModal.jobId, reason: reasonText });
        message.info('Đã đóng tin tuyển dụng.');
      }
      setReasonModal({ isOpen: false, type: 'PAUSE', jobId: '', jobTitle: '' });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Thao tác thất bại.';
      message.error(msg);
    }
  };

  const columns: ColumnsType<JobDetailDto> = [
    {
      title: 'Vị trí tuyển dụng',
      key: 'title',
      width: 280,
      fixed: 'left',
      render: (_, record) => (
        <div>
          <div className="font-bold text-slate-900 text-sm">{record.title}</div>
          <div className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
            <span>{record.location || 'Hồ Chí Minh'}</span>
            {record.employmentType === 'REMOTE' && (
              <Tag color="cyan" className="m-0 text-[10px]">Remote</Tag>
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
      title: 'Khoảng lương',
      key: 'salary',
      width: 180,
      render: (_, record) => (
        <div className="font-semibold text-emerald-600 text-xs">
          {record.salaryMin && record.salaryMax
            ? `${record.salaryMin.toLocaleString('vi-VN')} - ${record.salaryMax.toLocaleString('vi-VN')} ${record.currencyCode || 'VND'}`
            : 'Thỏa thuận'}
        </div>
      ),
    },
    {
      title: 'Ứng viên',
      key: 'applications',
      width: 140,
      align: 'center',
      render: (_, record) => (
        <Button
          type="link"
          size="small"
          onClick={() => navigate('/client/candidates')}
          className="p-0 font-medium text-xs text-sky-600 hover:text-sky-700"
        >
          <Badge count={record.applicationCount || 0} overflowCount={999} style={{ backgroundColor: '#0284c7' }} />
          <span className="ml-2">({record.shortlistedCount || 0} đã duyệt)</span>
        </Button>
      ),
    },
    {
      title: 'Trạng thái',
      key: 'status',
      width: 150,
      render: (_, record) => {
        const statusStr = String(record.status).toUpperCase();
        if (statusStr === 'DRAFT') {
          return <Tag color="default" className="font-semibold rounded-md">Bản nháp</Tag>;
        }
        if (statusStr === 'PENDING' || statusStr === 'PENDING_REVIEW') {
          return (
            <Tag className="rounded-md font-bold text-xs bg-amber-50 text-amber-700 border-amber-300">
              ⏳ Chờ duyệt
            </Tag>
          );
        }
        if (statusStr === 'ACTIVE') {
          return <Tag color="success" className="font-bold rounded-md">Đang tuyển</Tag>;
        }
        if (statusStr === 'PAUSED') {
          return <Tag color="warning" className="font-bold rounded-md">Tạm dừng</Tag>;
        }
        if (statusStr === 'REJECTED') {
          return (
            <Tooltip title={`Lý do: ${record.rejectionReason || 'Chưa đạt tiêu chuẩn'}`}>
              <Tag color="error" className="font-bold rounded-md cursor-help">
                ❌ Bị từ chối
              </Tag>
            </Tooltip>
          );
        }
        return <Tag className="rounded-md text-slate-400">Đã đóng</Tag>;
      },
    },
    {
      title: 'Hành động',
      key: 'actions',
      width: 220,
      fixed: 'right',
      render: (_, record) => {
        const statusStr = String(record.status).toUpperCase();
        const isClosed = statusStr === 'CLOSED';
        const isDraftOrRejected = statusStr === 'DRAFT' || statusStr === 'REJECTED';

        const menuItems: MenuProps['items'] = [
          ...(isDraftOrRejected
            ? [
                {
                  key: 'edit',
                  label: 'Chỉnh sửa tin',
                  icon: <EditOutlined />,
                  onClick: () => navigate(`/client/jobs/create?edit=${record.id}`),
                },
                {
                  key: 'submit',
                  label: 'Gửi xét duyệt',
                  icon: <SendOutlined />,
                  onClick: () => handleSubmitJob(record.id),
                },
              ]
            : []),
          ...(statusStr === 'ACTIVE'
            ? [
                {
                  key: 'pause',
                  label: 'Tạm dừng nhận hồ sơ',
                  icon: <PauseCircleOutlined />,
                  onClick: () => handleOpenPauseModal(record),
                },
              ]
            : []),
          ...(statusStr === 'PAUSED'
            ? [
                {
                  key: 'resume',
                  label: 'Mở lại tin tuyển dụng',
                  icon: <PlayCircleOutlined />,
                  onClick: () => handleResumeJob(record.id),
                },
              ]
            : []),
          ...(!isClosed
            ? [
                {
                  type: 'divider' as const,
                },
                {
                  key: 'close',
                  label: 'Đóng tin tuyển dụng',
                  icon: <StopOutlined />,
                  danger: true,
                  onClick: () => handleOpenCloseModal(record),
                },
              ]
            : []),
        ];

        return (
          <Space size={6}>
            {isDraftOrRejected && (
              <Button
                size="small"
                icon={<EditOutlined />}
                onClick={() => navigate(`/client/jobs/create?edit=${record.id}`)}
                className="rounded-lg text-xs"
                disabled={isMutating}
              >
                Sửa
              </Button>
            )}

            {isDraftOrRejected && (
              <Popconfirm
                title="Gửi xét duyệt tin tuyển dụng?"
                description="Tin sẽ được chuyển vào hàng đợi duyệt của Internal HR."
                onConfirm={() => handleSubmitJob(record.id)}
                okText="Gửi duyệt"
                cancelText="Hủy"
                disabled={isMutating}
              >
                <Button
                  size="small"
                  type="primary"
                  icon={<SendOutlined />}
                  loading={submitJobMutation.isPending}
                  disabled={isMutating}
                  className="rounded-lg text-xs font-semibold bg-sky-600 hover:bg-sky-700"
                >
                  Gửi duyệt
                </Button>
              </Popconfirm>
            )}

            {statusStr === 'ACTIVE' && (
              <Button
                size="small"
                icon={<PauseCircleOutlined />}
                onClick={() => handleOpenPauseModal(record)}
                disabled={isMutating}
                className="rounded-lg text-xs text-amber-600 border-amber-300 hover:border-amber-400"
              >
                Tạm dừng
              </Button>
            )}

            {statusStr === 'PAUSED' && (
              <Button
                size="small"
                icon={<PlayCircleOutlined />}
                onClick={() => handleResumeJob(record.id)}
                disabled={isMutating}
                className="rounded-lg text-xs text-emerald-600 border-emerald-300 hover:border-emerald-400"
              >
                Mở lại
              </Button>
            )}

            {!isClosed && (
              <Dropdown menu={{ items: menuItems }} trigger={['click']} disabled={isMutating}>
                <Button size="small" icon={<MoreOutlined />} className="rounded-lg" />
              </Dropdown>
            )}
          </Space>
        );
      },
    },
  ];

  const tabItems = [
    { key: 'ALL', label: 'Tất cả tin' },
    { key: 'DRAFT', label: 'Bản nháp' },
    { key: 'PENDING_REVIEW', label: 'Chờ duyệt' },
    { key: 'ACTIVE', label: 'Đang tuyển' },
    { key: 'PAUSED', label: 'Tạm dừng' },
    { key: 'CLOSED', label: 'Đã đóng' },
    { key: 'REJECTED', label: 'Bị từ chối' },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* ── Page Header ── */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-2xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <Title level={3} style={{ margin: 0, fontWeight: 800, color: '#0f172a' }}>
            Quản Lý Tin Tuyển Dụng Doanh Nghiệp
          </Title>
          <Text className="text-slate-500 text-xs block mt-1">
            Theo dõi vòng đời tin tuyển dụng theo State Machine chuẩn Swagger: Tạo nháp, Gửi duyệt, Tạm dừng, Mở lại và Đóng tin.
          </Text>
        </div>

        <div className="flex items-center gap-3">
          <Button
            icon={<ReloadOutlined spin={isFetching} />}
            onClick={() => void refetch()}
            className="rounded-xl font-semibold"
          >
            Làm mới
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => navigate('/client/jobs/create')}
            className="rounded-xl font-bold bg-blue-600 hover:bg-blue-700 h-10 px-5 border-none shadow-sm"
          >
            Tạo tin tuyển dụng mới
          </Button>
        </div>
      </div>

      {/* ── Warning Banner for Rejected Jobs ── */}
      {rejectedJobs.length > 0 && (
        <Alert
          type="error"
          showIcon
          icon={<ExclamationCircleOutlined />}
          className="rounded-2xl border-red-300 bg-red-50/70"
          message={
            <span className="font-bold text-red-800">
              Cảnh báo: Có {rejectedJobs.length} tin tuyển dụng bị từ chối phê duyệt
            </span>
          }
          description={
            <div className="text-xs text-red-700 space-y-1 mt-1">
              {rejectedJobs.slice(0, 3).map((rj) => (
                <div key={rj.id}>
                  • <strong>{rj.title}</strong>: {rj.rejectionReason || 'Vui lòng bổ sung yêu cầu bắt buộc và kiểm định mức lương.'}
                </div>
              ))}
              <div className="pt-1 font-semibold">
                Nhấp nút <strong>"Sửa"</strong> để cập nhật thông tin và bấm <strong>"Gửi duyệt"</strong> lại.
              </div>
            </div>
          }
        />
      )}

      {/* ── Filter & Tabs Card ── */}
      <Card className="rounded-2xl border-slate-200 shadow-2xs" styles={{ body: { padding: '16px 20px' } }}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Tabs
            activeKey={activeTab}
            onChange={setActiveTab}
            items={tabItems}
            className="mb-0 font-semibold"
          />
          <Input.Search
            placeholder="Tìm theo chức danh hoặc từ khóa kỹ năng..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            allowClear
            className="w-72 rounded-xl"
          />
        </div>

        <Table
          columns={columns}
          dataSource={filteredJobs}
          rowKey="id"
          loading={isLoading}
          scroll={{ x: 1200 }}
          className="mt-4"
          pagination={{ pageSize: 10, showTotal: (total) => `Tổng số ${total} tin tuyển dụng` }}
        />
      </Card>

      {/* ── Reason Modal for Pause & Close ── */}
      <Modal
        title={
          reasonModal.type === 'PAUSE' ? (
            <span className="text-amber-600 font-bold flex items-center gap-2">
              <PauseCircleOutlined />
              Tạm dừng nhận hồ sơ tuyển dụng
            </span>
          ) : (
            <span className="text-red-600 font-bold flex items-center gap-2">
              <StopOutlined />
              Đóng vĩnh viễn tin tuyển dụng
            </span>
          )
        }
        open={reasonModal.isOpen}
        onOk={handleConfirmReasonModal}
        onCancel={() => setReasonModal({ isOpen: false, type: 'PAUSE', jobId: '', jobTitle: '' })}
        confirmLoading={pauseJobMutation.isPending || closeJobMutation.isPending}
        okText={reasonModal.type === 'PAUSE' ? 'Tạm dừng ngay' : 'Đóng tin ngay'}
        cancelText="Hủy"
        okButtonProps={{ danger: reasonModal.type === 'CLOSE' }}
      >
        <div className="space-y-3 mt-3">
          <p className="text-xs text-slate-600 m-0">
            Vui lòng nhập lý do {reasonModal.type === 'PAUSE' ? 'tạm dừng nhận hồ sơ' : 'đóng tin'} đối với vị trí{' '}
            <strong className="text-slate-900">{reasonModal.jobTitle}</strong>:
          </p>
          <Input.TextArea
            rows={3}
            value={reasonText}
            onChange={(e) => setReasonText(e.target.value)}
            placeholder={
              reasonModal.type === 'PAUSE'
                ? 'Ví dụ: Tạm dừng để lọc danh sách 15 hồ sơ đầu tiên...'
                : 'Ví dụ: Đã tuyển đủ chỉ tiêu 2 kỹ sư backend...'
            }
            maxLength={300}
            showCount
          />
        </div>
      </Modal>
    </div>
  );
};

export default MyJobsPage;
