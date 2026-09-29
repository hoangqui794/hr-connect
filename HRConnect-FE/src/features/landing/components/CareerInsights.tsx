import React from 'react';
import { Row, Col, Typography, Tag, Button } from 'antd';
import { ArrowRightOutlined, BookOutlined, ClockCircleOutlined, UserOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

const { Title, Paragraph, Text } = Typography;

interface ArticleItem {
  id: string;
  category: string;
  categoryColor: string;
  title: string;
  excerpt: string;
  author: string;
  readTime: string;
  date: string;
  imageBg: string;
}

const ARTICLES: ArticleItem[] = [
  {
    id: 'art-01',
    category: 'Báo Cáo Thị Trường',
    categoryColor: 'blue',
    title: 'Báo cáo Thị trường Tuyển dụng IT Việt Nam 2026: Dải lương & Xu hướng Kỹ năng Hot',
    excerpt: 'Tổng hợp mức lương thực tế cho các vị trí Backend, Frontend, DevOps, AI Engineer cùng dự báo nhu cầu tuyển dụng trong nửa cuối năm.',
    author: 'Ban Nghiên cứu HR Connect',
    readTime: '6 phút đọc',
    date: '15/09/2026',
    imageBg: 'linear-gradient(135deg, #1e40af, #2563eb)',
  },
  {
    id: 'art-02',
    category: 'Kinh Nghiệm Phỏng Vấn',
    categoryColor: 'green',
    title: 'Bí quyết Phỏng vấn Vị trí Senior Backend: Tối ưu Hệ thống Tải cao & Microservices',
    excerpt: 'Các tình huống System Design thực chiến, phương pháp trả lời các câu hỏi hóc búa về Database Sharding, Caching Strategy và Kafka Message Queue.',
    author: 'Tech Lead Advisory Council',
    readTime: '8 phút đọc',
    date: '12/09/2026',
    imageBg: 'linear-gradient(135deg, #065f46, #059669)',
  },
  {
    id: 'art-03',
    category: 'Cẩm Nang OPR Hub',
    categoryColor: 'purple',
    title: 'Cẩm nang dành cho Headhunter OPR: Bí quyết Tăng Tỷ lệ Giới thiệu Ứng viên Thành công',
    excerpt: 'Hướng dẫn sử dụng công cụ AI Sàng lọc để chấm điểm hồ sơ trước khi nộp, tận dụng luật First-Submission và quản lý bảo hành 60 ngày an toàn.',
    author: 'OPR Network Management',
    readTime: '5 phút đọc',
    date: '08/09/2026',
    imageBg: 'linear-gradient(135deg, #4c1d95, #7c3aed)',
  },
];

export const CareerInsights: React.FC = () => {
  const navigate = useNavigate();

  return (
    <section style={{ padding: '80px 24px 100px', background: '#F8FAFC', position: 'relative', borderTop: '1px solid rgba(226, 232, 240, 0.85)' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            marginBottom: 44,
            flexWrap: 'wrap',
            gap: 16,
          }}
        >
          <div>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                background: '#eff6ff',
                border: '1px solid #bfdbfe',
                borderRadius: 100,
                padding: '4px 14px',
                marginBottom: 12,
              }}
            >
              <BookOutlined style={{ color: '#2563eb' }} />
              <span style={{ color: '#1d4ed8', fontSize: 12, fontWeight: 700, letterSpacing: '0.06em' }}>
                CẨM NANG & THỊ TRƯỜNG IT
              </span>
            </div>
            <Title
              level={2}
              style={{
                color: '#0f172a',
                fontSize: 'clamp(26px, 3.5vw, 36px)',
                fontWeight: 800,
                margin: 0,
                letterSpacing: '-0.5px',
              }}
            >
              Cẩm nang Tuyển dụng & Xu hướng Công nghệ
            </Title>
            <Text style={{ color: '#64748b', fontSize: 15, display: 'block', marginTop: 8 }}>
              Kiến thức thực chiến, dữ liệu báo cáo chuyên sâu giúp ứng viên phát triển sự nghiệp và nhà tuyển dụng tối ưu hóa phễu tìm kiếm.
            </Text>
          </div>

          <Button
            type="link"
            onClick={() => navigate('/jobs')}
            style={{
              color: '#2563eb',
              fontWeight: 600,
              fontSize: 15,
              padding: 0,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            Xem thêm bài viết <ArrowRightOutlined />
          </Button>
        </div>

        {/* 3-Article Grid */}
        <Row gutter={[28, 28]}>
          {ARTICLES.map((article) => (
            <Col key={article.id} xs={24} md={8} style={{ display: 'flex' }}>
              <div
                style={{
                  background: 'rgba(255, 255, 255, 0.88)',
                  border: '1px solid rgba(226, 232, 240, 0.85)',
                  borderRadius: 16,
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  width: '100%',
                  transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                  boxShadow: '0 2px 12px -2px rgba(0, 0, 0, 0.04)',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-4px)';
                  e.currentTarget.style.borderColor = 'rgba(37, 99, 235, 0.35)';
                  e.currentTarget.style.boxShadow = '0 12px 28px -4px rgba(37, 99, 235, 0.08)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.borderColor = 'rgba(226, 232, 240, 0.85)';
                  e.currentTarget.style.boxShadow = '0 2px 12px -2px rgba(0, 0, 0, 0.04)';
                }}
              >
                {/* Visual Header Banner */}
                <div
                  style={{
                    height: 120,
                    background: article.imageBg,
                    padding: '16px 20px',
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    position: 'relative',
                  }}
                >
                  <Tag
                    color={article.categoryColor}
                    style={{
                      borderRadius: 100,
                      padding: '2px 10px',
                      fontSize: 11,
                      fontWeight: 700,
                    }}
                  >
                    {article.category}
                  </Tag>
                  <span style={{ color: 'rgba(255, 255, 255, 0.9)', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <ClockCircleOutlined /> {article.readTime}
                  </span>
                </div>

                {/* Content */}
                <div style={{ padding: '24px 20px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    <Title
                      level={4}
                      style={{
                        color: '#0f172a',
                        fontSize: 17,
                        fontWeight: 700,
                        lineHeight: 1.4,
                        marginBottom: 10,
                      }}
                    >
                      {article.title}
                    </Title>
                    <Paragraph
                      style={{
                        color: '#64748b',
                        fontSize: 13,
                        lineHeight: 1.6,
                        marginBottom: 20,
                      }}
                    >
                      {article.excerpt}
                    </Paragraph>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      borderTop: '1px solid rgba(241, 245, 249, 0.9)',
                      paddingTop: 14,
                    }}
                  >
                    <span style={{ color: '#94a3b8', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <UserOutlined /> {article.author}
                    </span>
                    <span style={{ color: '#2563eb', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                      Đọc tiếp <ArrowRightOutlined style={{ fontSize: 11 }} />
                    </span>
                  </div>
                </div>
              </div>
            </Col>
          ))}
        </Row>
      </div>
    </section>
  );
};
