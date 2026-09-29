import React from 'react';
import { Button, Tag } from 'antd';
import { ArrowRightOutlined, SafetyCertificateOutlined, ThunderboltOutlined, GlobalOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

export const ServiceBanner: React.FC = () => {
  const navigate = useNavigate();

  return (
    <section
      style={{
        padding: '36px 24px',
        background: 'linear-gradient(90deg, #091326 0%, #0e2042 50%, #091326 100%)',
        borderTop: '1px solid rgba(2, 132, 199, 0.25)',
        borderBottom: '1px solid rgba(2, 132, 199, 0.25)',
      }}
    >
      <div
        style={{
          maxWidth: 1200,
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 20,
        }}
      >
        {/* Left: Models Summary */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 44,
              height: 44,
              borderRadius: 12,
              background: 'linear-gradient(135deg, #0284c7, #0ea5e9)',
              color: '#fff',
              fontSize: 20,
              boxShadow: '0 4px 12px rgba(2, 132, 199, 0.4)',
            }}
          >
            <SafetyCertificateOutlined />
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
              <span style={{ color: '#f8fafc', fontWeight: 700, fontSize: 16 }}>
                3 Mô hình Tuyển dụng Linh hoạt cho Doanh nghiệp:
              </span>
              <Tag color="blue" style={{ fontWeight: 600, borderRadius: 4 }}>
                <SafetyCertificateOutlined style={{ marginRight: 4 }} />
                HEADHUNT_COD (Bảo hành 60 ngày)
              </Tag>
              <Tag color="cyan" style={{ fontWeight: 600, borderRadius: 4 }}>
                <ThunderboltOutlined style={{ marginRight: 4 }} />
                CV_SOURCING (Sơ tuyển AI)
              </Tag>
              <Tag color="purple" style={{ fontWeight: 600, borderRadius: 4 }}>
                <GlobalOutlined style={{ marginRight: 4 }} />
                CV_APPLICATION (Sàn tuyển mở)
              </Tag>
            </div>
            <span style={{ color: '#94a3b8', fontSize: 13 }}>
              Cam kết trả sau khi thử việc thành công, bảo hành 1-đổi-1 miễn phí hoặc hoàn phí minh bạch.
            </span>
          </div>
        </div>

        {/* Right: CTA Button */}
        <div>
          <Button
            type="primary"
            size="large"
            onClick={() => navigate('/services')}
            style={{
              height: 44,
              padding: '0 24px',
              borderRadius: 10,
              fontWeight: 600,
              fontSize: 14,
              background: 'linear-gradient(135deg, #0284c7, #0ea5e9)',
              border: 'none',
              boxShadow: '0 4px 14px rgba(2, 132, 199, 0.35)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            Tìm hiểu Bảng giá & Chi tiết <ArrowRightOutlined />
          </Button>
        </div>
      </div>
    </section>
  );
};
