import React from 'react';
import { Input, Typography, Button, Card, Row, Col, Tag } from 'antd';
import { PlusOutlined, DeleteOutlined, TrophyOutlined } from '@ant-design/icons';
import { useJobStore } from '@/stores/jobStore';

const { Title, Text } = Typography;
const { TextArea } = Input;

const OBJECTIVE_TEMPLATES = [
  'Tìm kiếm và tuyển dụng ứng viên đạt yêu cầu trong vòng 30 ngày kể từ khi mở tin',
  'Cung cấp tối thiểu 5 hồ sơ ứng viên đạt chuẩn mỗi tuần đáp ứng đầy đủ tiêu chí bắt buộc',
  'Đạt tỷ lệ ứng viên đồng ý nhận việc (Offer acceptance) từ 75% trở lên',
  'Hoàn thành 60 ngày bảo hành thử việc không phát sinh khiếu nại thay thế',
  'Cung cấp báo cáo tiến độ tuyển dụng định kỳ hằng tuần cho các bên liên quan',
];

export const Step3Objectives: React.FC = () => {
  const { draft, updateStep3 } = useJobStore();
  const [newKpi, setNewKpi] = React.useState('');

  const addKpi = () => {
    if (newKpi.trim()) {
      updateStep3({ kpis: [...draft.step3.kpis, newKpi.trim()] });
      setNewKpi('');
    }
  };

  const removeKpi = (index: number) => {
    updateStep3({ kpis: draft.step3.kpis.filter((_, i) => i !== index) });
  };

  return (
    <div style={{ maxWidth: 720 }}>
      <Row gutter={[16, 24]}>
        {/* Objectives */}
        <Col span={24}>
          <Title level={5} style={{ color: '#0f172a', marginBottom: 4 }}>
            Mục tiêu tuyển dụng & Thử việc
          </Title>
          <Text type="secondary" style={{ fontSize: 13, display: 'block', marginBottom: 12 }}>
            Mô tả kết quả tuyển dụng và mục tiêu kỳ vọng đạt được cho vị trí này.
          </Text>
          <TextArea
            value={draft.step3.objectives}
            onChange={(e) => updateStep3({ objectives: e.target.value })}
            placeholder="Ví dụ: Tìm kiếm Kỹ sư Backend Java Senior phụ trách đội ngũ thanh toán, có năng lực xử lý 2 triệu giao dịch/ngày với tính sẵn sàng 99.99%..."
            rows={5}
            showCount
            maxLength={2000}
            style={{ borderRadius: 8 }}
          />

          {/* Templates */}
          <div style={{ marginTop: 12 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>Mẫu tham khảo nhanh:</Text>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
              {OBJECTIVE_TEMPLATES.slice(0, 3).map((t, i) => (
                <Tag
                  key={i}
                  style={{ cursor: 'pointer', borderRadius: 6, fontSize: 11, maxWidth: 300, whiteSpace: 'normal', lineHeight: 1.4, padding: '4px 8px' }}
                  onClick={() => updateStep3({ objectives: t })}
                >
                  {t.slice(0, 60)}...
                </Tag>
              ))}
            </div>
          </div>
        </Col>

        {/* KPIs */}
        <Col span={24}>
          <Card
            size="small"
            title={
              <span style={{ fontWeight: 700, fontSize: 14 }}>
                <TrophyOutlined style={{ color: '#f59e0b', marginRight: 8 }} />
                Chỉ số đo lường hiệu quả (KPIs)
              </span>
            }
            style={{ borderColor: '#fef3c7' }}
          >
            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 12 }}>
              Thiết lập các chỉ số KPI định lượng để đánh giá hiệu quả tuyển dụng vị trí này.
            </Text>

            {/* Existing KPIs */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
              {draft.step3.kpis.map((kpi, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    background: '#fffbeb',
                    border: '1px solid #fde68a',
                    borderRadius: 8,
                    padding: '8px 12px',
                  }}
                >
                  <span style={{ color: '#92400e', fontSize: 14 }}>📊</span>
                  <span style={{ flex: 1, fontSize: 13, color: '#0f172a' }}>{kpi}</span>
                  <Button
                    type="text"
                    danger
                    size="small"
                    icon={<DeleteOutlined />}
                    onClick={() => removeKpi(i)}
                  />
                </div>
              ))}
            </div>

            {/* Add KPI */}
            <div style={{ display: 'flex', gap: 8 }}>
              <Input
                value={newKpi}
                onChange={(e) => setNewKpi(e.target.value)}
                placeholder="Ví dụ: Cung cấp 3 hồ sơ đạt chuẩn phỏng vấn trong vòng 7 ngày"
                onPressEnter={addKpi}
                style={{ borderRadius: 8 }}
              />
              <Button type="dashed" icon={<PlusOutlined />} onClick={addKpi} style={{ flexShrink: 0 }}>
                Thêm
              </Button>
            </div>

            {/* KPI Suggestions */}
            <div style={{ marginTop: 12 }}>
              <Text type="secondary" style={{ fontSize: 11 }}>Gợi ý chỉ số KPI:</Text>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                {[
                  'Thời gian chọn hồ sơ: ≤ 7 ngày',
                  'Tỷ lệ từ chối CV: < 30%',
                  'Tỷ lệ tham gia phỏng vấn: ≥ 85%',
                  'Tỷ lệ chấp nhận Offer: ≥ 70%',
                ].map((s) => (
                  <Tag
                    key={s}
                    style={{ cursor: 'pointer', borderRadius: 6, fontSize: 11 }}
                    onClick={() => updateStep3({ kpis: [...draft.step3.kpis, s] })}
                  >
                    + {s}
                  </Tag>
                ))}
              </div>
            </div>
          </Card>
        </Col>

        {/* Success Criteria */}
        <Col span={24}>
          <Title level={5} style={{ color: '#0f172a', marginBottom: 4 }}>
            Tiêu chí thành công sau 60 ngày thử việc
          </Title>
          <Text type="secondary" style={{ fontSize: 13, display: 'block', marginBottom: 12 }}>
            Ứng viên hoàn thành tốt 100% thử việc sau 60 ngày cần đạt được những tiêu chí gì?
          </Text>
          <TextArea
            value={draft.step3.successCriteria}
            onChange={(e) => updateStep3({ successCriteria: e.target.value })}
            placeholder="Ví dụ: Ứng viên vượt qua kỳ đánh giá thử việc, hòa nhập tốt với văn hóa công ty và độc lập phụ trách các tính năng chính từ ngày thứ 45..."
            rows={4}
            style={{ borderRadius: 8 }}
            maxLength={1500}
            showCount
          />
        </Col>
      </Row>
    </div>
  );
};
