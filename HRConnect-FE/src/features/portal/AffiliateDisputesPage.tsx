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
  Alert,
  App as AntApp,
} from 'antd';
import {
  PlusOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { disputeApi } from '@/services/api/disputeApi';
import { getApiErrorMessage } from '@/services/apiClient';
import { StatusDot, Surface } from '@/features/admin-console/ui';
import type { MyDisputeDto, CreateDisputeRequest } from '@/types/api/dispute';
import { AffiliatePageHeader } from './affiliate/AffiliateUi';

const fmt = (v?: string | null) => (v ? dayjs(v).format('HH:mm DD/MM/YYYY') : '—');

const STATUS_CONFIG: Record<string, { label: string; tone: 'warning' | 'success' | 'danger' }> = {
  OPEN: { label: 'Đang xử lý', tone: 'warning' },
  UPHELD: { label: 'Đã chấp thuận', tone: 'success' },
  REJECTED: { label: 'Đã từ chối', tone: 'danger' },
};

const TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  DUPLICATE_SUBMISSION: { label: 'Trùng ứng viên', color: 'orange' },
  ATTRIBUTION: { label: 'Sai quyền ghi nhận', color: 'blue' },
};

export const AffiliateDisputesPage: React.FC = () => {
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
      message.success('Đã gửi khiếu nại tới bộ phận vận hành HR Connect.');
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
      title: 'Kết quả xử lý',
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
    <div className="space-y-6">
      <AffiliatePageHeader
        title="Khiếu nại quyền ghi nhận"
        description="Yêu cầu HR Connect kiểm tra lại khi hồ sơ bị đánh dấu trùng hoặc quyền ghi nhận ứng viên chưa đúng."
        actions={<Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalOpen(true)}>Tạo khiếu nại</Button>}
      />

      <Alert
        type="info"
        showIcon
        message="Trường hợp nên tạo khiếu nại"
        description="Tạo khiếu nại khi hồ sơ của bạn bị chặn do nghi trùng, hoặc ứng viên đã xác nhận cho phép giới thiệu nhưng quyền ghi nhận đang thuộc người khác. Chuẩn bị thời gian liên hệ và bằng chứng xác nhận của ứng viên để việc kiểm tra nhanh hơn."
      />

      {isError ? <Alert type="error" showIcon message="Không tải được danh sách khiếu nại" description={getApiErrorMessage(error)} /> : null}

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
                { value: 'DUPLICATE_SUBMISSION', label: 'Hồ sơ bị chặn do nghi trùng' },
                { value: 'ATTRIBUTION', label: 'Quyền ghi nhận chưa đúng' },
              ]}
            />
          </Form.Item>

          <Form.Item
            name="submissionId"
            label="Mã lượt giới thiệu"
            rules={[{ required: true, whitespace: true, message: 'Nhập mã lượt giới thiệu cần kiểm tra.' }]}
            help="Bạn có thể sao chép mã này tại trang chi tiết lượt giới thiệu."
          >
            <Input placeholder="Ví dụ: e3b0c442-98fc-1c14-9afb-f4c59638e235" />
          </Form.Item>

          <Form.Item
            name="description"
            label="Lý do cần kiểm tra"
            rules={[{ required: true, whitespace: true, message: 'Vui lòng nêu rõ lý do khiếu nại.' }]}
          >
            <Input.TextArea
              rows={3}
              placeholder="Giải thích vì sao ứng viên này thuộc nguồn của bạn hoặc thời điểm bạn tiếp cận trước..."
            />
          </Form.Item>

          <Form.Item
            name="evidenceNote"
            label="Bằng chứng bạn đang có"
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
