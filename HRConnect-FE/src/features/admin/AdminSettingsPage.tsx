import React, { useState } from 'react';
import {
  Card, Typography, Space, Button, InputNumber, Switch,
  Row, Col, Form, message, Alert, Divider,
} from 'antd';
import {
  SettingOutlined, SaveOutlined, UndoOutlined,
  PercentageOutlined, ClockCircleOutlined, RobotOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;

export const AdminSettingsPage: React.FC = () => {
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);

  const initialValues = {
    affiliateCommissionRate: 80,
    platformFeeRate: 20,
    warrantyDurationDays: 60,
    disputeWindowHours: 72,
    aiScreeningThreshold: 75,
    autoDuplicateBlock: true,
    enablePayoutAutoApproval: false,
    minPayoutThresholdVND: 1000000,
  };

  const handleFinish = (values: typeof initialValues) => {
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      message.success('Đã lưu cấu hình dịch vụ và quy tắc hoa hồng hệ thống thành công!');
    }, 600);
  };

  const handleReset = () => {
    form.setFieldsValue(initialValues);
    message.info('Đã khôi phục các tham số mặc định theo tiêu chuẩn SDD/SRS.');
  };

  return (
    <div style={{ padding: '0 4px', maxWidth: 1000 }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <Title level={3} style={{ margin: 0, color: '#0f172a' }}>
          <SettingOutlined style={{ color: '#0284c7', marginRight: 10 }} />
          Cấu hình Dịch vụ & Quy tắc Hoa hồng Nền tảng
        </Title>
        <Text type="secondary" style={{ fontSize: 13 }}>
          Thiết lập các tham số vận hành toàn hệ thống: tỷ lệ hoa hồng CTV, thời gian bảo hành ứng viên, cửa sổ khiếu nại tranh chấp và tiêu chuẩn sàng lọc AI.
        </Text>
      </div>

      <Form
        form={form}
        layout="vertical"
        initialValues={initialValues}
        onFinish={handleFinish}
      >
        {/* Section 1: Commission & Financial Rules */}
        <Card
          title={
            <Space>
              <PercentageOutlined style={{ color: '#059669' }} />
              <span>Quy tắc Phân chia Hoa hồng & Phí Dịch vụ (Revenue Sharing)</span>
            </Space>
          }
          style={{
            borderRadius: 12,
            marginBottom: 20,
            border: '1px solid #e2e8f0',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          }}
        >
          <Alert
            type="info"
            showIcon
            message="Công thức chuẩn COD: Tổng phí tuyển dụng = 100%"
            description="Tỷ lệ chia sẻ hoa hồng cho CTV giới thiệu và tỷ lệ giữ lại của sàn HRConnect được áp dụng mặc định cho tất cả tin tuyển dụng gói COD."
            style={{ marginBottom: 20, borderRadius: 8 }}
          />

          <Row gutter={[24, 16]}>
            <Col xs={24} sm={12}>
              <Form.Item
                label={<strong>Tỷ lệ Hoa hồng CTV mặc định (%)</strong>}
                name="affiliateCommissionRate"
                rules={[{ required: true, message: 'Vui lòng nhập tỷ lệ hoa hồng CTV' }]}
                help="Phần trăm hoa hồng chuyển về cho CTV khi ứng viên hoàn thành 60 ngày bảo hành (Mặc định: 80%)"
              >
                <InputNumber
                  min={50}
                  max={95}
                  addonAfter="%"
                  style={{ width: '100%', borderRadius: 8 }}
                />
              </Form.Item>
            </Col>

            <Col xs={24} sm={12}>
              <Form.Item
                label={<strong>Phí Dịch vụ Nền tảng Platform Margin (%)</strong>}
                name="platformFeeRate"
                rules={[{ required: true, message: 'Vui lòng nhập phí dịch vụ sàn' }]}
                help="Phần trăm doanh thu sàn giữ lại cho vận hành, kiểm định chất lượng và dự phòng bảo hành (Mặc định: 20%)"
              >
                <InputNumber
                  min={5}
                  max={50}
                  addonAfter="%"
                  style={{ width: '100%', borderRadius: 8 }}
                />
              </Form.Item>
            </Col>

            <Col xs={24} sm={12}>
              <Form.Item
                label={<strong>Hạn mức Payout tối thiểu (VNĐ)</strong>}
                name="minPayoutThresholdVND"
                help="Số dư hoa hồng tích lũy tối thiểu để tạo lệnh rút tiền (Mặc định: 1.000.000 đ)"
              >
                <InputNumber
                  min={100000}
                  step={100000}
                  formatter={(val) => `${val}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  parser={(val) => (val ? Number(val.replace(/\$\s?|(,*)/g, '')) : 100000) as any}
                  addonAfter="VNĐ"
                  style={{ width: '100%', borderRadius: 8 }}
                />
              </Form.Item>
            </Col>

            <Col xs={24} sm={12}>
              <Form.Item
                label={<strong>Tự động duyệt Payout dưới hạn mức</strong>}
                name="enablePayoutAutoApproval"
                valuePropName="checked"
                help="Tự động thực thi chi trả hoa hồng nếu hồ sơ hoàn tất 60 ngày mà không có khiếu nại"
              >
                <Switch />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        {/* Section 2: Warranty & Disputes */}
        <Card
          title={
            <Space>
              <ClockCircleOutlined style={{ color: '#0284c7' }} />
              <span>Thời hạn Bảo hành & Cửa sổ Tranh chấp (Warranty & Disputes)</span>
            </Space>
          }
          style={{
            borderRadius: 12,
            marginBottom: 20,
            border: '1px solid #e2e8f0',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          }}
        >
          <Row gutter={[24, 16]}>
            <Col xs={24} sm={12}>
              <Form.Item
                label={<strong>Thời hạn Bảo hành Ứng viên (Ngày)</strong>}
                name="warrantyDurationDays"
                rules={[{ required: true, message: 'Vui lòng nhập số ngày bảo hành' }]}
                help="Khoảng thời gian bảo hành bắt buộc sau ngày ứng viên Onboard (Mặc định: 60 ngày theo SDD/SRS)"
              >
                <InputNumber
                  min={15}
                  max={180}
                  addonAfter="ngày"
                  style={{ width: '100%', borderRadius: 8 }}
                />
              </Form.Item>
            </Col>

            <Col xs={24} sm={12}>
              <Form.Item
                label={<strong>Cửa sổ Khiếu nại Tranh chấp CV (Giờ)</strong>}
                name="disputeWindowHours"
                rules={[{ required: true, message: 'Vui lòng nhập thời hạn khiếu nại' }]}
                help="Thời gian tối đa để CTV khác nộp đơn khiếu nại trùng hồ sơ kể từ mốc nộp đầu tiên (Mặc định: 72 giờ)"
              >
                <InputNumber
                  min={12}
                  max={168}
                  addonAfter="giờ"
                  style={{ width: '100%', borderRadius: 8 }}
                />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        {/* Section 3: AI & Security */}
        <Card
          title={
            <Space>
              <RobotOutlined style={{ color: '#7c3aed' }} />
              <span>Tiêu chuẩn Sàng lọc AI & Bảo vệ Toàn vẹn Hồ sơ</span>
            </Space>
          }
          style={{
            borderRadius: 12,
            marginBottom: 24,
            border: '1px solid #e2e8f0',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          }}
        >
          <Row gutter={[24, 16]}>
            <Col xs={24} sm={12}>
              <Form.Item
                label={<strong>Điểm sàn Phù hợp AI Screening (Điểm/100)</strong>}
                name="aiScreeningThreshold"
                rules={[{ required: true, message: 'Vui lòng nhập điểm sàn AI' }]}
                help="Hồ sơ đạt điểm số này trở lên sẽ tự động được đề xuất chuyển sang vòng phỏng vấn sơ loại (Mặc định: 75)"
              >
                <InputNumber
                  min={50}
                  max={95}
                  addonAfter="/100 điểm"
                  style={{ width: '100%', borderRadius: 8 }}
                />
              </Form.Item>
            </Col>

            <Col xs={24} sm={12}>
              <Form.Item
                label={<strong>Tự động chặn trùng lặp CV (Email / SĐT)</strong>}
                name="autoDuplicateBlock"
                valuePropName="checked"
                help="Khóa tự động các lượt nộp trùng số điện thoại hoặc email ứng viên trong vòng 90 ngày"
              >
                <Switch />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        {/* Action Buttons */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
          <Button
            icon={<UndoOutlined />}
            onClick={handleReset}
            style={{ borderRadius: 8 }}
          >
            Khôi phục mặc định
          </Button>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            htmlType="submit"
            loading={saving}
            style={{
              borderRadius: 8,
              fontWeight: 700,
              background: 'linear-gradient(135deg, #0284c7, #0369a1)',
              borderColor: '#0284c7',
            }}
          >
            Lưu cấu hình hệ thống
          </Button>
        </div>
      </Form>
    </div>
  );
};
