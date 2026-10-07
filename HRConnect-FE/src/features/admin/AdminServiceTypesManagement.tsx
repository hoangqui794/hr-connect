import React, { useState } from 'react';
import {
  Table, Tag, Button, Modal, Input, Switch, Row, Col,
  Form, message, Space, Select, Popconfirm, Tooltip,
  Typography, Alert, Badge,
} from 'antd';
import {
  AppstoreOutlined, PlusOutlined, EditOutlined,
  DeleteOutlined, ReloadOutlined, SearchOutlined,
  CheckCircleOutlined, StopOutlined, ExclamationCircleOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';

import { PageHeaderB2B } from '@/components/common/PageHeaderB2B';
import { FintechMetricCard } from '@/components/common/FintechMetricCard';
import type { ServiceTypeDto } from '@/types/admin';
import {
  useAdminServiceTypes,
  useCreateServiceType,
  useUpdateServiceType,
  useDeleteServiceType,
} from '@/services/queries/useAdminServiceTypes';

const { TextArea } = Input;
const { Text } = Typography;

export const AdminServiceTypesManagement: React.FC = () => {
  // ─── Query State ───────────────────────────────────────────────────────────
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [isActiveFilter, setIsActiveFilter] = useState<string>('ALL');
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const {
    data: serviceTypesResponse,
    isLoading,
    isFetching,
    refetch,
  } = useAdminServiceTypes({
    search: search || undefined,
    isActive: isActiveFilter === 'ALL' ? undefined : isActiveFilter === 'ACTIVE',
    page,
    pageSize,
    sortBy: 'name',
    sortDirection: 'asc',
  });

  const items = serviceTypesResponse?.data?.items || [];
  const total = serviceTypesResponse?.data?.total || 0;

  // KPI counts
  const { data: allServicesResponse } = useAdminServiceTypes({ page: 1, pageSize: 100 });
  const allItems = allServicesResponse?.data?.items || [];
  const totalActive = allItems.filter((s) => s.isActive).length;
  const totalInactive = allItems.filter((s) => !s.isActive).length;

  // ─── Modal States ──────────────────────────────────────────────────────────
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ServiceTypeDto | null>(null);

  const [createForm] = Form.useForm();
  const [editForm] = Form.useForm();

  // ─── Mutations ─────────────────────────────────────────────────────────────
  const createMutation = useCreateServiceType();
  const updateMutation = useUpdateServiceType();
  const deleteMutation = useDeleteServiceType();

  // ─── Handlers ─────────────────────────────────────────────────────────────
  const handleSearch = () => {
    setSearch(searchInput.trim());
    setPage(1);
  };

  const handleOpenCreate = () => {
    createForm.resetFields();
    createForm.setFieldsValue({ isActive: true });
    setIsCreateModalOpen(true);
  };

  const handleConfirmCreate = async () => {
    try {
      const values = await createForm.validateFields();
      const codeNormalized = values.code
        ? values.code.trim().toUpperCase().replace(/\s+/g, '_')
        : undefined;

      const res = await createMutation.mutateAsync({
        code: codeNormalized,
        name: values.name.trim(),
        description: values.description?.trim() || '',
        isActive: values.isActive ?? true,
      });

      message.success(res.message || 'Tạo mới loại dịch vụ tuyển dụng thành công!');
      setIsCreateModalOpen(false);
      createForm.resetFields();
      void refetch();
    } catch (err: any) {
      if (err?.errorFields) return;
      message.error(err.message || 'Không thể tạo mới loại dịch vụ.');
    }
  };

  const handleOpenEdit = (record: ServiceTypeDto) => {
    setEditingItem(record);
    editForm.setFieldsValue({
      code: record.code,
      name: record.name,
      description: record.description,
      isActive: record.isActive,
    });
    setIsEditModalOpen(true);
  };

  const handleConfirmEdit = async () => {
    if (!editingItem) return;
    try {
      const values = await editForm.validateFields();
      const codeNormalized = values.code
        ? values.code.trim().toUpperCase().replace(/\s+/g, '_')
        : undefined;

      const res = await updateMutation.mutateAsync({
        id: editingItem.id,
        command: {
          id: editingItem.id,
          code: codeNormalized,
          name: values.name.trim(),
          description: values.description?.trim() || '',
          isActive: values.isActive ?? true,
        },
      });

      message.success(res.message || 'Cập nhật loại dịch vụ thành công!');
      setIsEditModalOpen(false);
      setEditingItem(null);
      void refetch();
    } catch (err: any) {
      if (err?.errorFields) return;
      message.error(err.message || 'Không thể cập nhật loại dịch vụ.');
    }
  };

  const handleDelete = async (record: ServiceTypeDto) => {
    try {
      const res = await deleteMutation.mutateAsync(record.id);
      message.success(res.message || 'Thao tác xóa loại dịch vụ hoàn tất.');
      void refetch();
    } catch (err: any) {
      message.error(err.message || 'Không thể xóa loại dịch vụ.');
    }
  };

  // ─── Table Columns ────────────────────────────────────────────────────────
  const columns: ColumnsType<ServiceTypeDto> = [
    {
      title: 'MÃ DỊCH VỤ (CODE)',
      dataIndex: 'code',
      key: 'code',
      width: 180,
      render: (code: string) => (
        <span className="font-mono font-bold text-xs bg-slate-100 px-2.5 py-1 rounded border border-slate-200 text-slate-800">
          {code || 'N/A'}
        </span>
      ),
    },
    {
      title: 'TÊN LOẠI DỊCH VỤ',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record) => (
        <div>
          <div className="font-semibold text-slate-900 text-sm">{name}</div>
          {record.description && (
            <div className="text-xs text-slate-500 mt-0.5 line-clamp-1 max-w-lg leading-relaxed">
              {record.description}
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'TRẠNG THÁI',
      dataIndex: 'isActive',
      key: 'isActive',
      width: 150,
      render: (isActive: boolean) => (
        <span
          className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-full border ${
            isActive
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : 'bg-slate-100 text-slate-600 border-slate-200'
          }`}
        >
          {isActive ? (
            <>
              <CheckCircleOutlined className="text-emerald-600" />
              Đang hoạt động
            </>
          ) : (
            <>
              <StopOutlined className="text-slate-400" />
              Ngưng kích hoạt
            </>
          )}
        </span>
      ),
    },
    {
      title: 'NGÀY TẠO',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 140,
      render: (date: string) => (
        <span className="text-xs text-slate-600 font-mono">
          {date && dayjs(date).isValid() ? dayjs(date).format('DD/MM/YYYY') : 'Mặc định'}
        </span>
      ),
    },
    {
      title: 'THAO TÁC',
      key: 'actions',
      width: 140,
      align: 'right',
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="Chỉnh sửa thông tin">
            <Button
              size="small"
              icon={<EditOutlined />}
              onClick={() => handleOpenEdit(record)}
              className="text-blue-600 border-blue-200 hover:bg-blue-50 rounded-lg text-xs"
            >
              Sửa
            </Button>
          </Tooltip>

          <Popconfirm
            title="Xác nhận xóa hoặc vô hiệu hóa?"
            description="Nếu dịch vụ đã có dữ liệu liên kết, hệ thống sẽ chuyển sang trạng thái ngưng hoạt động (deactivated)."
            onConfirm={() => handleDelete(record)}
            okText="Xác nhận"
            cancelText="Hủy"
            okButtonProps={{ danger: true, loading: deleteMutation.isPending }}
          >
            <Tooltip title="Xóa hoặc ngưng hoạt động">
              <Button
                size="small"
                danger
                icon={<DeleteOutlined />}
                disabled={deleteMutation.isPending}
                className="rounded-lg text-xs"
              >
                Xóa
              </Button>
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* ─── Header ────────────────────────────────────────────────────────── */}
      <PageHeaderB2B
        title="Quản Lý Danh Mục Loại Dịch Vụ Tuyển Dụng (Service Types)"
        badge={
          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
            📦 B2B Packages
          </span>
        }
        subtitle="Quản lý toàn diện các gói dịch vụ tuyển dụng trên sàn HRConnect: COD trọn gói bảo hành 60 ngày, CV Sourcing, và Đăng tin ứng tuyển mở."
        actions={
          <Space>
            <Button
              icon={<ReloadOutlined spin={isFetching} />}
              onClick={() => void refetch()}
              className="rounded-xl border-slate-300 font-medium text-slate-700 hover:text-blue-600 text-xs"
            >
              Làm mới
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleOpenCreate}
              className="rounded-xl font-bold bg-blue-600 hover:bg-blue-700 text-xs shadow-sm"
            >
              Thêm loại dịch vụ
            </Button>
          </Space>
        }
      />

      {/* ─── KPI Metrics ──────────────────────────────────────────────────── */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={8}>
          <FintechMetricCard
            label="Tổng gói dịch vụ"
            value={allItems.length}
            subLabel="Danh mục hiện hữu trên hệ thống"
            statusBadge="System Categories"
            statusType="info"
            icon={<AppstoreOutlined />}
            iconColor="#6366f1"
          />
        </Col>

        <Col xs={24} sm={8}>
          <FintechMetricCard
            label="Đang mở hoạt động"
            value={totalActive}
            subLabel="Doanh nghiệp có thể chọn khi đăng tin"
            statusBadge="Active Packages"
            statusType="eligible"
            icon={<CheckCircleOutlined />}
            iconColor="#10b981"
            onClick={() => setIsActiveFilter('ACTIVE')}
          />
        </Col>

        <Col xs={24} sm={8}>
          <FintechMetricCard
            label="Đang ngưng kích hoạt"
            value={totalInactive}
            subLabel="Tạm khóa khỏi wizard đăng tin"
            statusBadge="Deactivated"
            statusType="neutral"
            icon={<StopOutlined />}
            iconColor="#64748b"
            onClick={() => setIsActiveFilter('INACTIVE')}
          />
        </Col>
      </Row>

      {/* ─── Filter & Table Card ──────────────────────────────────────────── */}
      <div className="b2b-card p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 pb-3 border-b border-slate-200/80">
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm text-slate-900">
              Danh sách loại dịch vụ
            </span>
            <Badge count={total} overflowCount={99} className="ml-1" style={{ backgroundColor: '#2563eb' }} />
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <Select
              value={isActiveFilter}
              onChange={(val) => {
                setIsActiveFilter(val);
                setPage(1);
              }}
              style={{ width: 170 }}
              options={[
                { value: 'ALL', label: 'Tất cả trạng thái' },
                { value: 'ACTIVE', label: '🟢 Đang hoạt động' },
                { value: 'INACTIVE', label: '⚪ Ngưng kích hoạt' },
              ]}
              className="rounded-lg text-xs"
            />

            <Input
              placeholder="Tìm theo tên hoặc mã code..."
              prefix={<SearchOutlined className="text-slate-400" />}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onPressEnter={handleSearch}
              style={{ width: 260 }}
              allowClear
              onClear={() => {
                setSearchInput('');
                setSearch('');
              }}
              className="rounded-lg text-xs"
            />

            <Button
              type="primary"
              onClick={handleSearch}
              className="rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700"
            >
              Tìm kiếm
            </Button>
          </div>
        </div>

        <Table<ServiceTypeDto>
          rowKey="id"
          columns={columns}
          dataSource={items}
          loading={isLoading}
          pagination={{
            current: page,
            pageSize,
            total,
            onChange: (p) => setPage(p),
            showTotal: (total) => `Tổng số ${total} loại dịch vụ`,
            size: 'small',
          }}
          className="b2b-table"
        />
      </div>

      {/* ─── Modal Create Service Type ────────────────────────────────────── */}
      <Modal
        title={
          <div className="flex items-center gap-2 font-bold text-slate-900">
            <PlusOutlined className="text-blue-600" />
            <span>Thêm Mới Loại Dịch Vụ Tuyển Dụng</span>
          </div>
        }
        open={isCreateModalOpen}
        onCancel={() => {
          if (!createMutation.isPending) {
            setIsCreateModalOpen(false);
          }
        }}
        onOk={handleConfirmCreate}
        confirmLoading={createMutation.isPending}
        okText="Tạo mới loại dịch vụ"
        cancelText="Hủy bỏ"
        okButtonProps={{
          disabled: createMutation.isPending,
          className: 'bg-blue-600 hover:bg-blue-700 font-semibold',
        }}
      >
        <Form form={createForm} layout="vertical" className="mt-4">
          <Alert
            type="info"
            showIcon
            message="Chuẩn hóa UPPER_SNAKE_CASE"
            description="Mã code dịch vụ sẽ được tự động chuẩn hóa sang chữ hoa không dấu gạch nối (Ví dụ: HEADHUNT_COD, EXECUTIVE_SEARCH)."
            style={{ marginBottom: 16, borderRadius: 8 }}
          />

          <Form.Item
            name="code"
            label={<span className="font-semibold text-xs text-slate-800">Mã định danh (Code)</span>}
            rules={[
              {
                pattern: /^[A-Za-z0-9_ ]+$/,
                message: 'Mã code chỉ được chứa chữ cái, số và dấu gạch dưới',
              },
            ]}
          >
            <Input
              placeholder="VD: HEADHUNT_COD, CV_SOURCING, RPO_PREMIUM..."
              className="font-mono rounded-lg uppercase"
            />
          </Form.Item>

          <Form.Item
            name="name"
            label={
              <span className="font-semibold text-xs text-slate-800">
                Tên loại dịch vụ <span className="text-rose-500">*</span>
              </span>
            }
            rules={[{ required: true, message: 'Vui lòng nhập tên loại dịch vụ' }]}
          >
            <Input placeholder="VD: Tuyển dụng trọn gói (COD), Sàng lọc hồ sơ chuyên sâu..." className="rounded-lg" />
          </Form.Item>

          <Form.Item
            name="description"
            label={<span className="font-semibold text-xs text-slate-800">Mô tả chi tiết quyền lợi & bảo hành</span>}
          >
            <TextArea
              rows={4}
              placeholder="Mô tả cơ chế hoạt động, thời hạn bảo hành, cách tính phí và quyền lợi của Client / Affiliate..."
              className="rounded-lg text-xs"
            />
          </Form.Item>

          <Form.Item
            name="isActive"
            valuePropName="checked"
            label={<span className="font-semibold text-xs text-slate-800">Kích hoạt sử dụng ngay</span>}
          >
            <Switch defaultChecked />
          </Form.Item>
        </Form>
      </Modal>

      {/* ─── Modal Edit Service Type ──────────────────────────────────────── */}
      <Modal
        title={
          <div className="flex items-center gap-2 font-bold text-slate-900">
            <EditOutlined className="text-blue-600" />
            <span>Cập Nhật Loại Dịch Vụ Tuyển Dụng</span>
          </div>
        }
        open={isEditModalOpen}
        onCancel={() => {
          if (!updateMutation.isPending) {
            setIsEditModalOpen(false);
            setEditingItem(null);
          }
        }}
        onOk={handleConfirmEdit}
        confirmLoading={updateMutation.isPending}
        okText="Lưu thay đổi"
        cancelText="Hủy bỏ"
        okButtonProps={{
          disabled: updateMutation.isPending,
          className: 'bg-blue-600 hover:bg-blue-700 font-semibold',
        }}
      >
        <Form form={editForm} layout="vertical" className="mt-4">
          <Form.Item
            name="code"
            label={<span className="font-semibold text-xs text-slate-800">Mã định danh (Code)</span>}
            help="Theo hợp đồng, mã Code không nên thay đổi nếu loại dịch vụ đã phát sinh dữ liệu liên kết."
          >
            <Input className="font-mono rounded-lg uppercase" />
          </Form.Item>

          <Form.Item
            name="name"
            label={
              <span className="font-semibold text-xs text-slate-800">
                Tên loại dịch vụ <span className="text-rose-500">*</span>
              </span>
            }
            rules={[{ required: true, message: 'Vui lòng nhập tên loại dịch vụ' }]}
          >
            <Input className="rounded-lg" />
          </Form.Item>

          <Form.Item
            name="description"
            label={<span className="font-semibold text-xs text-slate-800">Mô tả chi tiết quyền lợi & bảo hành</span>}
          >
            <TextArea rows={4} className="rounded-lg text-xs" />
          </Form.Item>

          <Form.Item
            name="isActive"
            valuePropName="checked"
            label={<span className="font-semibold text-xs text-slate-800">Trạng thái kích hoạt</span>}
          >
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default AdminServiceTypesManagement;
