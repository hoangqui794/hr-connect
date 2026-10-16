/**
 * @file features/sourcing/SourcingDeliveriesView.tsx
 * @description View and management component for MF-03 CV Sourcing deliveries.
 * Shared between Client Company and Internal HR:
 *   - Client: reviews received CVs within 7-day review window; accepts or rejects with valid reason.
 *   - Internal HR: monitors delivered CVs, verifies rejections (upheld/overturn), replaces rejected CVs with backups.
 */

import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  App as AntApp,
  Badge,
  Button,
  Card,
  Descriptions,
  Empty,
  Form,
  Input,
  Modal,
  Progress,
  Radio,
  Select,
  Skeleton,
  Space,
  Table,
  Tag,
  Tooltip,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  ExclamationCircleOutlined,
  EyeOutlined,
  ReloadOutlined,
  SwapOutlined,
  UserOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { sourcingApi } from '@/services/api/sourcingApi';
import { getApiErrorMessage } from '@/services/apiClient';
import type {
  DecideSourcingDeliveryRequest,
  ReviewSourcingRejectionRequest,
  SourcingDeliveryDto,
  SourcingDeliveryStatus,
} from '@/types/api/sourcing';
import {
  SOURCING_REJECT_REASONS,
  SOURCING_STATUS_CONFIG,
  getRejectReasonLabel,
  getSourcingReviewDeadlineInfo,
} from './sourcingUtils';

export interface SourcingDeliveriesViewProps {
  jobId: string;
  jobTitle?: string;
  role: 'client' | 'hr';
  onViewCandidate?: (applicationId: string) => void;
}

type FilterTab = 'ALL' | SourcingDeliveryStatus;

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: 'ALL', label: 'Tất cả' },
  { key: 'DELIVERED', label: 'Chờ phản hồi' },
  { key: 'ACCEPTED', label: 'Đã chấp nhận' },
  { key: 'AUTO_ACCEPTED', label: 'Tự động chấp nhận' },
  { key: 'REJECTED', label: 'Đã từ chối' },
  { key: 'REPLACED', label: 'Đã thay thế' },
];

export const SourcingDeliveriesView: React.FC<SourcingDeliveriesViewProps> = ({
  jobId,
  jobTitle,
  role,
  onViewCandidate,
}) => {
  const { message, modal } = AntApp.useApp();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<FilterTab>('ALL');

  // Modals state
  const [acceptModalItem, setAcceptModalItem] = useState<SourcingDeliveryDto | null>(null);
  const [rejectModalItem, setRejectModalItem] = useState<SourcingDeliveryDto | null>(null);
  const [reviewRejectionItem, setReviewRejectionItem] = useState<SourcingDeliveryDto | null>(null);
  const [replaceModalItem, setReplaceModalItem] = useState<SourcingDeliveryDto | null>(null);

  const [rejectForm] = Form.useForm();
  const [reviewForm] = Form.useForm();
  const [replaceForm] = Form.useForm();

  // Query deliveries
  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ['sourcing-deliveries', jobId, activeTab],
    queryFn: () => sourcingApi.getDeliveries(jobId, activeTab === 'ALL' ? undefined : activeTab),
    enabled: Boolean(jobId),
  });

  const invalidateQueries = () => {
    queryClient.invalidateQueries({ queryKey: ['sourcing-deliveries', jobId] });
    queryClient.invalidateQueries({
      predicate: (q) => {
        const k = String(q.queryKey[0] ?? '');
        return k.startsWith('client-') || k.startsWith('hr-');
      },
    });
  };

  // Client decision mutation
  const decideMutation = useMutation({
    mutationFn: (variables: { deliveryId: string; body: DecideSourcingDeliveryRequest }) =>
      sourcingApi.decideDelivery(jobId, variables.deliveryId, variables.body),
    onSuccess: (res, vars) => {
      if (vars.body.decision === 'ACCEPTED') {
        message.success('Đã chấp nhận CV của ứng viên thành công.');
      } else {
        message.success('Đã ghi nhận từ chối CV với lý do hợp lệ.');
      }
      setAcceptModalItem(null);
      setRejectModalItem(null);
      rejectForm.resetFields();
      invalidateQueries();
    },
    onError: (err) => {
      message.error(getApiErrorMessage(err, 'Không thể thực hiện phản hồi cho CV này.'));
    },
  });

  // HR Review Rejection mutation
  const reviewMutation = useMutation({
    mutationFn: (variables: { deliveryId: string; body: ReviewSourcingRejectionRequest }) =>
      sourcingApi.reviewRejection(jobId, variables.deliveryId, variables.body),
    onSuccess: (res, vars) => {
      message.success(
        vars.body.upheld
          ? 'Đã xác nhận giữ nguyên từ chối của khách hàng.'
          : 'Đã bác bỏ từ chối. CV được chuyển sang Đã chấp nhận.'
      );
      setReviewRejectionItem(null);
      reviewForm.resetFields();
      invalidateQueries();
    },
    onError: (err) => {
      message.error(getApiErrorMessage(err, 'Không thể xử lý xác minh từ chối.'));
    },
  });

  // HR Replace Delivery mutation
  const replaceMutation = useMutation({
    mutationFn: (variables: { deliveryId: string; applicationId: string }) =>
      sourcingApi.replaceDelivery(jobId, variables.deliveryId, variables.applicationId),
    onSuccess: () => {
      message.success('Đã thay thế CV bị từ chối bằng CV dự phòng mới thành công.');
      setReplaceModalItem(null);
      replaceForm.resetFields();
      invalidateQueries();
    },
    onError: (err) => {
      message.error(getApiErrorMessage(err, 'Không thể thay thế CV dự phòng.'));
    },
  });

  // Handle Client Accept click
  const handleAcceptClick = (item: SourcingDeliveryDto) => {
    setAcceptModalItem(item);
  };

  // Handle Client Reject submit
  const handleRejectSubmit = (values: { reasonCode: string; note?: string }) => {
    if (!rejectModalItem) return;
    decideMutation.mutate({
      deliveryId: rejectModalItem.deliveryId,
      body: {
        decision: 'REJECTED',
        reasonCode: values.reasonCode,
        note: values.note?.trim() || undefined,
      },
    });
  };

  // Handle HR Review Rejection submit
  const handleReviewRejectionSubmit = (values: { upheld: boolean; note?: string }) => {
    if (!reviewRejectionItem) return;
    reviewMutation.mutate({
      deliveryId: reviewRejectionItem.deliveryId,
      body: {
        upheld: values.upheld,
        note: values.note?.trim() || undefined,
      },
    });
  };

  // Handle HR Replace submit
  const handleReplaceSubmit = (values: { applicationId: string }) => {
    if (!replaceModalItem) return;
    replaceMutation.mutate({
      deliveryId: replaceModalItem.deliveryId,
      applicationId: values.applicationId.trim(),
    });
  };

  const summary = data?.summary;
  const items = data?.items || [];

  const columns: ColumnsType<SourcingDeliveryDto> = [
    {
      title: 'Ứng viên',
      key: 'candidate',
      render: (_, r) => (
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-900">{r.candidateName || 'Ứng viên'}</span>
            {r.replacedByDeliveryId && (
              <Tag color="default" className="text-[11px] m-0">
                Đã đổi CV
              </Tag>
            )}
          </div>
          {onViewCandidate && (
            <Button
              type="link"
              size="small"
              icon={<EyeOutlined />}
              className="p-0 text-xs mt-0.5"
              onClick={() => onViewCandidate(r.applicationId)}
            >
              Xem chi tiết hồ sơ
            </Button>
          )}
        </div>
      ),
    },
    {
      title: 'Bàn giao lúc',
      dataIndex: 'deliveredAt',
      key: 'deliveredAt',
      width: 140,
      render: (v) => <span className="tabular-nums text-slate-700">{dayjs(v).format('HH:mm DD/MM/YYYY')}</span>,
    },
    {
      title: 'Trạng thái & Thời hạn phản hồi (7 ngày)',
      key: 'status',
      width: 290,
      render: (_, r) => {
        const cfg = SOURCING_STATUS_CONFIG[r.status] || SOURCING_STATUS_CONFIG.DELIVERED;
        const deadline = getSourcingReviewDeadlineInfo(r);

        return (
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <Tag color={cfg.tagColor} className="font-medium m-0">
                {cfg.label}
              </Tag>
              {r.status === 'DELIVERED' && (
                <Tag
                  color={deadline.isExpired ? 'error' : deadline.badgeTone === 'warning' ? 'warning' : 'processing'}
                  icon={<ClockCircleOutlined />}
                  className="font-medium m-0"
                >
                  {deadline.countdownText}
                </Tag>
              )}
            </div>

            {r.status === 'DELIVERED' && (
              <div className="text-xs text-slate-500">
                Hạn chót: <span className="font-medium text-slate-700">{deadline.formattedDueAt}</span>
              </div>
            )}

            {r.status === 'REJECTED' && (
              <div className="rounded bg-red-50 p-1.5 text-xs text-red-900 border border-solid border-red-100">
                <span className="font-semibold">Lý do:</span> {getRejectReasonLabel(r.rejectReasonCode)}
                {r.rejectNote && <div className="mt-0.5 text-slate-700 italic">"{r.rejectNote}"</div>}
              </div>
            )}

            {r.decidedAt && (
              <div className="text-[11px] text-slate-400">
                Phản hồi lúc: {dayjs(r.decidedAt).format('HH:mm DD/MM/YYYY')}
              </div>
            )}
          </div>
        );
      },
    },
    {
      title: 'Thao tác',
      key: 'actions',
      width: 200,
      align: 'right',
      render: (_, r) => {
        const deadline = getSourcingReviewDeadlineInfo(r);

        if (role === 'client') {
          if (r.status === 'DELIVERED') {
            if (deadline.isExpired) {
              return (
                <Tooltip title="Đã hết thời hạn xem xét 7 ngày. Theo quy tắc CV Sourcing, hồ sơ tự động được chấp nhận.">
                  <span className="text-xs font-medium text-amber-700 bg-amber-50 px-2 py-1 rounded">
                    Quá hạn xem xét
                  </span>
                </Tooltip>
              );
            }

            return (
              <Space direction="horizontal" size="small">
                <Button
                  type="primary"
                  size="small"
                  icon={<CheckCircleOutlined />}
                  loading={decideMutation.isPending}
                  onClick={() => handleAcceptClick(r)}
                >
                  Chấp nhận CV
                </Button>
                <Button
                  danger
                  size="small"
                  icon={<CloseCircleOutlined />}
                  loading={decideMutation.isPending}
                  onClick={() => {
                    rejectForm.resetFields();
                    setRejectModalItem(r);
                  }}
                >
                  Từ chối CV
                </Button>
              </Space>
            );
          }

          return <span className="text-xs text-slate-400">Đã hoàn tất</span>;
        }

        // Internal HR actions
        if (role === 'hr') {
          if (r.status === 'REJECTED') {
            return (
              <Space direction="horizontal" size="small">
                {r.rejectReasonCode === 'OTHER' && (
                  <Button
                    size="small"
                    onClick={() => {
                      reviewForm.resetFields();
                      setReviewRejectionItem(r);
                    }}
                  >
                    Xác minh
                  </Button>
                )}
                {!r.replacedByDeliveryId && (
                  <Button
                    type="primary"
                    size="small"
                    icon={<SwapOutlined />}
                    onClick={() => {
                      replaceForm.resetFields();
                      setReplaceModalItem(r);
                    }}
                  >
                    Thay CV dự phòng
                  </Button>
                )}
              </Space>
            );
          }

          return <span className="text-xs text-slate-400">—</span>;
        }

        return null;
      },
    },
  ];

  return (
    <div className="space-y-4">
      {/* Summary progress bar */}
      {summary && (
        <Card
          size="small"
          className="shadow-2xs rounded-xl border border-slate-200/90 bg-gradient-to-br from-white to-slate-50/50"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h3 className="m-0 text-base font-bold text-slate-900">Tiến độ bàn giao CV Sourcing</h3>
                {summary.sourcingTarget != null && (
                  <Tag color="blue" className="font-semibold m-0">
                    Mục tiêu: {summary.sourcingTarget} CV
                  </Tag>
                )}
              </div>
              <p className="m-0 text-xs text-slate-500">
                {role === 'client'
                  ? 'Quý doanh nghiệp có 7 ngày để chấp nhận hoặc từ chối mỗi CV kể từ ngày bàn giao.'
                  : 'Theo dõi tiến độ bàn giao và phản hồi từ Doanh nghiệp (MF-03).'}
              </p>
            </div>

            <div className="flex items-center gap-6 self-start sm:self-auto">
              <div>
                <div className="text-xs text-slate-500">Đã được tính</div>
                <div className="text-xl font-bold tabular-nums text-emerald-700">
                  {summary.counted}
                  {summary.sourcingTarget ? (
                    <span className="text-sm font-normal text-slate-400">/{summary.sourcingTarget}</span>
                  ) : (
                    ''
                  )}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Chờ phản hồi</div>
                <div className="text-xl font-bold tabular-nums text-amber-600">{summary.pendingReview}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Bị từ chối</div>
                <div className="text-xl font-bold tabular-nums text-red-600">{summary.rejected}</div>
              </div>
            </div>
          </div>

          {summary.sourcingTarget != null && summary.sourcingTarget > 0 && (
            <div className="mt-3">
              <Progress
                percent={Math.min(100, Math.round((summary.counted / summary.sourcingTarget) * 100))}
                status={summary.counted >= summary.sourcingTarget ? 'success' : 'active'}
                strokeColor={{ '0%': '#108ee9', '100%': '#52c41a' }}
              />
            </div>
          )}
        </Card>
      )}

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-0 border-b border-solid border-slate-200 pb-2">
        <div className="flex flex-wrap items-center gap-1">
          {FILTER_TABS.map((tab) => (
            <Button
              key={tab.key}
              size="small"
              type={activeTab === tab.key ? 'primary' : 'text'}
              className={activeTab === tab.key ? '!font-semibold shadow-2xs' : 'text-slate-600 hover:text-slate-900'}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
              {summary && tab.key === 'DELIVERED' && summary.pendingReview > 0 && (
                <span className="ml-1.5 rounded-full bg-amber-500 px-1.5 py-0.2 text-[10px] text-white font-bold">
                  {summary.pendingReview}
                </span>
              )}
            </Button>
          ))}
        </div>

        <Button
          size="small"
          icon={<ReloadOutlined spin={isFetching} />}
          onClick={() => refetch()}
          aria-label="Tải lại danh sách"
        >
          Tải lại
        </Button>
      </div>

      {/* 3 UI states: Loading, Error, Empty / Table */}
      {isLoading ? (
        <div className="p-4 bg-white rounded-xl border border-slate-200">
          <Skeleton active paragraph={{ rows: 6 }} />
        </div>
      ) : isError ? (
        <Alert
          type="error"
          showIcon
          message="Không thể tải danh sách CV bàn giao"
          description={getApiErrorMessage(error, 'Đã xảy ra lỗi khi kết nối tới máy chủ.')}
          action={
            <Button size="small" danger onClick={() => refetch()}>
              Thử lại
            </Button>
          }
        />
      ) : items.length === 0 ? (
        <div className="p-8 bg-white rounded-xl border border-slate-200 text-center">
          <Empty
            description={
              <div className="space-y-1">
                <span className="font-medium text-slate-700">
                  {activeTab === 'DELIVERED'
                    ? 'Hiện không có CV nào đang chờ phản hồi.'
                    : 'Chưa có hồ sơ CV nào trong danh sách này.'}
                </span>
                <p className="text-xs text-slate-400">
                  {role === 'client'
                    ? 'Internal HR sẽ tiếp tục tìm kiếm và bàn giao các ứng viên đạt tiêu chuẩn.'
                    : 'Hãy sàng lọc và giao các hồ sơ đạt yêu cầu cho Doanh nghiệp.'}
                </p>
              </div>
            }
          />
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xs">
          <Table<SourcingDeliveryDto>
            rowKey="deliveryId"
            columns={columns}
            dataSource={items}
            pagination={items.length > 10 ? { pageSize: 10, showSizeChanger: false } : false}
            size="middle"
          />
        </div>
      )}

      {/* Modal: Client Accept CV */}
      <Modal
        open={Boolean(acceptModalItem)}
        title={
          <div className="flex items-center gap-2 text-emerald-600">
            <CheckCircleOutlined />
            <span>Xác nhận chấp nhận CV của {acceptModalItem?.candidateName || 'ứng viên'}</span>
          </div>
        }
        okText="Chấp nhận CV"
        cancelText="Hủy"
        okButtonProps={{ type: 'primary', loading: decideMutation.isPending }}
        onCancel={() => setAcceptModalItem(null)}
        onOk={() => {
          if (!acceptModalItem) return;
          decideMutation.mutate({
            deliveryId: acceptModalItem.deliveryId,
            body: { decision: 'ACCEPTED' },
          });
        }}
        destroyOnClose
      >
        <p className="text-sm text-slate-700 mb-2">
          Bạn có chắc chắn muốn chấp nhận hồ sơ ứng viên{' '}
          <strong className="text-slate-900">{acceptModalItem?.candidateName || 'Ứng viên'}</strong>?
        </p>
        <p className="text-xs text-slate-500">
          Hồ sơ sẽ được tính vào số lượng CV hoàn thành theo hợp đồng dịch vụ CV Sourcing và chuyển sang các vòng tiếp theo.
        </p>
      </Modal>

      {/* Modal: Client Reject CV with Reason */}
      <Modal
        open={Boolean(rejectModalItem)}
        title={
          <div className="flex items-center gap-2 text-red-600">
            <CloseCircleOutlined />
            <span>Từ chối hồ sơ ứng viên {rejectModalItem?.candidateName || ''}</span>
          </div>
        }
        okText="Xác nhận từ chối"
        cancelText="Hủy"
        okButtonProps={{ danger: true, loading: decideMutation.isPending }}
        onCancel={() => {
          setRejectModalItem(null);
          rejectForm.resetFields();
        }}
        onOk={() => rejectForm.submit()}
        destroyOnClose
      >
        <p className="text-xs text-slate-600 mb-4">
          Theo quy định dịch vụ CV Sourcing, việc từ chối cần chọn đúng lý do hợp lệ. Hồ sơ bị từ chối hợp lệ sẽ
          không bị tính phí và Internal HR có thể cung cấp ứng viên dự phòng thay thế.
        </p>

        <Form form={rejectForm} layout="vertical" onFinish={handleRejectSubmit}>
          <Form.Item
            name="reasonCode"
            label="Lý do từ chối"
            rules={[{ required: true, message: 'Vui lòng chọn một lý do từ chối.' }]}
          >
            <Radio.Group className="w-full space-y-2">
              {SOURCING_REJECT_REASONS.map((r) => (
                <div key={r.value} className="rounded-lg border border-slate-200 p-2.5 hover:bg-slate-50 transition-colors">
                  <Radio value={r.value} className="w-full">
                    <span className="font-medium text-slate-900">{r.label}</span>
                    <div className="text-xs text-slate-500 pl-6">{r.description}</div>
                  </Radio>
                </div>
              ))}
            </Radio.Group>
          </Form.Item>

          <Form.Item noStyle shouldUpdate={(prev, curr) => prev.reasonCode !== curr.reasonCode}>
            {({ getFieldValue }) => {
              const isOther = getFieldValue('reasonCode') === 'OTHER';
              return (
                <Form.Item
                  name="note"
                  label={isOther ? 'Ghi chú giải thích chi tiết (Bắt buộc)' : 'Ghi chú thêm (Không bắt buộc)'}
                  rules={[
                    {
                      required: isOther,
                      whitespace: true,
                      message: 'Lý do khác bắt buộc phải ghi chú chi tiết để Internal HR xác minh.',
                    },
                    { max: 2000, message: 'Ghi chú tối đa 2000 ký tự.' },
                  ]}
                >
                  <Input.TextArea
                    rows={3}
                    maxLength={2000}
                    showCount
                    placeholder={
                      isOther
                        ? 'Vui lòng nêu rõ lý do từ chối cụ thể để HR Connect xác minh...'
                        : 'Nhập thông tin bổ sung nếu cần...'
                    }
                  />
                </Form.Item>
              );
            }}
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal: HR Review Rejection */}
      <Modal
        open={Boolean(reviewRejectionItem)}
        title="Xác minh lý do từ chối từ Doanh nghiệp"
        okText="Lưu kết quả xác minh"
        cancelText="Hủy"
        okButtonProps={{ loading: reviewMutation.isPending }}
        onCancel={() => {
          setReviewRejectionItem(null);
          reviewForm.resetFields();
        }}
        onOk={() => reviewForm.submit()}
        destroyOnClose
      >
        <div className="rounded-lg bg-amber-50 p-3 mb-4 text-xs text-amber-900">
          <div>
            <b>Ứng viên:</b> {reviewRejectionItem?.candidateName}
          </div>
          <div>
            <b>Lý do Client báo:</b> {getRejectReasonLabel(reviewRejectionItem?.rejectReasonCode)}
          </div>
          {reviewRejectionItem?.rejectNote && (
            <div>
              <b>Ghi chú:</b> {reviewRejectionItem.rejectNote}
            </div>
          )}
        </div>

        <Form form={reviewForm} layout="vertical" onFinish={handleReviewRejectionSubmit} initialValues={{ upheld: true }}>
          <Form.Item
            name="upheld"
            label="Kết quả xác minh"
            rules={[{ required: true, message: 'Chọn kết quả xác minh.' }]}
          >
            <Radio.Group className="w-full space-y-2">
              <Radio value={true}>
                <span className="font-semibold text-slate-800">Giữ nguyên từ chối (Hợp lệ)</span>
                <div className="text-xs text-slate-500">Chấp nhận lý do từ chối của khách hàng, có thể giao CV thay thế.</div>
              </Radio>
              <Radio value={false}>
                <span className="font-semibold text-slate-800">Bác bỏ từ chối (Chuyển sang Chấp nhận)</span>
                <div className="text-xs text-slate-500">Lý do không hợp lý; hồ sơ chuyển thành Đã chấp nhận để tính phí.</div>
              </Radio>
            </Radio.Group>
          </Form.Item>

          <Form.Item name="note" label="Ghi chú xác minh (Không bắt buộc)" rules={[{ max: 2000, message: 'Tối đa 2000 ký tự.' }]}>
            <Input.TextArea rows={3} maxLength={2000} showCount placeholder="Ghi chú nội dung xác minh..." />
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal: HR Replace Delivery */}
      <Modal
        open={Boolean(replaceModalItem)}
        title="Thay thế CV bị từ chối bằng CV dự phòng"
        okText="Thay thế CV"
        cancelText="Hủy"
        okButtonProps={{ loading: replaceMutation.isPending }}
        onCancel={() => {
          setReplaceModalItem(null);
          replaceForm.resetFields();
        }}
        onOk={() => replaceForm.submit()}
        destroyOnClose
      >
        <p className="text-xs text-slate-600 mb-3">
          Nhập mã hồ sơ ứng viên (Application ID) đạt yêu cầu dự phòng để bàn giao thay thế cho ứng viên{' '}
          <strong>{replaceModalItem?.candidateName}</strong>. CV mới sẽ có thời hạn xem xét 7 ngày mới.
        </p>

        <Form form={replaceForm} layout="vertical" onFinish={handleReplaceSubmit}>
          <Form.Item
            name="applicationId"
            label="Mã hồ sơ ứng viên thay thế (Application ID)"
            rules={[
              { required: true, whitespace: true, message: 'Vui lòng nhập Application ID của CV dự phòng.' },
            ]}
          >
            <Input placeholder="Nhập UUID hồ sơ ứng viên đạt yêu cầu..." />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
