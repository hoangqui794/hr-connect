/**
 * @file WizardStep1ServiceType.tsx
 * Step 1 of CreateJobWizard (MF-01 | SCR-CLI-01).
 * Service Type radio cards + full Job Details form.
 * All inputs are wired to Ant Design Form so validation flows through
 * the parent wizard's form.validateFields() call before advancing.
 */
import React from 'react';
import {
  Form, Input, Select, InputNumber, Switch, DatePicker,
  Row, Col, Card, Typography, Tag, Space, Divider,
} from 'antd';
import { EnvironmentOutlined, TeamOutlined, CheckCircleFilled } from '@ant-design/icons';
import { TreeSelect } from 'antd';
import type { FormInstance } from 'antd';
import { ServiceType, SERVICE_TYPE_LABELS, SERVICE_TYPE_DESCRIPTIONS } from '@/types/job';
import { LINKEDIN_INDUSTRIES } from '@/constants/industries';
import dayjs from 'dayjs';

const { Text, Title } = Typography;

const SERVICE_META: Record<
  ServiceType,
  { emoji: string; accentColor: string; badge: string; features: string[] }
> = {
  [ServiceType.HEADHUNT_COD]: {
    emoji: '🎯',
    accentColor: '#0284c7',
    badge: 'Trọn gói',
    features: [
      'Tuyển dụng toàn diện qua mạng lưới cộng tác viên (Headhunter)',
      'Cam kết bảo hành thử việc 60 ngày',
      'Chỉ trả phí hoa hồng khi ứng viên nhận việc thành công',
      'Sàng lọc AI kết hợp điều phối phỏng vấn chuyên nghiệp',
    ],
  },
  [ServiceType.CV_SOURCING]: {
    emoji: '📋',
    accentColor: '#10b981',
    badge: 'Cung cấp hồ sơ',
    features: [
      'Nhận hồ sơ ứng viên chất lượng cao đã qua sàng lọc AI',
      'Doanh nghiệp chủ động liên hệ và phỏng vấn',
      'Chi phí hoa hồng hồ sơ tối ưu, tiết kiệm ngân sách',
      'Không áp dụng chính sách bảo hành thử việc',
    ],
  },
  [ServiceType.CV_APPLICATION]: {
    emoji: '📢',
    accentColor: '#8b5cf6',
    badge: 'Tự phục vụ',
    features: [
      'Đăng tin mở — ứng viên chủ động nộp hồ sơ',
      'Không mất phí hoa hồng cho cộng tác viên',
      'Hệ thống AI tự động chấm điểm hồ sơ ứng tuyển',
      'Phù hợp cho các vị trí tuyển dụng tiêu chuẩn số lượng lớn',
    ],
  },
};

interface ServiceTypeCardProps {
  type: ServiceType;
  isSelected: boolean;
  onSelect: (type: ServiceType) => void;
}

const ServiceTypeCard: React.FC<ServiceTypeCardProps> = ({ type, isSelected, onSelect }) => {
  const meta = SERVICE_META[type];

  return (
    <div
      role="radio"
      aria-checked={isSelected}
      tabIndex={0}
      onClick={() => onSelect(type)}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onSelect(type)}
      style={{
        border: `2px solid ${isSelected ? meta.accentColor : '#e2e8f0'}`,
        borderRadius: 14,
        padding: '18px 16px',
        cursor: 'pointer',
        background: isSelected ? `${meta.accentColor}0d` : '#fff',
        transition: 'all 0.22s ease',
        boxShadow: isSelected
          ? `0 4px 20px ${meta.accentColor}28`
          : '0 1px 4px rgba(0,0,0,0.04)',
        height: '100%',
        position: 'relative',
        outline: 'none',
      }}
      onMouseEnter={(e) => {
        if (!isSelected) {
          e.currentTarget.style.borderColor = '#94a3b8';
          e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)';
        }
      }}
      onMouseLeave={(e) => {
        if (!isSelected) {
          e.currentTarget.style.borderColor = '#e2e8f0';
          e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.04)';
        }
      }}
    >
      {isSelected && (
        <CheckCircleFilled
          style={{ position: 'absolute', top: 12, right: 12, color: meta.accentColor, fontSize: 18 }}
        />
      )}
      <Space align="center" style={{ marginBottom: 10 }}>
        <span style={{ fontSize: 26, lineHeight: 1 }}>{meta.emoji}</span>
        <Tag
          style={{
            background: isSelected ? meta.accentColor : '#f1f5f9',
            color: isSelected ? '#fff' : '#64748b',
            border: 'none',
            fontWeight: 700,
            fontSize: 10,
            letterSpacing: '0.05em',
            borderRadius: 6,
          }}
        >
          {meta.badge.toUpperCase()}
        </Tag>
      </Space>
      <div
        style={{
          fontWeight: 800,
          fontSize: 14,
          color: isSelected ? meta.accentColor : '#0f172a',
          marginBottom: 6,
          letterSpacing: '-0.2px',
        }}
      >
        {SERVICE_TYPE_LABELS[type]}
      </div>
      <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.55, marginBottom: 12 }}>
        {SERVICE_TYPE_DESCRIPTIONS[type]}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {meta.features.map((f) => (
          <div key={f} style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
            <span style={{ color: meta.accentColor, fontSize: 11, marginTop: 2, flexShrink: 0 }}>✓</span>
            <span style={{ fontSize: 11, color: '#475569', lineHeight: 1.45 }}>{f}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export interface WizardStep1Props {
  form: FormInstance;
  serviceType: ServiceType | null;
  onServiceTypeChange: (type: ServiceType) => void;
}

export const WizardStep1ServiceType: React.FC<WizardStep1Props> = ({
  form: _form,
  serviceType,
  onServiceTypeChange,
}) => (
  <div style={{ maxWidth: 780 }}>
    {/* ── Service Type ── */}
    <Title level={5} style={{ margin: '0 0 4px', color: '#0f172a' }}>
      Hình thức dịch vụ <span style={{ color: '#ef4444' }}>*</span>
    </Title>
    <Text type="secondary" style={{ fontSize: 13, display: 'block', marginBottom: 16 }}>
      Chọn mô hình dịch vụ phù hợp với chiến lược tuyển dụng của doanh nghiệp.
    </Text>
    <Row gutter={[14, 14]}>
      {Object.values(ServiceType).map((t) => (
        <Col xs={24} sm={8} key={t} style={{ display: 'flex' }}>
          <ServiceTypeCard type={t} isSelected={serviceType === t} onSelect={onServiceTypeChange} />
        </Col>
      ))}
    </Row>
    {/* Invisible hidden Form.Item — receives value via form.setFieldValue so validation fires */}
    <Form.Item
      name="serviceType"
      noStyle
      rules={[{ required: true, message: 'Vui lòng chọn hình thức dịch vụ để tiếp tục.' }]}
    >
      <input type="hidden" aria-hidden="true" />
    </Form.Item>

    <Divider style={{ margin: '24px 0' }} />

    {/* ── Job Details ── */}
    <Title level={5} style={{ margin: '0 0 16px', color: '#0f172a' }}>
      Thông tin chi tiết vị trí
    </Title>
    <Row gutter={[16, 0]}>
      <Col span={24}>
        <Form.Item
          label="Chức danh tuyển dụng"
          name="title"
          rules={[
            { required: true, message: 'Vui lòng nhập chức danh tuyển dụng.' },
            { min: 5, message: 'Chức danh phải có ít nhất 5 ký tự.' },
            { max: 120, message: 'Chức danh không được vượt quá 120 ký tự.' },
          ]}
        >
          <Input size="large" placeholder="Ví dụ: Kỹ sư Backend Java Senior" maxLength={120} showCount />
        </Form.Item>
      </Col>

      <Col xs={24} sm={12}>
        <Form.Item
          label="Tên doanh nghiệp / Công ty"
          name="company"
          rules={[{ required: true, message: 'Vui lòng nhập tên công ty tuyển dụng.' }]}
        >
          <Input placeholder="Ví dụ: TechCorp Vietnam" />
        </Form.Item>
      </Col>

      <Col xs={24} sm={12}>
        <Form.Item label="Ngành nghề" name="industryCode">
          <TreeSelect
            treeData={LINKEDIN_INDUSTRIES}
            placeholder="Chọn ngành nghề phù hợp"
            showSearch
            filterTreeNode={(search, node) =>
              String(node.title ?? '').toLowerCase().includes(search.toLowerCase())
            }
            treeDefaultExpandAll={false}
            style={{ width: '100%' }}
          />
        </Form.Item>
      </Col>

      <Col xs={24} sm={16}>
        <Form.Item
          label="Địa điểm làm việc"
          name="location"
          rules={[{ required: true, message: 'Vui lòng nhập địa điểm làm việc.' }]}
        >
          <Input prefix={<EnvironmentOutlined style={{ color: '#94a3b8' }} />} placeholder="Ví dụ: TP. Hồ Chí Minh, Việt Nam" />
        </Form.Item>
      </Col>

      <Col xs={24} sm={8}>
        <Form.Item label="Hình thức làm việc" name="remote" valuePropName="checked">
          <Switch checkedChildren="Từ xa / Hybrid" unCheckedChildren="Tại văn phòng" />
        </Form.Item>
      </Col>

      <Col xs={24} sm={8}>
        <Form.Item
          label="Số lượng cần tuyển"
          name="headcount"
          rules={[{ required: true, type: 'number', min: 1, message: 'Cần tuyển ít nhất 1 người.' }]}
        >
          <InputNumber min={1} max={100} prefix={<TeamOutlined style={{ color: '#94a3b8' }} />} style={{ width: '100%' }} />
        </Form.Item>
      </Col>

      <Col xs={24} sm={8}>
        <Form.Item
          label="Kinh nghiệm tối thiểu (năm)"
          name="experienceMin"
          rules={[{ required: true, type: 'number', min: 0, message: 'Bắt buộc nhập.' }]}
        >
          <InputNumber min={0} max={20} style={{ width: '100%' }} />
        </Form.Item>
      </Col>

      <Col xs={24} sm={8}>
        <Form.Item
          label="Kinh nghiệm tối đa (năm)"
          name="experienceMax"
          dependencies={['experienceMin']}
          rules={[
            { required: true, type: 'number', min: 0, message: 'Bắt buộc nhập.' },
            ({ getFieldValue }) => ({
              validator(_, value: number) {
                if (!value || getFieldValue('experienceMin') <= value) return Promise.resolve();
                return Promise.reject(new Error('Kinh nghiệm tối đa phải >= tối thiểu'));
              },
            }),
          ]}
        >
          <InputNumber min={0} max={40} style={{ width: '100%' }} />
        </Form.Item>
      </Col>

      {/* Salary Range */}
      <Col span={24}>
        <Card size="small" style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, marginBottom: 4 }}>
          <Text style={{ fontWeight: 600, fontSize: 13, color: '#0f172a', display: 'block', marginBottom: 12 }}>
            Khoảng mức lương
          </Text>
          <Row gutter={[12, 0]}>
            <Col xs={24} sm={5}>
              <Form.Item label="Tiền tệ" name="currency" style={{ marginBottom: 0 }}>
                <Select options={[{ value: 'VND', label: 'VND (₫)' }, { value: 'USD', label: 'USD ($)' }, { value: 'SGD', label: 'SGD (S$)' }]} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={7}>
              <Form.Item
                label="Lương tối thiểu"
                name="salaryMin"
                rules={[{ required: true, type: 'number', min: 0, message: 'Bắt buộc nhập.' }]}
                style={{ marginBottom: 0 }}
              >
                <InputNumber min={0} style={{ width: '100%' }} formatter={(v) => `${v ?? ''}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item
                label="Lương tối đa"
                name="salaryMax"
                dependencies={['salaryMin']}
                rules={[
                  { required: true, type: 'number', min: 0, message: 'Bắt buộc nhập.' },
                  ({ getFieldValue }) => ({
                    validator(_, value: number) {
                      if (!value || getFieldValue('salaryMin') <= value) return Promise.resolve();
                      return Promise.reject(new Error('Lương tối đa phải >= tối thiểu'));
                    },
                  }),
                ]}
                style={{ marginBottom: 0 }}
              >
                <InputNumber min={0} style={{ width: '100%' }} formatter={(v) => `${v ?? ''}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} />
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
            placeholder="Chọn ngày hết hạn (tùy chọn)"
          />
        </Form.Item>
      </Col>
    </Row>
  </div>
);
