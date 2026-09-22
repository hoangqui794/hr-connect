/**
 * @file WizardStep4Engagement.tsx
 * Step 4 of CreateJobWizard (MF-01 | SCR-CLI-01).
 * Commission rate, retainer fee, timeline, and engagement notes.
 * Conditionally renders fields based on serviceType from the draft store.
 */
import React from 'react';
import {
  Form, InputNumber, Input, Typography, Slider, Card, Row, Col, Alert,
} from 'antd';
import {
  DollarOutlined, ClockCircleOutlined, PercentageOutlined, InfoCircleOutlined,
} from '@ant-design/icons';
import type { FormInstance } from 'antd';
import { useJobStore } from '@/stores/jobStore';
import { ServiceType } from '@/types/job';

const { Title, Text } = Typography;
const { TextArea } = Input;

export interface WizardStep4Props {
  form: FormInstance;
}

export const WizardStep4Engagement: React.FC<WizardStep4Props> = ({ form: _form }) => {
  const { draft, updateStep4 } = useJobStore();
  const isHeadhunt = draft.step1.serviceType === ServiceType.HEADHUNT_COD;
  const isCV = draft.step1.serviceType === ServiceType.CV_SOURCING;
  const showCommission = isHeadhunt || isCV;

  const estimatedCommission =
    draft.step4.commissionRate > 0 && draft.step1.salaryMax > 0
      ? Math.round((draft.step1.salaryMax * draft.step4.commissionRate) / 100)
      : 0;

  return (
    <div style={{ maxWidth: 760 }}>
      {/* Summary Preview Card */}
      <Card
        style={{
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
          border: 'none',
          borderRadius: 16,
          marginBottom: 28,
        }}
      >
        <Row gutter={[24, 16]}>
          {[
            {
              label: 'Tỷ lệ hoa hồng',
              value: showCommission ? `${draft.step4.commissionRate}%` : '—',
              color: '#38bdf8',
              show: true,
            },
            {
              label: 'Hoa hồng ước tính',
              value: showCommission && estimatedCommission > 0
                ? `${estimatedCommission.toLocaleString()} ${draft.step1.currency}`
                : '—',
              color: '#10b981',
              show: showCommission,
            },
            {
              label: 'Thời gian tuyển',
              value: `${draft.step4.timeline} ngày`,
              color: '#f1f5f9',
              show: true,
            },
            {
              label: 'Bảo hành thử việc',
              value: isHeadhunt ? '60 ngày' : '—',
              color: '#f59e0b',
              show: true,
            },
          ].map((item) =>
            item.show ? (
              <Col xs={12} sm={6} key={item.label} style={{ textAlign: 'center' }}>
                <div
                  style={{
                    color: '#94a3b8',
                    fontSize: 11,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                  }}
                >
                  {item.label}
                </div>
                <div
                  style={{
                    color: item.color,
                    fontSize: 26,
                    fontWeight: 800,
                    marginTop: 4,
                    lineHeight: 1.2,
                  }}
                >
                  {item.value}
                </div>
              </Col>
            ) : null
          )}
        </Row>
      </Card>

      <Row gutter={[16, 20]}>
        {/* Commission Rate Slider */}
        {showCommission && (
          <Col span={24}>
            <Card size="small" style={{ borderColor: '#bae6fd', borderRadius: 10 }}>
              <Title level={5} style={{ color: '#0f172a', marginBottom: 4 }}>
                <PercentageOutlined style={{ color: '#0284c7', marginRight: 8 }} />
                Tỷ lệ hoa hồng
              </Title>
              <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 16 }}>
                Phần trăm tính theo mức lương tháng nhận việc của ứng viên chi trả cho cộng tác viên tuyển dụng
                khi tuyển dụng thành công và hoàn thành thời gian bảo hành.
              </Text>
              <Row gutter={[16, 0]} align="middle">
                <Col xs={24} sm={16}>
                  <Form.Item name="commissionRate" noStyle>
                    <Slider
                      min={8}
                      max={30}
                      step={0.5}
                      value={draft.step4.commissionRate}
                      onChange={(v: number) => updateStep4({ commissionRate: v })}
                      marks={{ 8: '8%', 15: '15%', 20: '20%', 25: '25%', 30: '30%' }}
                      styles={{
                        track: { background: '#0284c7' },
                        handle: { borderColor: '#0284c7' },
                      }}
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={8}>
                  <InputNumber
                    min={8}
                    max={30}
                    step={0.5}
                    value={draft.step4.commissionRate}
                    onChange={(v) => updateStep4({ commissionRate: v ?? 15 })}
                    formatter={(v) => `${v ?? ''}%`}
                    parser={(v) => parseFloat((v ?? '').replace('%', '')) as unknown as 0}
                    size="large"
                    style={{ width: '100%' }}
                  />
                </Col>
              </Row>
            </Card>
          </Col>
        )}

        {/* Retainer Fee (HEADHUNT_COD only) */}
        {isHeadhunt && (
          <Col xs={24} sm={12}>
            <Title level={5} style={{ color: '#0f172a', marginBottom: 4 }}>
              <DollarOutlined style={{ color: '#f59e0b', marginRight: 8 }} />
              Phí đặt cọc trước ({draft.step1.currency})
            </Title>
            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
              Khoản phí tùy chọn trả trước cho HR Connect trước khi bắt đầu chiến dịch tìm kiếm.
            </Text>
            <Form.Item name="retainerFee">
              <InputNumber
                min={0}
                value={draft.step4.retainerFee}
                onChange={(v) => updateStep4({ retainerFee: v ?? 0 })}
                formatter={(v) => `${v ?? ''}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                style={{ width: '100%' }}
                size="large"
                placeholder="0 (không bắt buộc)"
              />
            </Form.Item>
          </Col>
        )}

        {/* Fill Timeline */}
        <Col xs={24} sm={isHeadhunt ? 12 : 12}>
          <Title level={5} style={{ color: '#0f172a', marginBottom: 4 }}>
            <ClockCircleOutlined style={{ color: '#8b5cf6', marginRight: 8 }} />
            Thời gian tuyển dụng dự kiến (ngày)
          </Title>
          <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
            Số ngày kỳ vọng để gửi danh sách ứng viên chọn lọc đầu tiên.
          </Text>
          <Form.Item
            name="timeline"
            rules={[{ required: true, type: 'number', min: 7, message: 'Thời gian tối thiểu 7 ngày.' }]}
          >
            <InputNumber
              min={7}
              max={90}
              value={draft.step4.timeline}
              onChange={(v) => updateStep4({ timeline: v ?? 30 })}
              style={{ width: '100%' }}
              size="large"
            />
          </Form.Item>
        </Col>

        {/* Engagement Notes */}
        <Col span={24}>
          <Title level={5} style={{ color: '#0f172a', marginBottom: 4 }}>
            Ghi chú và điều khoản bổ sung
          </Title>
          <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
            Yêu cầu bảo mật (NDA), chi tiết quy trình phỏng vấn hoặc định dạng đánh giá mong muốn.
          </Text>
          <Form.Item name="notes">
            <TextArea
              value={draft.step4.notes}
              onChange={(e) => updateStep4({ notes: e.target.value })}
              placeholder="Ví dụ: Ứng viên cần ký thỏa thuận NDA trước khi phỏng vấn chuyên sâu. Quy trình tuyển dụng gồm 3 vòng..."
              rows={4}
              style={{ borderRadius: 8 }}
              maxLength={2000}
              showCount
            />
          </Form.Item>
        </Col>

        {/* HEADHUNT_COD warranty notice */}
        {isHeadhunt && (
          <Col span={24}>
            <Alert
              type="success"
              showIcon
              icon={<InfoCircleOutlined />}
              message="Tuyển dụng trọn gói (COD) — Đã bao gồm cam kết bảo hành thử việc 60 ngày"
              description="Nếu ứng viên rời đi trong vòng 60 ngày kể từ ngày nhận việc, HR Connect sẽ tìm kiếm ứng viên thay thế đạt chuẩn mà không phát sinh thêm bất kỳ chi phí hoa hồng nào. Khoản thanh toán hoa hồng được bảo đảm an toàn và chỉ giải ngân sau khi hết thời hạn bảo hành."
              style={{ borderRadius: 10 }}
            />
          </Col>
        )}
      </Row>
    </div>
  );
};
