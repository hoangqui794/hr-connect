/**
 * @file AffiliateDisputesPage.tsx
 * @description Page for Affiliate to view own disputes and create new dispute requests
 * (backing GET /api/v1/disputes/mine and POST /api/v1/disputes).
 */

import React, { useState } from 'react';
import {
  Table,
  Tag,
  Button,
  Modal,
  Form,
  Input,
  Select,
  Breadcrumb,
  Alert,
  App as AntApp,
} from 'antd';
import {
  SolutionOutlined,
  PlusOutlined,
  HomeOutlined,
  ArrowLeftOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { disputeApi } from '@/services/api/disputeApi';
import { getApiErrorMessage } from '@/services/apiClient';
import { StatusDot, Surface } from '@/features/admin-console/ui';
import type { MyDisputeDto, CreateDisputeRequest } from '@/types/api/dispute';

const fmt = (v?: string | null) => (v ? dayjs(v).format('HH:mm DD/MM/YYYY') : '—');

const STATUS_CONFIG: Record<string, { label: string; tone: 'warning' | 'success' | 'danger' }> = {
  OPEN: { label: 'Đang xử lý', tone: 'warning' },
  UPHELD: { label: 'Đã chấp thuận', tone: 'success' },
  REJECTED: { label: 'Đã từ chối', tone: 'danger' },
};

const TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  DUPLICATE_SUBMISSION: { label: 'Trùng ứng viên', color: 'orange' },
  ATTRIBUTION: { label: 'Tranh chấp nguồn', color: 'blue' },
};

export const AffiliateDisputesPage: React.FC = () => {
  const navigate = useNavigate();
  const { message } = AntApp.useApp();
  const queryClient = useQueryClient();
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [form] = Form.useForm();

  // Queries
  const { data: disputes = [], isLoading, isError, error } = useQuery({
    queryKey: ['affiliate-my-disputes'],
    queryFn: () => disputeApi.getMyDisputes(),
  });

  // Mutation
  const createMutation = useMutation({
    mutationFn: (values: CreateDisputeRequest) => disputeApi.createDispute(values),
    onSuccess: () => {
      message.success('Đã gửi yêu cầu khiếu nại tới Platform Admin.');
      setCreateModalOpen(false);
      form.resetFields();
      queryClient.invalidateQueries({ queryKey: ['affiliate-my-disputes'] });
    },
    onError: (err) => message.error(getApiErrorMessage(err, 'Không thể gửi khiếu nại.')),
  });

  const columns: ColumnsType<MyDisputeDto> = [
    {
      title: 'Ứng viên & Tin tuyển dụng',
      key: 'cand',
      render: (_, r) => (
        <div>
          <div className="font-semibold text-slate-900">{r.candidateName || 'Ứng viên'}</div>
          <div className="text-xs text-slate-500">{r.jobTitle || 'Tin tuyển dụng'}</div>
        </div>
      ),
    },
    {
      title: 'Loại khiếu nại',
      dataIndex: 'disputeType',
      width: 170,
      render: (v) => {
        const cfg = TYPE_CONFIG[v] || { label: v, color: 'default' };
        return <Tag color={cfg.color}>{cfg.label}</Tag>;
      },
    },
    {
      title: 'Nội dung khiếu nại',
      dataIndex: 'description',
      ellipsis: true,
      render: (v) => <span className="text-slate-700">{v}</span>,
    },
    {
      title: 'Thời gian gửi',
      dataIndex: 'createdAt',
      width: 150,
      render: (v) => <span className="text-xs tabular-nums text-slate-500">{fmt(v)}</span>,
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      width: 140,
      render: (v) => {
        const cfg = STATUS_CONFIG[v] || { label: v, tone: 'warning' };
        return <StatusDot tone={cfg.tone}>{cfg.label}</StatusDot>;
      },
    },
    {
      title: 'Phản hồi từ Admin',
      dataIndex: 'resolution',
      render: (v, r) =>
        v ? (
          <div className="text-xs">
            <div className="font-medium text-slate-800">{v}</div>
            {r.resolvedAt && <div className="text-slate-400 mt-0.5">{fmt(r.resolvedAt)}</div>}
          </div>
        ) : (
          <span className="text-xs text-slate-400 italic">Đang chờ xem xét</span>
        ),
    },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      {/* Header & Breadcrumb */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Breadcrumb
          items={[
            {
              title: (
                <span
                  className="cursor-pointer flex items-center gap-1 text-slate-500 hover:text-blue-600"
                  onClick={() => navigate('/affiliate/dashboard')}
                >
                  <HomeOutlined /> Trang chủ
                </span>
              ),
            },
            {
              title: (
                <span className="font-semibold text-slate-800 flex items-center gap-1">
                  <SolutionOutlined className="text-blue-600" /> Khiếu nại nguồn ứng viên
                </span>
              ),
            },
          ]}
        />
        <div className="flex gap-2">
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/affiliate/dashboard')}>
            Quay lại
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setCreateModalOpen(true)}
          >
            Tạo khiếu nại mới
          </Button>
        </div>
      </div>

      <Alert
        type="info"
        showIcon
        message="Khi nào bạn có thể khiếu nại"
        description="Khi lượt giới thiệu của bạn bị hệ thống chặn vì trùng ứng viên hoặc ứng viên của bạn bị ghi nhận nguồn cho người khác không đúng quy định, bạn có thể tạo khiếu nại trong thời hạn khiếu nại để Admin đối soát chứng từ và chuyển lại quyền ghi nhận nguồn."
      />

      {/* Disputes Table */}
      <Surface padded>
        <Table
          className="admin-soft-table"
          rowKey="disputeId"
          columns={columns}
          dataSource={disputes}
          loading={isLoading}
          pagination={false}
          locale={{ emptyText: <div className="py-12 text-slate-400">Bạn chưa có khiếu nại nào.</div> }}
        />
      </Surface>

      {/* Modal: Create Dispute */}
      <Modal
        open={createModalOpen}
        title="Tạo khiếu nại nguồn ứng viên"
        okText="Gửi khiếu nại"
        cancelText="Hủy"
        onCancel={() => setCreateModalOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={createMutation.isPending}
        destroyOnClose
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{ disputeType: 'DUPLICATE_SUBMISSION' }}
          onFinish={(v) => createMutation.mutate(v)}
        >
          <Form.Item
            name="disputeType"
            label="Loại khiếu nại"
            rules={[{ required: true }]}
          >
            <Select
              options={[
                { value: 'DUPLICATE_SUBMISSION', label: 'Hồ sơ bị chặn vì trùng' },
                { value: 'ATTRIBUTION', label: 'Tranh chấp quyền ghi nhận nguồn (ATTRIBUTION)' },
              ]}
            />
          </Form.Item>

          <Form.Item
            name="submissionId"
            label="Mã lượt giới thiệu (Submission ID)"
            rules={[{ required: true, whitespace: true, message: 'Nhập ID lượt nộp cần khiếu nại.' }]}
            help="Xem mã lượt nộp tại danh sách Lượt giới thiệu của bạn."
          >
            <Input placeholder="Ví dụ: e3b0c442-98fc-1c14-9afb-f4c59638e235" />
          </Form.Item>

          <Form.Item
            name="description"
            label="Mô tả khiếu nại (bắt buộc)"
            rules={[{ required: true, whitespace: true, message: 'Vui lòng nêu rõ lý do khiếu nại.' }]}
          >
            <Input.TextArea
              rows={3}
              placeholder="Giải thích vì sao ứng viên này thuộc nguồn của bạn hoặc thời điểm bạn tiếp cận trước..."
            />
          </Form.Item>

          <Form.Item
            name="evidenceNote"
            label="Ghi chú bằng chứng (email, tin nhắn xác nhận từ ứng viên)"
          >
            <Input.TextArea
              rows={2}
              placeholder="Ứng viên xác nhận chỉ đồng ý cho tôi nộp hồ sơ qua email ngày..."
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default AffiliateDisputesPage;
