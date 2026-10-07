/**
 * @file CompanyProfileSettingsPage.tsx
 * @description Standalone page for Client Company Profile & Settings (A-04).
 * Integrates:
 * 1. GET /api/v1/companies/profile/me
 * 2. PUT /api/v1/companies/profile/me (UpdateCompanyProfileCommand)
 */

import React, { useEffect } from 'react';
import {
  Card,
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
  SafetyCertificateOutlined,
} from '@ant-design/icons';
import {
  useCompanyProfile,
  useUpdateCompanyProfile,
} from '@/services/queries/useProfiles';
import type { UpdateCompanyProfileCommand } from '@/types/profile';
import { PageHeaderB2B } from '@/components/common/PageHeaderB2B';

export const CompanyProfileSettingsPage: React.FC = () => {
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
    <div className="space-y-6" style={{ maxWidth: 1100, margin: '0 auto', paddingBottom: 40 }}>
      <PageHeaderB2B
        title="Hồ Sơ & Thông Tin Doanh Nghiệp (A-04)"
        badge={
          <div className="flex items-center gap-2">
            <Tag
              color={isVerified ? 'success' : 'warning'}
              icon={isVerified ? <CheckCircleOutlined /> : <SafetyCertificateOutlined />}
              style={{ fontWeight: 700, borderRadius: 6, margin: 0 }}
            >
              {isVerified ? 'DOANH NGHIỆP ĐÃ XÁC THỰC' : 'CHỜ XÁC THỰC PHÁP NHÂN'}
            </Tag>
            {company?.taxCode && (
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                MST: {company.taxCode}
              </span>
            )}
          </div>
        }
        subtitle="Quản lý thông tin pháp nhân doanh nghiệp, mã số thuế, địa chỉ trụ sở và hồ sơ giới thiệu công ty."
      />

      <Card
        bordered={false}
        style={{
          borderRadius: 20,
          border: '1px solid #e2e8f0',
          boxShadow: '0 4px 20px -2px rgba(0, 0, 0, 0.04)',
        }}
      >
        <Spin spinning={isLoading}>
          <div style={{ paddingTop: 8 }}>
            <Alert
              type={isVerified ? 'success' : 'info'}
              showIcon
              icon={isVerified ? <CheckCircleOutlined /> : <SafetyCertificateOutlined />}
              message={
                isVerified
                  ? 'Pháp nhân doanh nghiệp đã được xác thực bởi HRConnect Platform Admin'
                  : 'Hồ sơ doanh nghiệp đang chờ đối soát pháp nhân'
              }
              description={
                isVerified
                  ? `Xác minh thành công vào ngày: ${company?.verifiedAt ? new Date(company.verifiedAt).toLocaleDateString('vi-VN') : '2026-02-14'}. Tin tuyển dụng của bạn được ưu tiên gắn nhãn Đã Xác Thực.`
                  : 'Vui lòng điền chính xác Tên pháp nhân và Mã số thuế để bộ phận kiểm duyệt hoàn tất xác thực trong 24 giờ làm việc.'
              }
              style={{ marginBottom: 24, borderRadius: 14 }}
            />

            <Form
              form={form}
              layout="vertical"
              onFinish={handleSave}
              requiredMark="optional"
            >
              <Row gutter={[20, 16]}>
                <Col xs={24} md={14}>
                  <Form.Item
                    name="companyName"
                    label={<span style={{ fontWeight: 600, fontSize: 13, color: '#334155' }}>Tên pháp nhân công ty <span style={{ color: '#ef4444' }}>*</span></span>}
                    rules={[{ required: true, message: 'Vui lòng nhập tên công ty' }]}
                  >
                    <Input
                      size="large"
                      placeholder="VD: Blata33 Technology JSC"
                      style={{ borderRadius: 12 }}
                      prefix={<ShopOutlined style={{ color: '#94a3b8' }} />}
                    />
                  </Form.Item>
                </Col>

                <Col xs={24} md={10}>
                  <Form.Item
                    name="taxCode"
                    label={<span style={{ fontWeight: 600, fontSize: 13, color: '#334155' }}>Mã số thuế doanh nghiệp <span style={{ color: '#ef4444' }}>*</span></span>}
                    rules={[{ required: true, message: 'Vui lòng nhập mã số thuế' }]}
                  >
                    <Input
                      size="large"
                      placeholder="VD: 0316789123"
                      style={{ borderRadius: 12, letterSpacing: '0.04em', fontWeight: 700 }}
                    />
                  </Form.Item>
                </Col>

                <Col xs={24} md={14}>
                  <Form.Item
                    name="industry"
                    label={<span style={{ fontWeight: 600, fontSize: 13, color: '#334155' }}>Lĩnh vực kinh doanh / Ngành nghề</span>}
                  >
                    <Input
                      size="large"
                      placeholder="VD: Công nghệ thông tin & Dịch vụ Phần mềm"
                      style={{ borderRadius: 12 }}
                    />
                  </Form.Item>
                </Col>

                <Col xs={24} md={10}>
                  <Form.Item
                    name="companySize"
                    label={<span style={{ fontWeight: 600, fontSize: 13, color: '#334155' }}>Quy mô nhân sự</span>}
                  >
                    <Select size="large" style={{ borderRadius: 12 }}>
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
                    label={<span style={{ fontWeight: 600, fontSize: 13, color: '#334155' }}>Website chính thức</span>}
                  >
                    <Input
                      size="large"
                      placeholder="VD: https://blata33.vn"
                      style={{ borderRadius: 12 }}
                      prefix={<GlobalOutlined style={{ color: '#94a3b8' }} />}
                    />
                  </Form.Item>
                </Col>

                <Col xs={24}>
                  <Form.Item
                    name="address"
                    label={<span style={{ fontWeight: 600, fontSize: 13, color: '#334155' }}>Trụ sở chính / Địa chỉ văn phòng</span>}
                  >
                    <Input
                      size="large"
                      placeholder="VD: Tòa nhà Bitexco Financial Tower, Q.1, TP. Hồ Chí Minh"
                      style={{ borderRadius: 12 }}
                      prefix={<EnvironmentOutlined style={{ color: '#94a3b8' }} />}
                    />
                  </Form.Item>
                </Col>

                <Col xs={24}>
                  <Form.Item
                    name="description"
                    label={<span style={{ fontWeight: 600, fontSize: 13, color: '#334155' }}>Giới thiệu văn hóa & Tổng quan doanh nghiệp</span>}
                  >
                    <Input.TextArea
                      rows={5}
                      placeholder="Giới thiệu tầm nhìn, sản phẩm dịch vụ cốt lõi, môi trường làm việc..."
                      style={{ borderRadius: 12, padding: '12px 14px' }}
                    />
                  </Form.Item>
                </Col>
              </Row>

              <div style={{ paddingTop: 8 }}>
                <Button
                  type="primary"
                  size="large"
                  htmlType="submit"
                  loading={updateCompanyMutation.isPending}
                  style={{
                    borderRadius: 9999,
                    fontWeight: 700,
                    padding: '0 36px',
                    background: '#2563eb',
                    boxShadow: '0 4px 14px rgba(37, 99, 235, 0.25)',
                  }}
                >
                  Lưu thay đổi hồ sơ doanh nghiệp
                </Button>
              </div>
            </Form>
          </div>
        </Spin>
      </Card>
    </div>
  );
};

export default CompanyProfileSettingsPage;
