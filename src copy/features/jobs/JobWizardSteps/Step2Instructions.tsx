import React from 'react';
import { Form, Select, Input, Typography, Alert, Tag, Space, Row, Col, Card } from 'antd';
import { InfoCircleOutlined } from '@ant-design/icons';
import { useJobStore } from '@/stores/jobStore';

const { Title, Text } = Typography;
const { TextArea } = Input;

const SUGGESTED_MUST_HAVE = ['Java', 'Spring Boot', 'React', 'TypeScript', 'Python', 'Kubernetes', 'PostgreSQL', 'AWS', 'Node.js', 'Docker', 'CI/CD', '.NET', 'C#', 'Go', 'Rust'];
const SUGGESTED_SHOULD_HAVE = ['Kafka', 'Redis', 'GraphQL', 'Terraform', 'Helm', 'Microservices', 'SOLID Principles', 'TDD', 'Agile/Scrum', 'Git', 'REST API', 'Jira'];

export const Step2Instructions: React.FC = () => {
  const { draft, updateStep2 } = useJobStore();

  return (
    <div style={{ maxWidth: 720 }}>
      <Alert
        type="info"
        icon={<InfoCircleOutlined />}
        showIcon
        message={
          <span style={{ fontSize: 13 }}>
            <strong>Tiêu chuẩn sàng lọc (Hard Tags)</strong> được AI sử dụng để chấm điểm hồ sơ.{' '}
            <strong>Bắt buộc có</strong> là điều kiện tiên quyết bắt buộc.{' '}
            <strong>Ưu tiên có</strong> giúp tăng độ tương đồng ngữ nghĩa mà không làm loại ứng viên.
          </span>
        }
        style={{ marginBottom: 24, borderRadius: 10 }}
      />

      <Row gutter={[16, 16]}>
        {/* Must-Have Tags */}
        <Col span={24}>
          <Card
            size="small"
            title={
              <Space>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444', display: 'inline-block' }} />
                <span style={{ fontWeight: 700, color: '#0f172a', fontSize: 14 }}>Bắt buộc có (Must-Have)</span>
                <Tag color="error" style={{ fontSize: 11, fontWeight: 600 }}>Điều kiện tiên quyết</Tag>
              </Space>
            }
            style={{ border: '2px solid #fecaca' }}
          >
            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 10 }}>
              Ứng viên thiếu BẤT KỲ tiêu chí bắt buộc nào sẽ bị tự động loại bỏ.
            </Text>
            <Form.Item style={{ marginBottom: 12 }}>
              <Select
                mode="tags"
                value={draft.step2.mustHaveTags}
                onChange={(v: string[]) => updateStep2({ mustHaveTags: v })}
                placeholder="Nhập kỹ năng và nhấn Enter, hoặc chọn từ gợi ý..."
                style={{ width: '100%' }}
                size="large"
                options={SUGGESTED_MUST_HAVE.map((s) => ({ value: s, label: s }))}
                tokenSeparators={[',']}
              />
            </Form.Item>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <Text type="secondary" style={{ fontSize: 11, marginRight: 4 }}>Gợi ý nhanh:</Text>
              {SUGGESTED_MUST_HAVE.slice(0, 8).map((s) => (
                <Tag
                  key={s}
                  style={{ cursor: 'pointer', borderRadius: 6, fontSize: 11 }}
                  color={draft.step2.mustHaveTags.includes(s) ? 'error' : 'default'}
                  onClick={() => {
                    const current = draft.step2.mustHaveTags;
                    updateStep2({
                      mustHaveTags: current.includes(s)
                        ? current.filter((t) => t !== s)
                        : [...current, s],
                    });
                  }}
                >
                  {draft.step2.mustHaveTags.includes(s) ? '✓ ' : '+ '}{s}
                </Tag>
              ))}
            </div>
          </Card>
        </Col>

        {/* Should-Have Tags */}
        <Col span={24}>
          <Card
            size="small"
            title={
              <Space>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
                <span style={{ fontWeight: 700, color: '#0f172a', fontSize: 14 }}>Ưu tiên có (Should-Have)</span>
                <Tag color="success" style={{ fontSize: 11, fontWeight: 600 }}>Ưu tiên — Tăng điểm đánh giá</Tag>
              </Space>
            }
            style={{ border: '2px solid #bbf7d0' }}
          >
            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 10 }}>
              Ứng viên có các kỹ năng này sẽ có điểm AI cao hơn. Thiếu các kỹ năng này sẽ không bị loại.
            </Text>
            <Form.Item style={{ marginBottom: 12 }}>
              <Select
                mode="tags"
                value={draft.step2.shouldHaveTags}
                onChange={(v: string[]) => updateStep2({ shouldHaveTags: v })}
                placeholder="Nhập kỹ năng và nhấn Enter, hoặc chọn từ gợi ý..."
                style={{ width: '100%' }}
                size="large"
                options={SUGGESTED_SHOULD_HAVE.map((s) => ({ value: s, label: s }))}
                tokenSeparators={[',']}
              />
            </Form.Item>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <Text type="secondary" style={{ fontSize: 11, marginRight: 4 }}>Gợi ý nhanh:</Text>
              {SUGGESTED_SHOULD_HAVE.slice(0, 8).map((s) => (
                <Tag
                  key={s}
                  style={{ cursor: 'pointer', borderRadius: 6, fontSize: 11 }}
                  color={draft.step2.shouldHaveTags.includes(s) ? 'success' : 'default'}
                  onClick={() => {
                    const current = draft.step2.shouldHaveTags;
                    updateStep2({
                      shouldHaveTags: current.includes(s)
                        ? current.filter((t) => t !== s)
                        : [...current, s],
                    });
                  }}
                >
                  {draft.step2.shouldHaveTags.includes(s) ? '✓ ' : '+ '}{s}
                </Tag>
              ))}
            </div>
          </Card>
        </Col>

        {/* Job Description */}
        <Col span={24}>
          <Title level={5} style={{ color: '#0f172a', marginBottom: 8 }}>Mô tả công việc (JD)</Title>
          <TextArea
            value={draft.step2.description}
            onChange={(e) => updateStep2({ description: e.target.value })}
            placeholder="Mô tả chi tiết vị trí công việc, dự án tham gia, công nghệ sử dụng và yêu cầu phối hợp..."
            rows={5}
            showCount
            maxLength={3000}
            style={{ borderRadius: 8 }}
          />
        </Col>
      </Row>
    </div>
  );
};
