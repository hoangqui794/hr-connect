/**
 * @file WizardStep2TagFilters.tsx
 * Step 2 of CreateJobWizard (MF-01 | SCR-CLI-01).
 * Tag inputs for [Must-have] and [Should-have] keyword filtering.
 * Uses Ant Design <Select mode="tags"> with suggestion options and
 * quick-add chip buttons. Also includes the Job Description textarea.
 */
import React from 'react';
import {
  Form, Select, Input, Typography, Alert, Tag, Space, Row, Col, Card,
} from 'antd';
import { InfoCircleOutlined } from '@ant-design/icons';
import type { FormInstance } from 'antd';
import { useJobStore } from '@/stores/jobStore';

const { Title, Text } = Typography;
const { TextArea } = Input;

const MUST_HAVE_SUGGESTIONS = [
  'Java', 'Spring Boot', 'React', 'TypeScript', 'Python', 'Kubernetes',
  'PostgreSQL', 'AWS', 'Node.js', 'Docker', 'CI/CD', '.NET', 'C#', 'Go',
  'Rust', 'Kafka', 'Redis', 'GraphQL', 'Terraform', 'Microservices',
];

const SHOULD_HAVE_SUGGESTIONS = [
  'Helm', 'ArgoCD', 'Prometheus', 'Grafana', 'Storybook', 'Jest',
  'SOLID Principles', 'TDD', 'Agile/Scrum', 'Git', 'REST API', 'Jira',
  'Confluence', 'DataDog', 'OpenTelemetry', 'Auth0', 'RabbitMQ',
];

interface QuickAddChipsProps {
  suggestions: string[];
  selected: string[];
  onToggle: (tag: string) => void;
  selectedColor: string;
  limit?: number;
}

const QuickAddChips: React.FC<QuickAddChipsProps> = ({
  suggestions, selected, onToggle, selectedColor, limit = 10,
}) => (
  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
    <Text type="secondary" style={{ fontSize: 11, alignSelf: 'center', marginRight: 2 }}>
      Gợi ý nhanh:
    </Text>
    {suggestions.slice(0, limit).map((s) => {
      const isActive = selected.includes(s);
      return (
        <Tag
          key={s}
          onClick={() => onToggle(s)}
          style={{
            cursor: 'pointer',
            borderRadius: 6,
            fontSize: 11,
            background: isActive ? selectedColor : undefined,
            color: isActive ? '#fff' : undefined,
            border: isActive ? `1px solid ${selectedColor}` : undefined,
            fontWeight: isActive ? 600 : 400,
            transition: 'all 0.15s',
            userSelect: 'none',
          }}
        >
          {isActive ? `✓ ${s}` : `+ ${s}`}
        </Tag>
      );
    })}
  </div>
);

export interface WizardStep2Props {
  form: FormInstance;
}

export const WizardStep2TagFilters: React.FC<WizardStep2Props> = ({ form: _form }) => {
  const { draft, updateStep2 } = useJobStore();

  const toggleTag = (
    key: 'mustHaveTags' | 'shouldHaveTags',
    tag: string
  ) => {
    const current = draft.step2[key];
    const next = current.includes(tag)
      ? current.filter((t) => t !== tag)
      : [...current, tag];
    updateStep2({ [key]: next });
  };

  return (
    <div style={{ maxWidth: 760 }}>
      <Alert
        type="info"
        icon={<InfoCircleOutlined />}
        showIcon
        message={
          <span style={{ fontSize: 13 }}>
            <strong>Tiêu chuẩn sàng lọc (Hard Tags)</strong> được công cụ AI sử dụng để chấm điểm hồ sơ.{' '}
            <strong>Bắt buộc có (Must-Have)</strong> là điều kiện tiên quyết — thiếu bất kỳ tiêu chí nào sẽ bị tự động loại.{' '}
            <strong>Ưu tiên có (Should-Have)</strong> giúp tăng độ tương đồng ngữ nghĩa mà không làm rớt ứng viên.
          </span>
        }
        style={{ marginBottom: 24, borderRadius: 10 }}
      />

      <Row gutter={[16, 20]}>
        {/* Must-Have Tags */}
        <Col span={24}>
          <Card
            size="small"
            title={
              <Space size={8}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444', display: 'inline-block' }} />
                <span style={{ fontWeight: 700, color: '#0f172a', fontSize: 14 }}>Bắt buộc có (Must-Have)</span>
                <Tag color="error" style={{ fontSize: 10, fontWeight: 700, borderRadius: 6 }}>
                  ĐIỀU KIỆN TIÊN QUYẾT
                </Tag>
              </Space>
            }
            style={{ border: '2px solid #fecaca', borderRadius: 10 }}
          >
            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 10 }}>
              Ứng viên thiếu <strong>bất kỳ</strong> tiêu chí bắt buộc nào sẽ bị hệ thống AI tự động loại bỏ.
            </Text>
            <Form.Item
              name="mustHaveTags"
              rules={[
                {
                  validator(_, value: string[] | undefined) {
                    if (!value || value.length === 0) {
                      return Promise.reject(new Error('Vui lòng thêm ít nhất một kỹ năng bắt buộc có.'));
                    }
                    return Promise.resolve();
                  },
                },
              ]}
              style={{ marginBottom: 12 }}
            >
              <Select
                mode="tags"
                value={draft.step2.mustHaveTags}
                onChange={(v: string[]) => updateStep2({ mustHaveTags: v })}
                placeholder="Nhập kỹ năng rồi nhấn Enter, hoặc chọn nhanh từ danh sách gợi ý..."
                size="large"
                options={MUST_HAVE_SUGGESTIONS.map((s) => ({ value: s, label: s }))}
                tokenSeparators={[',']}
                style={{ width: '100%' }}
                open={false}
              />
            </Form.Item>
            <QuickAddChips
              suggestions={MUST_HAVE_SUGGESTIONS}
              selected={draft.step2.mustHaveTags}
              onToggle={(tag) => toggleTag('mustHaveTags', tag)}
              selectedColor="#ef4444"
            />
          </Card>
        </Col>

        {/* Should-Have Tags */}
        <Col span={24}>
          <Card
            size="small"
            title={
              <Space size={8}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
                <span style={{ fontWeight: 700, color: '#0f172a', fontSize: 14 }}>Ưu tiên có (Should-Have)</span>
                <Tag color="success" style={{ fontSize: 10, fontWeight: 700, borderRadius: 6 }}>
                  ƯU TIÊN — CỘNG ĐIỂM
                </Tag>
              </Space>
            }
            style={{ border: '2px solid #bbf7d0', borderRadius: 10 }}
          >
            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 10 }}>
              Ứng viên sở hữu các kỹ năng này sẽ có điểm AI cao hơn. Thiếu các tiêu chí này <em>không</em> làm loại ứng viên.
            </Text>
            <Form.Item name="shouldHaveTags" style={{ marginBottom: 12 }}>
              <Select
                mode="tags"
                value={draft.step2.shouldHaveTags}
                onChange={(v: string[]) => updateStep2({ shouldHaveTags: v })}
                placeholder="Nhập kỹ năng rồi nhấn Enter, hoặc chọn nhanh từ danh sách gợi ý..."
                size="large"
                options={SHOULD_HAVE_SUGGESTIONS.map((s) => ({ value: s, label: s }))}
                tokenSeparators={[',']}
                style={{ width: '100%' }}
                open={false}
              />
            </Form.Item>
            <QuickAddChips
              suggestions={SHOULD_HAVE_SUGGESTIONS}
              selected={draft.step2.shouldHaveTags}
              onToggle={(tag) => toggleTag('shouldHaveTags', tag)}
              selectedColor="#10b981"
            />
          </Card>
        </Col>

        {/* Job Description */}
        <Col span={24}>
          <Title level={5} style={{ color: '#0f172a', marginBottom: 6 }}>
            Mô tả công việc (JD)
          </Title>
          <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 10 }}>
            Mô tả chi tiết về vị trí, bối cảnh đội ngũ và nhiệm vụ hằng ngày. Nội dung này sẽ được hiển thị cho ứng viên và cộng tác viên.
          </Text>
          <Form.Item
            name="description"
            rules={[
              { required: true, message: 'Vui lòng nhập mô tả công việc.' },
              { min: 100, message: 'Mô tả công việc phải có ít nhất 100 ký tự.' },
            ]}
          >
            <TextArea
              value={draft.step2.description}
              onChange={(e) => updateStep2({ description: e.target.value })}
              placeholder="Mô tả chi tiết vị trí công việc, dự án tham gia, công nghệ sử dụng và yêu cầu phối hợp hằng ngày..."
              rows={7}
              showCount
              maxLength={5000}
              style={{ borderRadius: 8 }}
            />
          </Form.Item>
        </Col>
      </Row>
    </div>
  );
};
