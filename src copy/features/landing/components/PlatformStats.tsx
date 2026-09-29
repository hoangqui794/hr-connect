import React from 'react';
import { Row, Col } from 'antd';

export const PlatformStats: React.FC = () => {
  const stats = [
    { value: '500+', label: 'Doanh nghiệp đối tác' },
    { value: '1.200+', label: 'Headhunter OPR' },
    { value: '85%', label: 'Tỷ lệ khớp AI' },
    { value: '60 Ngày', label: 'Cam kết bảo hành' },
  ];

  return (
    <div
      style={{
        background: 'rgba(255, 255, 255, 0.02)',
        borderTop: '1px solid rgba(255, 255, 255, 0.06)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
        padding: '36px 24px',
      }}
    >
      <div style={{ maxWidth: 1160, margin: '0 auto' }}>
        <Row gutter={[20, 24]} justify="center">
          {stats.map((stat, i) => (
            <Col
              key={i}
              xs={12}
              sm={6}
              style={{
                textAlign: 'center',
                padding: '8px 24px',
                borderRight: i < 3 ? '1px solid rgba(255, 255, 255, 0.06)' : 'none',
              }}
            >
              <div
                style={{
                  fontSize: 'clamp(28px, 4vw, 36px)',
                  fontWeight: 800,
                  color: '#38bdf8',
                  lineHeight: 1.1,
                  letterSpacing: '-0.5px',
                  marginBottom: 6,
                }}
              >
                {stat.value}
              </div>
              <div style={{ fontSize: 14, color: '#94a3b8', fontWeight: 500 }}>
                {stat.label}
              </div>
            </Col>
          ))}
        </Row>
      </div>
    </div>
  );
};
