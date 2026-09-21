import React from 'react';
import { InputNumber, Typography, Slider, Card, Row, Col, Alert, Input } from 'antd';
import { DollarOutlined, ClockCircleOutlined, PercentageOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { useJobStore } from '@/stores/jobStore';
import { ServiceType } from '@/types/job';

const { Title, Text } = Typography;
const { TextArea } = Input;

export const Step4Engagement: React.FC = () => {
  const { draft, updateStep4 } = useJobStore();
  const isHeadhunt = draft.step1.serviceType === ServiceType.HEADHUNT_COD;
  const isCV = draft.step1.serviceType === ServiceType.CV_SOURCING;

  const estimatedCommission =
    draft.step4.commissionRate > 0 && draft.step1.salaryMax > 0
      ? Math.round((draft.step1.salaryMax * draft.step4.commissionRate) / 100)
      : 0;

  return (
    <div style={{ maxWidth: 720 }}>
      {/* Summary Preview */}
      <Card
        style={{
          background: 'linear-gradient(135deg, #0f172a, #1e293b)',
          border: 'none',
          borderRadius: 16,
          marginBottom: 24,
        }}
      >
        <Row gutter={[24, 16]}>
          <Col xs={24} sm={6} style={{ textAlign: 'center' }}>
            <div style={{ color: '#94a3b8', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tỷ lệ hoa hồng</div>
            <div style={{ color: '#38bdf8', fontSize: 32, fontWeight: 800, marginTop: 4 }}>
              {draft.step4.commissionRate}%
            </div>
          </Col>
          <Col xs={24} sm={6} style={{ textAlign: 'center' }}>
            <div style={{ color: '#94a3b8', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Hoa hồng ước tính</div>
            <div style={{ color: '#10b981', fontSize: 24, fontWeight: 800, marginTop: 4 }}>
              {estimatedCommission.toLocaleString()} {draft.step1.currency}
            </div>
            <div style={{ color: '#475569', fontSize: 11 }}>mỗi vị trí thành công</div>
          </Col>
          <Col xs={24} sm={6} style={{ textAlign: 'center' }}>
            <div style={{ color: '#94a3b8', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Thời gian tuyển</div>
            <div style={{ color: '#f1f5f9', fontSize: 24, fontWeight: 800, marginTop: 4 }}>
              {draft.step4.timeline} ngày
            </div>
          </Col>
          <Col xs={24} sm={6} style={{ textAlign: 'center' }}>
            <div style={{ color: '#94a3b8', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Bảo hành thử việc</div>
            <div style={{ color: '#f59e0b', fontSize: 24, fontWeight: 800, marginTop: 4 }}>
              {isHeadhunt ? '60 ngày' : '—'}
            </div>
            {isHeadhunt && <div style={{ color: '#475569', fontSize: 11 }}>bảo hành thử việc</div>}
          </Col>
        </Row>
      </Card>

      <Row gutter={[16, 20]}>
        {/* Commission Rate */}
        {(isHeadhunt || isCV) && (
          <Col span={24}>
            <Card size="small" style={{ borderColor: '#bae6fd' }}>
              <Title level={5} style={{ color: '#0f172a', marginBottom: 4 }}>
                <PercentageOutlined style={{ color: '#0284c7', marginRight: 8 }} />
                Tỷ lệ hoa hồng (%)
              </Title>
              <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 16 }}>
                Phần trăm tính theo mức lương tháng nhận việc của ứng viên chi trả cho cộng tác viên khi tuyển dụng thành công và hết hạn bảo hành.
              </Text>
              <Row gutter={16} align="middle">
                <Col xs={24} sm={14}>
                  <Slider
                    min={8}
                    max={30}
                    step={0.5}
                    value={draft.step4.commissionRate}
                    onChange={(v: number) => updateStep4({ commissionRate: v })}
                    marks={{ 8: '8%', 15: '15%', 20: '20%', 25: '25%', 30: '30%' }}
                    trackStyle={{ background: '#0284c7' }}
                    handleStyle={{ borderColor: '#0284c7' }}
                  />
                </Col>
                <Col xs={24} sm={10}>
                  <InputNumber
                    min={8}
                    max={30}
                    step={0.5}
                    value={draft.step4.commissionRate}
                    onChange={(v) => updateStep4({ commissionRate: v ?? 15 })}
                    formatter={(v) => `${v}%`}
                    parser={(v) => parseFloat((v ?? '').replace('%', '')) as unknown as 0 | 8}
                    size="large"
                    style={{ width: '100%' }}
                  />
                </Col>
              </Row>
            </Card>
          </Col>
        )}

        {/* Retainer Fee */}
        {isHeadhunt && (
          <Col xs={24} sm={12}>
            <Title level={5} style={{ color: '#0f172a', marginBottom: 4 }}>
              <DollarOutlined style={{ color: '#f59e0b', marginRight: 8 }} />
              Phí đặt cọc trước ({draft.step1.currency})
            </Title>
            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
              Khoản phí tùy chọn trả trước cho HR Connect trước khi bắt đầu tìm kiếm
            </Text>
            <InputNumber
              min={0}
              value={draft.step4.retainerFee}
              onChange={(v) => updateStep4({ retainerFee: v ?? 0 })}
              formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              style={{ width: '100%' }}
              size="large"
              placeholder="0 (không bắt buộc)"
            />
          </Col>
        )}

        {/* Timeline */}
        <Col xs={24} sm={isHeadhunt ? 12 : 12}>
          <Title level={5} style={{ color: '#0f172a', marginBottom: 4 }}>
            <ClockCircleOutlined style={{ color: '#8b5cf6', marginRight: 8 }} />
            Thời gian tuyển dụng kỳ vọng (ngày)
          </Title>
          <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
            Số ngày kỳ vọng để gửi danh sách ứng viên chọn lọc đầu tiên
          </Text>
          <InputNumber
            min={7}
            max={90}
            value={draft.step4.timeline}
            onChange={(v) => updateStep4({ timeline: v ?? 30 })}
            style={{ width: '100%' }}
            size="large"
          />
        </Col>

        {/* Notes */}
        <Col span={24}>
          <Title level={5} style={{ color: '#0f172a', marginBottom: 4 }}>Ghi chú và điều khoản bổ sung</Title>
          <TextArea
            value={draft.step4.notes}
            onChange={(e) => updateStep4({ notes: e.target.value })}
            placeholder="Yêu cầu bảo mật thông tin (NDA), chi tiết quy trình phỏng vấn hoặc ghi chú đặc biệt..."
            rows={3}
            style={{ borderRadius: 8 }}
          />
        </Col>

        {isHeadhunt && (
          <Col span={24}>
            <Alert
              type="success"
              showIcon
              icon={<InfoCircleOutlined />}
              message="Tuyển dụng trọn gói (COD) — Bảo hành thử việc 60 ngày"
              description="Nếu ứng viên rời đi trong vòng 60 ngày kể từ ngày nhận việc, HR Connect sẽ tìm kiếm ứng viên thay thế đạt chuẩn mà không phát sinh thêm bất kỳ chi phí hoa hồng nào. Tiền hoa hồng chỉ được giải ngân sau khi hết thời hạn bảo hành."
              style={{ borderRadius: 10 }}
            />
          </Col>
        )}
      </Row>
    </div>
  );
};
