/**
 * @file WizardStep3Objectives.tsx
 * Step 3 of CreateJobWizard (MF-01 | SCR-CLI-01).
 * Recruitment Objectives, measurable KPI definitions, and Success Criteria.
 */
import React from 'react';
import { Form, Input, Button, Card, Row, Col, Tag, Typography } from 'antd';
import { PlusOutlined, DeleteOutlined, TrophyOutlined } from '@ant-design/icons';
import type { FormInstance } from 'antd';
import { useJobStore } from '@/stores/jobStore';

const { Title, Text } = Typography;
const { TextArea } = Input;

const OBJECTIVE_TEMPLATES = [
  'Tìm kiếm và tuyển dụng ứng viên đạt yêu cầu trong vòng 30 ngày kể từ ngày kích hoạt tin tuyển dụng.',
  'Cung cấp tối thiểu 5 hồ sơ ứng viên đạt chuẩn mỗi tuần đáp ứng đầy đủ tiêu chí bắt buộc.',
  'Đạt tỷ lệ ứng viên đồng ý nhận việc (Offer acceptance rate) từ 75% trở lên.',
  'Hoàn thành 60 ngày bảo hành thử việc không phát sinh khiếu nại hoặc yêu cầu tìm người thay thế.',
  'Cung cấp báo cáo tiến độ tuyển dụng định kỳ hằng tuần cho các bên liên quan.',
];

const KPI_SUGGESTIONS = [
  'Thời gian chọn lọc hồ sơ: ≤ 7 ngày',
  'Tỷ lệ từ chối CV: < 30%',
  'Tỷ lệ tham gia phỏng vấn: ≥ 85%',
  'Tỷ lệ chấp nhận Offer: ≥ 70%',
  'Thời gian hoàn tất tuyển: ≤ 45 ngày',
  'Tỷ lệ hoàn thành thử việc 60 ngày: 100%',
];

export interface WizardStep3Props {
  form: FormInstance;
}

export const WizardStep3Objectives: React.FC<WizardStep3Props> = ({ form: _form }) => {
  const { draft, updateStep3 } = useJobStore();
  const [newKpi, setNewKpi] = React.useState('');

  const addKpi = () => {
    const trimmed = newKpi.trim();
    if (!trimmed) return;
    updateStep3({ kpis: [...draft.step3.kpis, trimmed] });
    setNewKpi('');
  };

  const removeKpi = (index: number) => {
    updateStep3({ kpis: draft.step3.kpis.filter((_, i) => i !== index) });
  };

  const addKpiSuggestion = (s: string) => {
    if (!draft.step3.kpis.includes(s)) {
      updateStep3({ kpis: [...draft.step3.kpis, s] });
    }
  };

  return (
    <div style={{ maxWidth: 760 }}>
      <Row gutter={[16, 24]}>
        {/* Recruitment Objectives */}
        <Col span={24}>
          <Title level={5} style={{ color: '#0f172a', marginBottom: 4 }}>
            Mục tiêu tuyển dụng & Thử việc
          </Title>
          <Text type="secondary" style={{ fontSize: 13, display: 'block', marginBottom: 12 }}>
            Mô tả kết quả tuyển dụng và mục tiêu kỳ vọng đạt được cho vị trí này.
          </Text>
          <Form.Item
            name="objectives"
            rules={[
              { required: true, message: 'Vui lòng mô tả mục tiêu tuyển dụng và thử việc.' },
              { min: 50, message: 'Mục tiêu phải có ít nhất 50 ký tự.' },
            ]}
          >
            <TextArea
              value={draft.step3.objectives}
              onChange={(e) => updateStep3({ objectives: e.target.value })}
              placeholder="Ví dụ: Tìm kiếm Kỹ sư Backend Java Senior phụ trách đội ngũ thanh toán, có năng lực xử lý hệ thống tải cao 2 triệu giao dịch/ngày và đảm bảo tính sẵn sàng 99.99%..."
              rows={5}
              showCount
              maxLength={2000}
              style={{ borderRadius: 8 }}
            />
          </Form.Item>
          <div>
            <Text type="secondary" style={{ fontSize: 12 }}>Mẫu tham khảo nhanh:</Text>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
              {OBJECTIVE_TEMPLATES.slice(0, 3).map((t, i) => (
                <Tag
                  key={i}
                  onClick={() => updateStep3({ objectives: t })}
                  style={{
                    cursor: 'pointer',
                    borderRadius: 6,
                    fontSize: 11,
                    maxWidth: 320,
                    whiteSpace: 'normal',
                    lineHeight: 1.4,
                    padding: '4px 8px',
                  }}
                >
                  {t.slice(0, 65)}…
                </Tag>
              ))}
            </div>
          </div>
        </Col>

        {/* KPI Definitions */}
        <Col span={24}>
          <Card
            size="small"
            title={
              <span style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>
                <TrophyOutlined style={{ color: '#f59e0b', marginRight: 8 }} />
                Chỉ số đo lường hiệu quả (KPIs)
              </span>
            }
            style={{ borderColor: '#fde68a', borderRadius: 10 }}
          >
            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 12 }}>
              Thiết lập các chỉ số KPI định lượng để đánh giá hiệu quả tuyển dụng và bàn giao vị trí.
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
                  <span style={{ fontSize: 14 }}>📊</span>
                  <span style={{ flex: 1, fontSize: 13, color: '#0f172a' }}>{kpi}</span>
                  <Button
                    type="text"
                    danger
                    size="small"
                    icon={<DeleteOutlined />}
                    onClick={() => removeKpi(i)}
                    aria-label={`Xóa KPI: ${kpi}`}
                  />
                </div>
              ))}
            </div>

            {/* Add KPI input */}
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
                {KPI_SUGGESTIONS.map((s) => (
                  <Tag
                    key={s}
                    onClick={() => addKpiSuggestion(s)}
                    style={{
                      cursor: 'pointer',
                      borderRadius: 6,
                      fontSize: 11,
                      opacity: draft.step3.kpis.includes(s) ? 0.4 : 1,
                    }}
                  >
                    {draft.step3.kpis.includes(s) ? '✓ ' : '+ '}{s}
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
          <Form.Item name="successCriteria">
            <TextArea
              value={draft.step3.successCriteria}
              onChange={(e) => updateStep3({ successCriteria: e.target.value })}
              placeholder="Ví dụ: Ứng viên vượt qua kỳ đánh giá thử việc, hòa nhập tốt với văn hóa công ty, nắm vững quy trình và độc lập phụ trách các tính năng chính từ ngày thứ 45..."
              rows={4}
              style={{ borderRadius: 8 }}
              maxLength={1500}
              showCount
            />
          </Form.Item>
        </Col>
      </Row>
    </div>
  );
};
