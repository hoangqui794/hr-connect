/**
 * @file JobTemplatesAdminPage.tsx
 * @description MF-01 F3: JD Template Management for Internal HR & Admin (route: /hr/job-templates & /admin/job-templates).
 * Allows searching, creating, editing, previewing, and activating/deactivating standardized JD templates.
 */
import React, { useState } from 'react';
import {
  Alert,
  App as AntApp,
  Badge,
  Button,
  Card,
  Col,
  Descriptions,
  Divider,
  Drawer,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  BookOutlined,
  CheckCircleOutlined,
  CheckOutlined,
  CloseCircleOutlined,
  DeleteOutlined,
  EditOutlined,
  ExclamationCircleOutlined,
  EyeOutlined,
  FileTextOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  StopOutlined,
} from '@ant-design/icons';
import { PageHero } from '@/features/admin-console/ui';
import '@/features/admin-console/admin-console.css';
import type {
  EmploymentType,
  JobRequirementType,
  JobTemplate,
  JobTemplateIndustry,
  JobTemplateLevel,
  JobTemplateRequirement,
  JobTemplateSummary,
  JobTemplateUpsertInput,
} from '@/types/api/jobs';
import { jobsApi } from '@/services/api/jobsApi';
import { getApiErrorMessage } from '@/services/apiClient';
import {
  EMPLOYMENT_TYPE_LABEL,
  JOB_TEMPLATE_CATEGORY_LABEL,
  JOB_TEMPLATE_INDUSTRY_LABEL,
  JOB_TEMPLATE_LEVEL_LABEL,
  formatDateTime,
  formatExperience,
  formatTemplateCategory,
  formatTemplateIndustry,
  formatTemplateLevel,
} from './jobDisplay';
import {
  useInternalJobTemplate,
  useInternalJobTemplates,
  useJobTemplateMutations,
} from './useJobQueries';
import { JobTemplatePreviewDrawer } from './JobTemplatePreviewDrawer';

const { Text, Paragraph, Title } = Typography;
const { Option } = Select;

const INDUSTRY_OPTIONS: { value: JobTemplateIndustry; label: string }[] = [
  { value: 'IT', label: 'Công nghệ thông tin (IT)' },
  { value: 'MARKETING', label: 'Marketing' },
  { value: 'SALES', label: 'Kinh doanh (Sales)' },
  { value: 'ACCOUNTING', label: 'Kế toán (Accounting)' },
  { value: 'HR', label: 'Nhân sự (HR)' },
  { value: 'ADMIN', label: 'Hành chính (Admin)' },
];

const LEVEL_OPTIONS: { value: JobTemplateLevel; label: string }[] = [
  { value: 'INTERN', label: 'Thực tập sinh (Intern)' },
  { value: 'JUNIOR', label: 'Nhân viên mới (Junior)' },
  { value: 'MIDDLE', label: 'Chuyên viên (Middle)' },
  { value: 'SENIOR', label: 'Chuyên viên cao cấp (Senior)' },
  { value: 'LEAD', label: 'Trưởng nhóm (Lead)' },
];

const EMPLOYMENT_OPTIONS: { value: EmploymentType; label: string }[] = [
  { value: 'FULL_TIME', label: 'Toàn thời gian (Full-time)' },
  { value: 'PART_TIME', label: 'Bán thời gian (Part-time)' },
  { value: 'CONTRACT', label: 'Hợp đồng (Contract)' },
  { value: 'INTERNSHIP', label: 'Thực tập (Internship)' },
  { value: 'FREELANCE', label: 'Freelance' },
];

const CATEGORY_OPTIONS: { value: string; label: string }[] = [
  { value: 'EXPERIENCE', label: 'Kinh nghiệm (EXPERIENCE)' },
  { value: 'SKILL', label: 'Kỹ năng (SKILL - điền vào Kỹ năng chính)' },
  { value: 'EDUCATION', label: 'Học vấn (EDUCATION)' },
  { value: 'OTHER', label: 'Khác (OTHER)' },
];

interface RequirementFormItem {
  key: string;
  requirementType: JobRequirementType;
  category: string;
  content: string;
}

export const JobTemplatesAdminPage: React.FC = () => {
  const { message, modal } = AntApp.useApp();

  // Search and filter state
  const [keyword, setKeyword] = useState<string>('');
  const [industryFilter, setIndustryFilter] = useState<string | undefined>(undefined);
  const [activeFilter, setActiveFilter] = useState<boolean | undefined>(undefined);
  const [page, setPage] = useState<number>(1);
  const pageSize = 10;

  // Query templates
  const { data: pageData, isLoading, refetch } = useInternalJobTemplates({
    keyword: keyword ? keyword.trim() : undefined,
    industry: industryFilter,
    isActive: activeFilter,
    page,
    pageSize,
  });

  // Mutations
  const mutations = useJobTemplateMutations();

  // Preview Drawer state
  const [previewTemplateId, setPreviewTemplateId] = useState<string | null>(null);
  const [previewDraftData, setPreviewDraftData] = useState<Partial<JobTemplate> | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState<boolean>(false);

  // Form Drawer state
  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [concurrencyToken, setConcurrencyToken] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState<boolean>(false);
  const [codeDuplicateError, setCodeDuplicateError] = useState<string | null>(null);

  // Antd Form
  const [form] = Form.useForm();
  const [requirements, setRequirements] = useState<RequirementFormItem[]>([]);
  const [mustHaveError, setMustHaveError] = useState<boolean>(false);

  // Open Create Form
  const handleOpenCreate = () => {
    setEditingTemplateId(null);
    setConcurrencyToken(null);
    setCodeDuplicateError(null);
    setMustHaveError(false);
    form.resetFields();
    form.setFieldsValue({
      code: '',
      name: '',
      industry: 'IT',
      level: 'MIDDLE',
      employmentType: 'FULL_TIME',
      minExperienceYears: 1,
      maxExperienceYears: 3,
      title: '',
      summary: '',
      description: '',
      benefits: '',
      keywords: '',
    });
    setRequirements([
      { key: 'req_1', requirementType: 'MUST_HAVE', category: 'EXPERIENCE', content: '' },
      { key: 'req_2', requirementType: 'SHOULD_HAVE', category: 'SKILL', content: '' },
    ]);
    setIsFormOpen(true);
  };

  // Open Edit Form
  const handleOpenEdit = async (record: JobTemplateSummary) => {
    setEditingTemplateId(record.templateId);
    setCodeDuplicateError(null);
    setMustHaveError(false);
    setFormLoading(true);
    setIsFormOpen(true);

    try {
      const detail = await jobsApi.getInternalTemplate(record.templateId);
      setConcurrencyToken(detail.concurrencyToken ?? null);
      form.setFieldsValue({
        code: detail.code,
        name: detail.name,
        industry: detail.industry,
        level: detail.level,
        employmentType: detail.employmentType,
        minExperienceYears: detail.minExperienceYears,
        maxExperienceYears: detail.maxExperienceYears,
        title: detail.title,
        summary: detail.summary,
        description: detail.description,
        benefits: detail.benefits,
        keywords: detail.keywords,
      });

      const initialReqs: RequirementFormItem[] = (detail.requirements ?? []).map((r, idx) => ({
        key: `req_${idx}_${Date.now()}`,
        requirementType: r.requirementType,
        category: r.category || 'OTHER',
        content: r.content,
      }));

      setRequirements(
        initialReqs.length > 0
          ? initialReqs
          : [{ key: 'req_1', requirementType: 'MUST_HAVE', category: 'EXPERIENCE', content: '' }]
      );
    } catch (err) {
      message.error(getApiErrorMessage(err, 'Không thể tải chi tiết mẫu JD để chỉnh sửa.'));
      setIsFormOpen(false);
    } finally {
      setFormLoading(false);
    }
  };

  // Requirements manipulation
  const handleAddRequirement = () => {
    setRequirements((prev) => [
      ...prev,
      {
        key: `req_${Date.now()}_${Math.random()}`,
        requirementType: 'SHOULD_HAVE',
        category: 'SKILL',
        content: '',
      },
    ]);
    setMustHaveError(false);
  };

  const handleRemoveRequirement = (key: string) => {
    setRequirements((prev) => prev.filter((r) => r.key !== key));
  };

  const handleUpdateRequirement = (
    key: string,
    field: 'requirementType' | 'category' | 'content',
    value: string
  ) => {
    setRequirements((prev) =>
      prev.map((r) => (r.key === key ? { ...r, [field]: value } : r))
    );
    if (field === 'requirementType' && value === 'MUST_HAVE') {
      setMustHaveError(false);
    }
  };

  // Live preview of form draft
  const handlePreviewFormDraft = () => {
    const values = form.getFieldsValue();
    const formattedReqs: JobTemplateRequirement[] = requirements
      .filter((r) => r.content.trim())
      .map((r) => ({
        requirementType: r.requirementType,
        category: r.category,
        content: r.content.trim(),
      }));

    const draft: Partial<JobTemplate> = {
      code: values.code ? values.code.trim().toUpperCase() : '',
      name: values.name ? values.name.trim() : 'Mẫu chưa đặt tên',
      industry: values.industry || 'IT',
      level: values.level || null,
      employmentType: values.employmentType || null,
      minExperienceYears: values.minExperienceYears ?? null,
      maxExperienceYears: values.maxExperienceYears ?? null,
      title: values.title ? values.title.trim() : values.name,
      summary: values.summary ? values.summary.trim() : null,
      description: values.description ? values.description.trim() : '',
      benefits: values.benefits ? values.benefits.trim() : null,
      requirements: formattedReqs,
    };

    setPreviewDraftData(draft);
    setPreviewTemplateId(null);
    setIsPreviewOpen(true);
  };

  // Save form (Create or Update)
  const handleSaveForm = async () => {
    try {
      const values = await form.validateFields();

      // Check must have
      const validReqs = requirements.filter((r) => r.content.trim());
      const hasMustHave = validReqs.some((r) => r.requirementType === 'MUST_HAVE');
      if (!hasMustHave) {
        setMustHaveError(true);
        message.error('Bắt buộc phải có ít nhất 1 yêu cầu loại "Bắt buộc" (MUST_HAVE).');
        return;
      }
      setMustHaveError(false);
      setCodeDuplicateError(null);

      const payload: JobTemplateUpsertInput = {
        code: values.code.trim().toUpperCase(),
        name: values.name.trim(),
        industry: values.industry,
        level: values.level || null,
        employmentType: values.employmentType || null,
        minExperienceYears: values.minExperienceYears ?? null,
        maxExperienceYears: values.maxExperienceYears ?? null,
        title: values.title.trim(),
        summary: values.summary?.trim() || null,
        description: values.description.trim(),
        benefits: values.benefits?.trim() || null,
        keywords: values.keywords?.trim() || null,
        requirements: validReqs.map((r) => ({
          requirementType: r.requirementType,
          category: r.category,
          content: r.content.trim(),
        })),
      };

      if (editingTemplateId) {
        if (!concurrencyToken) {
          message.error('Không tìm thấy concurrencyToken của mẫu. Vui lòng tải lại trang.');
          return;
        }
        await mutations.update.mutateAsync({
          id: editingTemplateId,
          concurrencyToken,
          template: payload,
        });
        message.success('Cập nhật mẫu JD thành công!');
      } else {
        await mutations.create.mutateAsync(payload);
        message.success('Tạo mẫu JD mới thành công!');
      }

      setIsFormOpen(false);
      refetch();
    } catch (err: any) {
      if (err?.errorFields) return; // Validation failed
      const apiErr = err?.response?.data;
      if (apiErr?.errorCode === 'TEMPLATE_CODE_DUPLICATE') {
        setCodeDuplicateError('Mã mẫu đã tồn tại trên hệ thống. Vui lòng chọn mã khác.');
        message.error('Mã mẫu bị trùng lặp.');
      } else if (
        err?.response?.status === 409 ||
        apiErr?.errorCode === 'TEMPLATE_CONCURRENCY_CONFLICT'
      ) {
        modal.error({
          title: 'Xung đột dữ liệu (409)',
          icon: <ExclamationCircleOutlined className="text-amber-500" />,
          content: 'Mẫu vừa được người khác cập nhật. Tải lại để xem bản mới.',
          okText: 'Tải lại',
          onOk: () => {
            setIsFormOpen(false);
            refetch();
          },
        });
      } else {
        message.error(getApiErrorMessage(err, 'Không thể lưu mẫu JD.'));
      }
    }
  };

  // Toggle active confirmation
  const handleToggleActiveConfirm = (record: JobTemplateSummary) => {
    const willActivate = !record.isActive;
    modal.confirm({
      title: willActivate ? 'Kích hoạt lại mẫu JD?' : 'Ẩn mẫu JD?',
      icon: willActivate ? (
        <CheckCircleOutlined className="text-emerald-500" />
      ) : (
        <ExclamationCircleOutlined className="text-amber-500" />
      ),
      content: (
        <div className="space-y-2 py-1 text-xs text-slate-600">
          <p className="m-0 text-sm font-semibold text-slate-800">
            {willActivate
              ? `Mẫu "${record.name}" sẽ hiển thị lại trong danh sách gợi ý cho Doanh nghiệp.`
              : `Mẫu "${record.name}" sẽ bị ẩn khỏi danh sách gợi ý cho Doanh nghiệp.`}
          </p>
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-amber-900">
            ⚠️ <strong>Lưu ý:</strong> Các job đã tạo từ mẫu này không bị thay đổi.
          </div>
        </div>
      ),
      okText: willActivate ? 'Kích hoạt' : 'Ẩn mẫu',
      okButtonProps: willActivate ? { type: 'primary' } : { danger: true },
      cancelText: 'Hủy',
      onOk: async () => {
        try {
          await mutations.toggleActive.mutateAsync({
            id: record.templateId,
            activate: willActivate,
          });
          message.success(
            willActivate
              ? `Đã kích hoạt mẫu "${record.name}".`
              : `Đã ẩn mẫu "${record.name}".`
          );
          refetch();
        } catch (err) {
          message.error(getApiErrorMessage(err, 'Thao tác không thành công.'));
        }
      },
    });
  };

  // Table columns
  const columns: ColumnsType<JobTemplateSummary> = [
    {
      title: 'Mẫu JD & Mã',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record) => (
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-900 text-sm hover:text-sky-700 cursor-pointer" onClick={() => handleOpenEdit(record)}>
              {name}
            </span>
            <Tag className="font-mono text-[11px] bg-slate-100 border-slate-200 text-slate-600 rounded">
              {record.code}
            </Tag>
          </div>
          {record.summary && (
            <p className="m-0 text-xs text-slate-500 line-clamp-1 max-w-md">{record.summary}</p>
          )}
        </div>
      ),
    },
    {
      title: 'Ngành nghề',
      dataIndex: 'industry',
      key: 'industry',
      width: 150,
      render: (industry: string) => (
        <Tag color="blue" className="rounded font-medium">
          {formatTemplateIndustry(industry)}
        </Tag>
      ),
    },
    {
      title: 'Cấp bậc',
      dataIndex: 'level',
      key: 'level',
      width: 140,
      render: (level: string | null) =>
        level ? (
          <Tag color="purple" className="rounded font-medium">
            {formatTemplateLevel(level)}
          </Tag>
        ) : (
          <span className="text-slate-400 text-xs">—</span>
        ),
    },
    {
      title: 'Yêu cầu',
      dataIndex: 'requirementCount',
      key: 'requirementCount',
      width: 100,
      align: 'center',
      render: (count: number) => (
        <Tag className="rounded font-semibold bg-sky-50 text-sky-800 border-sky-200">
          {count} mục
        </Tag>
      ),
    },
    {
      title: 'Lượt dùng',
      dataIndex: 'usageCount',
      key: 'usageCount',
      width: 100,
      align: 'center',
      render: (count: number) => <span className="font-semibold text-slate-700 text-xs">{count}</span>,
    },
    {
      title: 'Trạng thái',
      dataIndex: 'isActive',
      key: 'isActive',
      width: 140,
      render: (isActive: boolean) =>
        isActive ? (
          <Tag color="success" className="rounded font-medium">
            Đang hoạt động
          </Tag>
        ) : (
          <Tag color="default" className="rounded font-medium text-slate-500">
            Đã ẩn
          </Tag>
        ),
    },
    {
      title: 'Cập nhật',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      width: 150,
      render: (val: string) => <span className="text-xs text-slate-500">{formatDateTime(val)}</span>,
    },
    {
      title: 'Thao tác',
      key: 'actions',
      width: 160,
      align: 'right',
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="Xem trước mẫu">
            <Button
              type="text"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => {
                setPreviewDraftData(null);
                setPreviewTemplateId(record.templateId);
                setIsPreviewOpen(true);
              }}
            />
          </Tooltip>
          <Tooltip title="Chỉnh sửa">
            <Button
              type="text"
              size="small"
              icon={<EditOutlined className="text-sky-600" />}
              onClick={() => handleOpenEdit(record)}
            />
          </Tooltip>
          <Tooltip title={record.isActive ? 'Ẩn mẫu' : 'Kích hoạt lại'}>
            <Button
              type="text"
              size="small"
              danger={record.isActive}
              icon={
                record.isActive ? (
                  <StopOutlined className="text-rose-500" />
                ) : (
                  <CheckCircleOutlined className="text-emerald-600" />
                )
              }
              onClick={() => handleToggleActiveConfirm(record)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHero
        title="Thư viện mẫu JD"
        description="Quản lý và chuẩn hóa các mẫu bản mô tả công việc (JD) cho khách hàng doanh nghiệp"
        actions={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleOpenCreate}
            className="!bg-sky-600 hover:!bg-sky-500 font-medium shadow-xs"
          >
            Tạo mẫu mới
          </Button>
        }
      />

      <Card className="rounded-2xl border-slate-200/80 shadow-2xs">
        {/* Filters bar */}
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
            <Input
              placeholder="Tìm theo tên mẫu, mã hoặc từ khóa..."
              prefix={<SearchOutlined className="text-slate-400" />}
              value={keyword}
              onChange={(e) => {
                setKeyword(e.target.value);
                setPage(1);
              }}
              allowClear
              className="max-w-md rounded-lg"
            />
            <Select
              placeholder="Tất cả ngành nghề"
              value={industryFilter}
              onChange={(val) => {
                setIndustryFilter(val);
                setPage(1);
              }}
              allowClear
              className="w-48"
            >
              {INDUSTRY_OPTIONS.map((opt) => (
                <Option key={opt.value} value={opt.value}>
                  {opt.label}
                </Option>
              ))}
            </Select>
            <Select
              placeholder="Tất cả trạng thái"
              value={activeFilter}
              onChange={(val) => {
                setActiveFilter(val);
                setPage(1);
              }}
              allowClear
              className="w-40"
            >
              <Option value={true}>Đang hoạt động</Option>
              <Option value={false}>Đã ẩn</Option>
            </Select>
          </div>

          <Button icon={<ReloadOutlined />} onClick={() => refetch()} loading={isLoading}>
            Làm mới
          </Button>
        </div>

        {/* Table */}
        <Table<JobTemplateSummary>
          columns={columns}
          dataSource={pageData?.items ?? []}
          rowKey="templateId"
          loading={isLoading}
          pagination={{
            current: page,
            pageSize,
            total: pageData?.totalCount ?? 0,
            onChange: (p) => setPage(p),
            showTotal: (total) => `Tổng cộng ${total} mẫu JD`,
            size: 'small',
          }}
          className="admin-table"
        />
      </Card>

      {/* ── Form Drawer: Tạo / Sửa mẫu JD ─────────────────────────────────── */}
      <Drawer
        title={
          <div className="flex items-center gap-2">
            <BookOutlined className="text-sky-600" />
            <span>{editingTemplateId ? 'Chỉnh sửa mẫu JD' : 'Tạo mẫu JD mới'}</span>
          </div>
        }
        open={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        width={760}
        destroyOnClose
        extra={
          <Space>
            <Button icon={<EyeOutlined />} onClick={handlePreviewFormDraft}>
              Xem trước
            </Button>
            <Button onClick={() => setIsFormOpen(false)}>Hủy</Button>
            <Button
              type="primary"
              onClick={handleSaveForm}
              loading={mutations.create.isPending || mutations.update.isPending}
              className="!bg-sky-600 hover:!bg-sky-500 font-medium"
            >
              {editingTemplateId ? 'Cập nhật mẫu' : 'Lưu mẫu mới'}
            </Button>
          </Space>
        }
      >
        <Form
          form={form}
          layout="vertical"
          disabled={formLoading}
          requiredMark={(label, info) =>
            info.required ? (
              <span>
                {label} <span className="text-red-500 font-bold ml-0.5">*</span>
              </span>
            ) : (
              label
            )
          }
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="code"
                label="Mã mẫu (Code)"
                rules={[{ required: true, message: 'Vui lòng nhập mã mẫu (vd: IT_BACKEND_DOTNET)' }]}
                help={codeDuplicateError}
                validateStatus={codeDuplicateError ? 'error' : undefined}
              >
                <Input
                  placeholder="VD: IT_BACKEND_DOTNET"
                  className="font-mono uppercase"
                  onChange={() => setCodeDuplicateError(null)}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="name"
                label="Tên mẫu JD"
                rules={[{ required: true, message: 'Vui lòng nhập tên mẫu' }]}
              >
                <Input placeholder="VD: Lập trình viên Backend .NET" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                name="industry"
                label="Ngành nghề"
                rules={[{ required: true, message: 'Vui lòng chọn ngành nghề' }]}
              >
                <Select placeholder="Chọn ngành">
                  {INDUSTRY_OPTIONS.map((opt) => (
                    <Option key={opt.value} value={opt.value}>
                      {opt.label}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="level" label="Cấp bậc">
                <Select placeholder="Chọn cấp bậc" allowClear>
                  {LEVEL_OPTIONS.map((opt) => (
                    <Option key={opt.value} value={opt.value}>
                      {opt.label}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="employmentType" label="Hình thức làm việc">
                <Select placeholder="Hình thức" allowClear>
                  {EMPLOYMENT_OPTIONS.map((opt) => (
                    <Option key={opt.value} value={opt.value}>
                      {opt.label}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="title"
                label="Tên vị trí công việc (Job Title mặc định)"
                rules={[{ required: true, message: 'Vui lòng nhập tên vị trí công việc' }]}
              >
                <Input placeholder="VD: Senior .NET Core Developer" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="minExperienceYears" label="Số năm KN tối thiểu">
                <InputNumber min={0} max={30} className="w-full" placeholder="Năm" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="maxExperienceYears" label="Số năm KN tối đa">
                <InputNumber min={0} max={30} className="w-full" placeholder="Năm" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="summary" label="Tóm tắt ngắn (Summary)">
            <Input.TextArea
              rows={2}
              placeholder="Tóm tắt ngắn gọn mục tiêu công việc để hiển thị nhanh trên thẻ mẫu..."
            />
          </Form.Item>

          <Form.Item
            name="description"
            label="Mô tả công việc (Job Description)"
            rules={[{ required: true, message: 'Vui lòng nhập mô tả công việc' }]}
          >
            <Input.TextArea
              rows={6}
              placeholder="Chi tiết trách nhiệm, nhiệm vụ công việc hàng ngày..."
            />
          </Form.Item>

          <Form.Item name="benefits" label="Quyền lợi ứng viên (Benefits)">
            <Input.TextArea
              rows={4}
              placeholder="Chế độ đãi ngộ, bảo hiểm, thưởng, cơ hội đào tạo..."
            />
          </Form.Item>

          <Form.Item name="keywords" label="Từ khóa tìm kiếm (Keywords)">
            <Input placeholder="Phân tách bằng dấu cách hoặc phẩy, vd: c# .net aspnet sql microservices" />
          </Form.Item>

          <Divider />

          {/* ── Requirements Editor ────────────────────────────────────── */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="m-0 font-semibold text-sm text-slate-800">
                  Danh sách yêu cầu ứng viên <span className="text-red-500 font-bold ml-1">*</span>
                </h4>
                <p className="m-0 text-xs text-slate-500">
                  Bắt buộc có ít nhất 1 yêu cầu loại &quot;Bắt buộc&quot; (MUST_HAVE). Các yêu cầu có nhóm
                  &quot;Kỹ năng (SKILL)&quot; sẽ được điền vào ô Kỹ năng chính của form tuyển dụng.
                </p>
              </div>
              <Button type="dashed" icon={<PlusOutlined />} onClick={handleAddRequirement} size="small">
                Thêm yêu cầu
              </Button>
            </div>

            {mustHaveError && (
              <Alert
                type="error"
                showIcon
                message="Chưa có yêu cầu bắt buộc"
                description="Mẫu JD cần có ít nhất 1 yêu cầu có loại là Bắt buộc (MUST_HAVE)."
                className="py-1.5"
              />
            )}

            <div className="space-y-2.5">
              {requirements.map((req, index) => (
                <div
                  key={req.key}
                  className="rounded-xl border border-slate-200/90 bg-slate-50/60 p-3 flex items-start gap-2.5"
                >
                  <span className="text-xs font-semibold text-slate-400 mt-2 shrink-0">
                    #{index + 1}
                  </span>

                  <div className="flex-1 space-y-2">
                    <Input.TextArea
                      rows={2}
                      placeholder="Nội dung yêu cầu ứng viên (bắt buộc)..."
                      value={req.content}
                      onChange={(e) => handleUpdateRequirement(req.key, 'content', e.target.value)}
                    />

                    <div className="flex flex-wrap items-center gap-2">
                      <Select
                        value={req.requirementType}
                        onChange={(val) => handleUpdateRequirement(req.key, 'requirementType', val)}
                        className="w-[100px]"
                        size="small"
                      >
                        <Option value="MUST_HAVE">
                          <Tag color="red" className="m-0 text-[10px]">
                            Bắt buộc
                          </Tag>
                        </Option>
                        <Option value="SHOULD_HAVE">
                          <Tag color="orange" className="m-0 text-[10px]">
                            Ưu tiên
                          </Tag>
                        </Option>
                      </Select>

                      <Select
                        value={req.category}
                        onChange={(val) => handleUpdateRequirement(req.key, 'category', val)}
                        className="w-56"
                        size="small"
                      >
                        {CATEGORY_OPTIONS.map((c) => (
                          <Option key={c.value} value={c.value}>
                            {c.label}
                          </Option>
                        ))}
                      </Select>
                    </div>
                  </div>

                  <Button
                    type="text"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => handleRemoveRequirement(req.key)}
                    disabled={requirements.length <= 1}
                    size="small"
                    className="mt-1"
                  />
                </div>
              ))}
            </div>
          </div>
        </Form>
      </Drawer>

      {/* ── F2 Preview Drawer ─────────────────────────────────────────────── */}
      <JobTemplatePreviewDrawer
        open={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        templateId={previewTemplateId}
        templateData={previewDraftData}
        footer={
          <div className="flex justify-end px-2 py-1">
            <Button onClick={() => setIsPreviewOpen(false)}>Đóng</Button>
          </div>
        }
      />
    </div>
  );
};
