import React from 'react';
import { Row, Col, Typography, Tag } from 'antd';
import {
  RocketOutlined,
  TeamOutlined,
  SafetyCertificateOutlined,
  AuditOutlined,
} from '@ant-design/icons';
import { useI18nStore } from '@/i18n';

const { Title, Paragraph } = Typography;

export const SystemFeatures: React.FC = () => {
  const { t } = useI18nStore();

  const featureItems = [
    {
      icon: <RocketOutlined style={{ fontSize: 26, color: '#38bdf8' }} />,
      tag: t.features.f1.tag,
      tagColor: 'blue',
      title: t.features.f1.title,
      desc: t.features.f1.desc,
      gradient: 'linear-gradient(135deg, rgba(2, 132, 199, 0.12) 0%, rgba(14, 165, 233, 0.04) 100%)',
      borderColor: 'rgba(2, 132, 199, 0.25)',
    },
    {
      icon: <TeamOutlined style={{ fontSize: 26, color: '#10b981' }} />,
      tag: t.features.f2.tag,
      tagColor: 'green',
      title: t.features.f2.title,
      desc: t.features.f2.desc,
      gradient: 'linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(52, 211, 153, 0.04) 100%)',
      borderColor: 'rgba(16, 185, 129, 0.25)',
    },
    {
      icon: <SafetyCertificateOutlined style={{ fontSize: 26, color: '#f59e0b' }} />,
      tag: t.features.f3.tag,
      tagColor: 'warning',
      title: t.features.f3.title,
      desc: t.features.f3.desc,
      gradient: 'linear-gradient(135deg, rgba(245, 158, 11, 0.12) 0%, rgba(251, 191, 36, 0.04) 100%)',
      borderColor: 'rgba(245, 158, 11, 0.25)',
    },
    {
      icon: <AuditOutlined style={{ fontSize: 26, color: '#8b5cf6' }} />,
      tag: t.features.f4.tag,
      tagColor: 'purple',
      title: t.features.f4.title,
      desc: t.features.f4.desc,
      gradient: 'linear-gradient(135deg, rgba(139, 92, 246, 0.12) 0%, rgba(167, 139, 250, 0.04) 100%)',
      borderColor: 'rgba(139, 92, 246, 0.25)',
    },
  ];

  return (
    <section
      id="affiliate-network"
      style={{
        padding: '96px 24px',
        background: '#0f172a',
        position: 'relative',
      }}
    >
      <div style={{ maxWidth: 1160, margin: '0 auto' }}>
        {/* Section Header */}
        <div style={{ textAlign: 'center', marginBottom: 60 }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              background: 'rgba(56, 189, 248, 0.1)',
              border: '1px solid rgba(56, 189, 248, 0.25)',
              borderRadius: 100,
              padding: '4px 14px',
              marginBottom: 16,
            }}
          >
            <span style={{ color: '#38bdf8', fontSize: 12, fontWeight: 700, letterSpacing: '0.08em' }}>
              {t.features.badge}
            </span>
          </div>
          <Title
            level={2}
            style={{
              color: '#f8fafc',
              fontSize: 'clamp(28px, 4vw, 40px)',
              fontWeight: 800,
              marginBottom: 16,
              letterSpacing: '-0.5px',
            }}
          >
            {t.features.title}
          </Title>
          <Paragraph
            style={{
              color: '#94a3b8',
              fontSize: 16,
              maxWidth: 700,
              margin: '0 auto',
              lineHeight: 1.6,
            }}
          >
            {t.features.subtitle}
          </Paragraph>
        </div>

        {/* Feature Cards Grid */}
        <Row gutter={[24, 24]} justify="center">
          {featureItems.map((item, idx) => (
            <Col key={idx} xs={24} md={12}>
              <div
                style={{
                  background: item.gradient,
                  border: `1px solid ${item.borderColor}`,
                  borderRadius: 18,
                  padding: '32px 28px',
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  boxShadow: '0 10px 30px rgba(0, 0, 0, 0.2)',
                  backdropFilter: 'blur(10px)',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-4px)';
                  e.currentTarget.style.boxShadow = '0 16px 36px rgba(0, 0, 0, 0.35)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 10px 30px rgba(0, 0, 0, 0.2)';
                }}
              >
                <div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: 20,
                    }}
                  >
                    <div
                      style={{
                        width: 52,
                        height: 52,
                        borderRadius: 14,
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {item.icon}
                    </div>
                    <Tag
                      color={item.tagColor}
                      style={{
                        borderRadius: 100,
                        padding: '3px 12px',
                        fontSize: 11,
                        fontWeight: 600,
                        letterSpacing: '0.04em',
                      }}
                    >
                      {item.tag}
                    </Tag>
                  </div>

                  <Title
                    level={4}
                    style={{
                      color: '#f8fafc',
                      fontSize: 19,
                      fontWeight: 700,
                      marginBottom: 12,
                      lineHeight: 1.4,
                    }}
                  >
                    {item.title}
                  </Title>

                  <Paragraph
                    style={{
                      color: '#94a3b8',
                      fontSize: 14,
                      lineHeight: 1.7,
                      marginBottom: 0,
                    }}
                  >
                    {item.desc}
                  </Paragraph>
                </div>
              </div>
            </Col>
          ))}
        </Row>
      </div>
    </section>
  );
};
