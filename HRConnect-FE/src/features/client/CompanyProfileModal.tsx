/**
 * @file CompanyProfileModal.tsx
 * @description Modal & Form settings for Client Company Profile (A-04):
 * 1. GET /api/v1/companies/profile/me
 * 2. PUT /api/v1/companies/profile/me (UpdateCompanyProfileCommand)
 */

import React, { useEffect } from 'react';
import {
  Modal,
  Form,
  Input,
  Button,
  Row,
  Col,
  Tag,
  Divider,
  Spin,
  Alert,
  message,
  Select,
} from 'antd';
import {
  ShopOutlined,
  CheckCircleOutlined,
  GlobalOutlined,
  EnvironmentOutlined,
  InfoCircleOutlined,
  SafetyCertificateOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import {
  useCompanyProfile,
  useUpdateCompanyProfile,
} from '@/services/queries/useProfiles';
import type { UpdateCompanyProfileCommand } from '@/types/profile';

interface CompanyProfileModalProps {
  open: boolean;
  onClose: () => void;
}

export const CompanyProfileModal: React.FC<CompanyProfileModalProps> = ({
  open,
  onClose,
}) => {
  const [form] = Form.useForm<UpdateCompanyProfileCommand>();

  const { data: company, isLoading } = useCompanyProfile();
  const updateCompanyMutation = useUpdateCompanyProfile();

  useEffect(() => {
    if (company) {
      form.setFieldsValue({
        companyName: company.companyName ?? '',
        taxCode: company.taxCode ?? '',
        industry: company.industry ?? '',
        companySize: company.companySize ?? '',
        website: company.website ?? '',
        address: company.address ?? '',
        description: company.description ?? '',
      });
    }
  }, [company, form]);

  const handleSave = async (values: UpdateCompanyProfileCommand) => {
    try {
      await updateCompanyMutation.mutateAsync({
        companyName: values.companyName?.trim() || null,
        taxCode: values.taxCode?.trim() || null,
        industry: values.industry?.trim() || null,
        companySize: values.companySize || null,
        website: values.website?.trim() || null,
        address: values.address?.trim() || null,
        description: values.description?.trim() || null,
      });
      message.success('Cập nhật hồ sơ doanh nghiệp thành công!');
    } catch {
      message.error('Không thể cập nhật hồ sơ doanh nghiệp. Vui lòng thử lại!');
    }
  };

  const isVerified = company?.verificationStatus === 'VERIFIED';

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width={760}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 6 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: '#eff6ff',
              color: '#2563eb',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 18,
            }}
          >
            <ShopOutlined />
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a' }}>
              Hồ sơ & Thông tin Doanh nghiệp Tuyển dụng (A-04)
            </div>
            <div style={{ fontSize: 12, color: '#64748b' }}>
              Quản lý pháp nhân công ty, mã số thuế và thông tin giới thiệu thu hút nhân tài.
            </div>
          </div>
        </div>
      }
      styles={{ body: { maxHeight: '80vh', overflowY: 'auto', paddingRight: 4 } }}
      centered
      destroyOnClose={false}
    >
      <Spin spinning={isLoading}>
        {/* Verification Status Header Banner */}
        <div
          style={{
            background: isVerified ? '#f0fdf4' : '#f8fafc',
            border: isVerified ? '1px solid #bbf7d0' : '1px solid #e2e8f0',
            borderRadius: 12,
            padding: '14px 18px',
            marginBottom: 20,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Tag
              color={isVerified ? 'success' : 'warning'}
              icon={isVerified ? <CheckCircleOutlined /> : <SafetyCertificateOutlined />}
              style={{ fontWeight: 700, fontSize: 12, borderRadius: 6, padding: '2px 8px' }}
            >
              {isVerified ? 'DOANH NGHIỆP ĐÃ XÁC THỰC' : 'ĐANG CHỜ XÁC THỰC PHÁP NHÂN'}
            </Tag>
            {company?.taxCode && (
              <span style={{ fontSize: 12, color: '#475569', fontWeight: 600 }}>
                MST: {company.taxCode}
              </span>
            )}
          </div>
          <div style={{ fontSize: 12, color: '#64748b' }}>
            Vai trò: <strong>{company?.roleInCompany || 'Đại diện tuyển dụng'}</strong>
            {company?.isPrimaryContact && (
              <Tag color="blue" style={{ marginLeft: 6, borderRadius: 4, fontSize: 11 }}>
                Liên hệ chính
              </Tag>
            )}
          </div>
        </div>

        <Form
          form={form}
          layout="vertical"
          onFinish={handleSave}
          requiredMark="optional"
        >
          <Row gutter={[16, 12]}>
            <Col xs={24} sm={14}>
              <Form.Item
                name="companyName"
                label={<span style={{ fontWeight: 600, fontSize: 13, color: '#334155' }}>Tên doanh nghiệp / Pháp nhân <span style={{ color: '#ef4444' }}>*</span></span>}
                rules={[{ required: true, message: 'Vui lòng nhập tên công ty' }]}
              >
                <Input
                  placeholder="VD: Blata33 Technology JSC"
                  size="large"
                  style={{ borderRadius: 10 }}
                  prefix={<ShopOutlined style={{ color: '#94a3b8' }} />}
                />
              </Form.Item>
            </Col>

            <Col xs={24} sm={10}>
              <Form.Item
                name="taxCode"
                label={<span style={{ fontWeight: 600, fontSize: 13, color: '#334155' }}>Mã số thuế doanh nghiệp <span style={{ color: '#ef4444' }}>*</span></span>}
                rules={[{ required: true, message: 'Vui lòng nhập mã số thuế' }]}
              >
                <Input
                  placeholder="VD: 0316789123"
                  size="large"
                  style={{ borderRadius: 10, letterSpacing: '0.04em', fontWeight: 600 }}
                />
              </Form.Item>
            </Col>

            <Col xs={24} sm={14}>
              <Form.Item
                name="industry"
                label={<span style={{ fontWeight: 600, fontSize: 13, color: '#334155' }}>Lĩnh vực hoạt động chính</span>}
              >
                <Input
                  placeholder="VD: Công nghệ thông tin & Dịch vụ Phần mềm"
                  size="large"
                  style={{ borderRadius: 10 }}
                />
              </Form.Item>
            </Col>

            <Col xs={24} sm={10}>
              <Form.Item
                name="companySize"
                label={<span style={{ fontWeight: 600, fontSize: 13, color: '#334155' }}>Quy mô nhân sự</span>}
              >
                <Select size="large" style={{ borderRadius: 10 }}>
                  <Select.Option value="Dưới 20 nhân sự">Dưới 20 nhân sự</Select.Option>
                  <Select.Option value="20-50 nhân sự">20-50 nhân sự</Select.Option>
                  <Select.Option value="50-100 nhân sự">50-100 nhân sự</Select.Option>
                  <Select.Option value="100-500 nhân sự">100-500 nhân sự</Select.Option>
                  <Select.Option value="500-1000 nhân sự">500-1000 nhân sự</Select.Option>
                  <Select.Option value="Trên 1000 nhân sự">Trên 1000 nhân sự</Select.Option>
                </Select>
              </Form.Item>
            </Col>

            <Col xs={24}>
              <Form.Item
                name="website"
                label={<span style={{ fontWeight: 600, fontSize: 13, color: '#334155' }}>Địa chỉ Website</span>}
              >
                <Input
                  placeholder="VD: https://blata33.vn"
                  size="large"
                  style={{ borderRadius: 10 }}
                  prefix={<GlobalOutlined style={{ color: '#94a3b8' }} />}
                />
              </Form.Item>
            </Col>

            <Col xs={24}>
              <Form.Item
                name="address"
                label={<span style={{ fontWeight: 600, fontSize: 13, color: '#334155' }}>Trụ sở chính / Địa chỉ làm việc</span>}
              >
                <Input
                  placeholder="VD: Tòa nhà Bitexco Financial Tower, Q.1, TP. Hồ Chí Minh"
                  size="large"
                  style={{ borderRadius: 10 }}
                  prefix={<EnvironmentOutlined style={{ color: '#94a3b8' }} />}
                />
              </Form.Item>
            </Col>

            <Col xs={24}>
              <Form.Item
                name="description"
                label={<span style={{ fontWeight: 600, fontSize: 13, color: '#334155' }}>Giới thiệu về doanh nghiệp & Văn hóa làm việc</span>}
              >
                <Input.TextArea
                  rows={4}
                  placeholder="Giới thiệu tầm nhìn, sản phẩm dịch vụ cốt lõi, môi trường làm việc..."
                  style={{ borderRadius: 10, padding: '10px 12px' }}
                />
              </Form.Item>
            </Col>
          </Row>

          <Divider style={{ margin: '12px 0 16px' }} />

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <Button onClick={onClose} style={{ borderRadius: 10, fontWeight: 600 }}>
              Đóng
            </Button>
            <Button
              type="primary"
              htmlType="submit"
              loading={updateCompanyMutation.isPending}
              style={{
                borderRadius: 10,
                fontWeight: 700,
                background: '#2563eb',
                boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)',
              }}
            >
              Lưu thay đổi hồ sơ doanh nghiệp
            </Button>
          </div>
        </Form>
      </Spin>
    </Modal>
  );
};

export default CompanyProfileModal;
