import React from 'react';
import { Form, Input, Select, InputNumber, Switch, DatePicker, Row, Col, Card, Typography, Tag } from 'antd';
import { EnvironmentOutlined, TeamOutlined } from '@ant-design/icons';
import { TreeSelect } from 'antd';
import { ServiceType, SERVICE_TYPE_LABELS, SERVICE_TYPE_DESCRIPTIONS } from '@/types/job';
import { useJobStore } from '@/stores/jobStore';
import { LINKEDIN_INDUSTRIES } from '@/constants/industries';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

const SERVICE_TYPE_ICONS: Record<ServiceType, string> = {
  [ServiceType.HEADHUNT_COD]: '🎯',
  [ServiceType.CV_SOURCING]: '📋',
  [ServiceType.CV_APPLICATION]: '📢',
};

const SERVICE_TYPE_COLORS: Record<ServiceType, string> = {
  [ServiceType.HEADHUNT_COD]: '#0284c7',
  [ServiceType.CV_SOURCING]: '#10b981',
  [ServiceType.CV_APPLICATION]: '#8b5cf6',
};

export const Step1Details: React.FC = () => {
  const { draft, updateStep1 } = useJobStore();
  const [form] = Form.useForm();

  const handleChange = (changed: Record<string, unknown>) => {
    updateStep1(changed as Parameters<typeof updateStep1>[0]);
  };

  return (
    <Form
      form={form}
      layout="vertical"
      initialValues={draft.step1}
      onValuesChange={handleChange}
      style={{ maxWidth: 720 }}
    >
      {/* Service Type Selection */}
      <div style={{ marginBottom: 28 }}>
        <Title level={5} style={{ marginBottom: 4, color: '#0f172a' }}>
          Hình thức dịch vụ <span style={{ color: '#ef4444' }}>*</span>
        </Title>
        <Text type="secondary" style={{ fontSize: 13, display: 'block', marginBottom: 12 }}>
          Chọn phương thức hợp tác cùng HR Connect
        </Text>
        <Row gutter={[12, 12]}>
          {Object.values(ServiceType).map((type) => {
            const isSelected = draft.step1.serviceType === type;
            return (
              <Col xs={24} sm={8} key={type}>
                <div
                  onClick={() => updateStep1({ serviceType: type })}
                  style={{
                    border: `2px solid ${isSelected ? SERVICE_TYPE_COLORS[type] : '#e2e8f0'}`,
                    borderRadius: 12,
                    padding: '16px',
                    cursor: 'pointer',
                    background: isSelected ? `${SERVICE_TYPE_COLORS[type]}08` : '#fff',
                    transition: 'all 0.2s',
                    boxShadow: isSelected ? `0 4px 14px ${SERVICE_TYPE_COLORS[type]}25` : 'none',
                    height: '100%',
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) e.currentTarget.style.borderColor = '#cbd5e1';
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) e.currentTarget.style.borderColor = '#e2e8f0';
                  }}
                >
                  <div style={{ fontSize: 24, marginBottom: 8 }}>{SERVICE_TYPE_ICONS[type]}</div>
                  <div
                    style={{
                      fontWeight: 700,
                      fontSize: 13,
                      color: isSelected ? SERVICE_TYPE_COLORS[type] : '#0f172a',
                      marginBottom: 6,
                    }}
                  >
                    {SERVICE_TYPE_LABELS[type]}
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.5 }}>
                    {SERVICE_TYPE_DESCRIPTIONS[type]}
                  </div>
                  {isSelected && (
                    <Tag
                      style={{
                        marginTop: 10,
                        background: SERVICE_TYPE_COLORS[type],
                        color: '#fff',
                        border: 'none',
                        borderRadius: 6,
                        fontSize: 11,
                        fontWeight: 600,
                      }}
                    >
                      ✓ Đã chọn
                    </Tag>
                  )}
                </div>
              </Col>
            );
          })}
        </Row>
      </div>

      {/* Job Details */}
      <Row gutter={[16, 0]}>
        <Col span={24}>
          <Form.Item label="Chức danh tuyển dụng" name="title" rules={[{ required: true, message: 'Vui lòng nhập chức danh' }]}>
            <Input placeholder="Ví dụ: Kỹ sư Backend Java Senior" size="large" />
          </Form.Item>
        </Col>
        <Col xs={24} sm={12}>
          <Form.Item label="Tên công ty" name="company" rules={[{ required: true, message: 'Vui lòng nhập tên công ty' }]}>
            <Input placeholder="Ví dụ: TechCorp Vietnam" />
          </Form.Item>
        </Col>
        <Col xs={24} sm={12}>
          <Form.Item label="Ngành nghề" name="industryCode">
            <TreeSelect
              treeData={LINKEDIN_INDUSTRIES}
              placeholder="Chọn ngành nghề"
              showSearch
              filterTreeNode={(search, node) =>
                String(node.title ?? '').toLowerCase().includes(search.toLowerCase())
              }
              treeDefaultExpandAll={false}
            />
          </Form.Item>
        </Col>
        <Col xs={24} sm={16}>
          <Form.Item label="Địa điểm" name="location">
            <Input prefix={<EnvironmentOutlined style={{ color: '#94a3b8' }} />} placeholder="Ví dụ: TP. Hồ Chí Minh, Việt Nam" />
          </Form.Item>
        </Col>
        <Col xs={24} sm={8}>
          <Form.Item label="Làm việc từ xa" name="remote" valuePropName="checked">
            <Switch checkedChildren="Từ xa / Hybrid" unCheckedChildren="Tại văn phòng" />
          </Form.Item>
        </Col>
        <Col xs={24} sm={8}>
          <Form.Item label="Số lượng cần tuyển" name="headcount">
            <InputNumber min={1} max={50} prefix={<TeamOutlined style={{ color: '#94a3b8' }} />} style={{ width: '100%' }} />
          </Form.Item>
        </Col>
        <Col xs={24} sm={8}>
          <Form.Item label="Kinh nghiệm tối thiểu (năm)" name="experienceMin">
            <InputNumber min={0} max={20} style={{ width: '100%' }} />
          </Form.Item>
        </Col>
        <Col xs={24} sm={8}>
          <Form.Item label="Kinh nghiệm tối đa (năm)" name="experienceMax">
            <InputNumber min={0} max={30} style={{ width: '100%' }} />
          </Form.Item>
        </Col>

        {/* Salary Range */}
        <Col span={24}>
          <Card size="small" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
            <Text style={{ fontWeight: 600, fontSize: 13, color: '#0f172a' }}>Khoảng mức lương</Text>
            <Row gutter={[12, 0]} style={{ marginTop: 12 }}>
              <Col xs={24} sm={6}>
                <Form.Item label="Tiền tệ" name="currency" style={{ marginBottom: 0 }}>
                  <Select options={[{ value: 'VND', label: 'VND (₫)' }, { value: 'USD', label: 'USD ($)' }, { value: 'SGD', label: 'SGD (S$)' }]} />
                </Form.Item>
              </Col>
              <Col xs={24} sm={7}>
                <Form.Item label="Lương tối thiểu" name="salaryMin" style={{ marginBottom: 0 }}>
                  <InputNumber min={0} style={{ width: '100%' }} formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} />
                </Form.Item>
              </Col>
              <Col xs={24} sm={7}>
                <Form.Item label="Lương tối đa" name="salaryMax" style={{ marginBottom: 0 }}>
                  <InputNumber min={0} style={{ width: '100%' }} formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} />
                </Form.Item>
              </Col>
              <Col xs={24} sm={4}>
                <Form.Item label="Thỏa thuận" name="negotiable" valuePropName="checked" style={{ marginBottom: 0 }}>
                  <Switch size="small" />
                </Form.Item>
              </Col>
            </Row>
          </Card>
        </Col>

        <Col xs={24} sm={12}>
          <Form.Item label="Hạn chót nộp hồ sơ" name="deadline" style={{ marginTop: 12 }}>
            <DatePicker
              style={{ width: '100%' }}
              disabledDate={(d) => d && d < dayjs().startOf('day')}
              placeholder="Chọn ngày hết hạn"
            />
          </Form.Item>
        </Col>
      </Row>
    </Form>
  );
};
