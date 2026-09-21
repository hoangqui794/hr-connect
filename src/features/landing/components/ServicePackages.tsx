import React from 'react';
import { Row, Col, Typography, Button, Tag } from 'antd';
import {
  CheckCircleFilled,
  SafetyCertificateOutlined,
  ThunderboltOutlined,
  GlobalOutlined,
  ArrowRightOutlined,
  CrownFilled,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useI18nStore } from '@/i18n';
import { useAuthStore } from '@/stores/authStore';
import { UserRole } from '@/types/roles';

const { Title, Paragraph, Text } = Typography;

export const ServicePackages: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useI18nStore();
  const { isAuthenticated, role } = useAuthStore();

  const handleSelectPackage = (packageCode: string) => {
    if (isAuthenticated && role === UserRole.CLIENT) {
      navigate(`/jobs/create?serviceLine=${packageCode}`);
    } else {
      navigate(`/register?role=CLIENT&package=${packageCode}`);
    }
  };

  return (
    <section
      id="pricing"
      style={{
        padding: '96px 24px',
        background: '#0b1120',
        position: 'relative',
      }}
    >
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        {/* Section Header */}
        <div style={{ textAlign: 'center', marginBottom: 64 }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              background: 'rgba(2, 132, 199, 0.12)',
              border: '1px solid rgba(2, 132, 199, 0.25)',
              borderRadius: 100,
              padding: '4px 14px',
              marginBottom: 16,
            }}
          >
            <span style={{ color: '#38bdf8', fontSize: 12, fontWeight: 700, letterSpacing: '0.08em' }}>
              {t.services.badge}
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
            {t.services.title}
          </Title>
          <Paragraph
            style={{
              color: '#94a3b8',
              fontSize: 16,
              maxWidth: 720,
              margin: '0 auto',
              lineHeight: 1.6,
            }}
          >
            {t.services.subtitle}
          </Paragraph>
        </div>

        {/* 3-Column Card Grid */}
        <Row gutter={[28, 28]} justify="center" align="stretch">
          {/* Card 1: HEADHUNT_COD */}
          <Col xs={24} lg={8} style={{ display: 'flex' }}>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                width: '100%',
                background: 'linear-gradient(180deg, rgba(30, 41, 59, 0.9) 0%, rgba(15, 23, 42, 0.95) 100%)',
                border: '2px solid #0284c7',
                borderRadius: 20,
                padding: '36px 28px',
                position: 'relative',
                boxShadow: '0 20px 40px rgba(2, 132, 199, 0.25), 0 0 25px rgba(2, 132, 199, 0.15)',
                transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-6px)')}
              onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
            >
              {/* Most Popular Badge */}
              <div
                style={{
                  position: 'absolute',
                  top: -14,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  background: 'linear-gradient(135deg, #0284c7, #0ea5e9)',
                  color: '#fff',
                  padding: '4px 16px',
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  boxShadow: '0 4px 12px rgba(2, 132, 199, 0.4)',
                }}
              >
                <CrownFilled style={{ color: '#fde047' }} />
                {t.services.popularBadge}
              </div>

              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <Tag
                    color="blue"
                    style={{
                      fontWeight: 700,
                      borderRadius: 6,
                      padding: '2px 8px',
                      fontSize: 11,
                      letterSpacing: '0.04em',
                    }}
                  >
                    {t.services.cod.badgeTitle}
                  </Tag>
                  <SafetyCertificateOutlined style={{ fontSize: 24, color: '#38bdf8' }} />
                </div>

                <Title level={3} style={{ color: '#f8fafc', fontSize: 22, fontWeight: 700, marginBottom: 8 }}>
                  {t.services.cod.title}
                </Title>
                <Text style={{ color: '#38bdf8', fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 16 }}>
                  {t.services.cod.subtitle}
                </Text>

                <Paragraph style={{ color: '#cbd5e1', fontSize: 14, lineHeight: 1.65, minHeight: 70 }}>
                  {t.services.cod.description}
                </Paragraph>

                <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.08)', margin: '20px 0' }} />

                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 32 }}>
                  {t.services.cod.features.map((feat, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                      <CheckCircleFilled style={{ color: '#0284c7', fontSize: 16, marginTop: 3, flexShrink: 0 }} />
                      <span style={{ color: '#e2e8f0', fontSize: 13, lineHeight: 1.5 }}>{feat}</span>
                    </div>
                  ))}
                </div>
              </div>

              <Button
                type="primary"
                size="large"
                block
                icon={<ArrowRightOutlined />}
                onClick={() => handleSelectPackage('HEADHUNT_COD')}
                style={{
                  height: 48,
                  borderRadius: 12,
                  fontWeight: 700,
                  fontSize: 15,
                  background: 'linear-gradient(135deg, #0284c7, #0ea5e9)',
                  border: 'none',
                  boxShadow: '0 4px 14px rgba(2, 132, 199, 0.4)',
                }}
              >
                {t.services.cod.cta}
              </Button>
            </div>
          </Col>

          {/* Card 2: CV_SOURCING */}
          <Col xs={24} lg={8} style={{ display: 'flex' }}>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                width: '100%',
                background: 'rgba(30, 41, 59, 0.5)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: 20,
                padding: '36px 28px',
                backdropFilter: 'blur(10px)',
                transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-6px)')}
              onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <Tag
                    color="cyan"
                    style={{
                      fontWeight: 700,
                      borderRadius: 6,
                      padding: '2px 8px',
                      fontSize: 11,
                      letterSpacing: '0.04em',
                    }}
                  >
                    {t.services.sourcing.badgeTitle}
                  </Tag>
                  <ThunderboltOutlined style={{ fontSize: 24, color: '#14b8a6' }} />
                </div>

                <Title level={3} style={{ color: '#f8fafc', fontSize: 22, fontWeight: 700, marginBottom: 8 }}>
                  {t.services.sourcing.title}
                </Title>
                <Text style={{ color: '#2dd4bf', fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 16 }}>
                  {t.services.sourcing.subtitle}
                </Text>

                <Paragraph style={{ color: '#94a3b8', fontSize: 14, lineHeight: 1.65, minHeight: 70 }}>
                  {t.services.sourcing.description}
                </Paragraph>

                <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.08)', margin: '20px 0' }} />

                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 32 }}>
                  {t.services.sourcing.features.map((feat, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                      <CheckCircleFilled style={{ color: '#14b8a6', fontSize: 16, marginTop: 3, flexShrink: 0 }} />
                      <span style={{ color: '#cbd5e1', fontSize: 13, lineHeight: 1.5 }}>{feat}</span>
                    </div>
                  ))}
                </div>
              </div>

              <Button
                size="large"
                block
                icon={<ArrowRightOutlined />}
                onClick={() => handleSelectPackage('CV_SOURCING')}
                style={{
                  height: 48,
                  borderRadius: 12,
                  fontWeight: 600,
                  fontSize: 15,
                  background: 'rgba(20, 184, 166, 0.12)',
                  color: '#2dd4bf',
                  border: '1px solid rgba(20, 184, 166, 0.3)',
                }}
              >
                {t.services.sourcing.cta}
              </Button>
            </div>
          </Col>

          {/* Card 3: CV_APPLICATION */}
          <Col xs={24} lg={8} style={{ display: 'flex' }}>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                width: '100%',
                background: 'rgba(30, 41, 59, 0.5)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: 20,
                padding: '36px 28px',
                backdropFilter: 'blur(10px)',
                transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-6px)')}
              onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <Tag
                    color="purple"
                    style={{
                      fontWeight: 700,
                      borderRadius: 6,
                      padding: '2px 8px',
                      fontSize: 11,
                      letterSpacing: '0.04em',
                    }}
                  >
                    {t.services.application.badgeTitle}
                  </Tag>
                  <GlobalOutlined style={{ fontSize: 24, color: '#a855f7' }} />
                </div>

                <Title level={3} style={{ color: '#f8fafc', fontSize: 22, fontWeight: 700, marginBottom: 8 }}>
                  {t.services.application.title}
                </Title>
                <Text style={{ color: '#c084fc', fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 16 }}>
                  {t.services.application.subtitle}
                </Text>

                <Paragraph style={{ color: '#94a3b8', fontSize: 14, lineHeight: 1.65, minHeight: 70 }}>
                  {t.services.application.description}
                </Paragraph>

                <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.08)', margin: '20px 0' }} />

                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 32 }}>
                  {t.services.application.features.map((feat, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                      <CheckCircleFilled style={{ color: '#a855f7', fontSize: 16, marginTop: 3, flexShrink: 0 }} />
                      <span style={{ color: '#cbd5e1', fontSize: 13, lineHeight: 1.5 }}>{feat}</span>
                    </div>
                  ))}
                </div>
              </div>

              <Button
                size="large"
                block
                icon={<ArrowRightOutlined />}
                onClick={() => handleSelectPackage('CV_APPLICATION')}
                style={{
                  height: 48,
                  borderRadius: 12,
                  fontWeight: 600,
                  fontSize: 15,
                  background: 'rgba(168, 85, 247, 0.12)',
                  color: '#c084fc',
                  border: '1px solid rgba(168, 85, 247, 0.3)',
                }}
              >
                {t.services.application.cta}
              </Button>
            </div>
          </Col>
        </Row>
      </div>
    </section>
  );
};
