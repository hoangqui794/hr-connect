import React from 'react';
import { Typography, Tag, Table } from 'antd';
import { Navbar } from '@/features/landing/components/Navbar';
import { ServicePackages } from '@/features/landing/components/ServicePackages';

const { Title, Paragraph, Text } = Typography;

export const ServicesPage: React.FC = () => {

  const comparisonColumns = [
    {
      title: 'Tiêu chí so sánh',
      dataIndex: 'feature',
      key: 'feature',
      render: (text: string) => <span style={{ fontWeight: 600, color: '#f8fafc' }}>{text}</span>,
    },
    {
      title: 'Gói 1: HEADHUNT_COD',
      dataIndex: 'cod',
      key: 'cod',
      render: (text: string) => <span style={{ color: '#38bdf8', fontWeight: 600 }}>{text}</span>,
    },
    {
      title: 'Gói 2: CV_SOURCING',
      dataIndex: 'sourcing',
      key: 'sourcing',
      render: (text: string) => <span style={{ color: '#2dd4bf' }}>{text}</span>,
    },
    {
      title: 'Gói 3: CV_APPLICATION',
      dataIndex: 'app',
      key: 'app',
      render: (text: string) => <span style={{ color: '#c084fc' }}>{text}</span>,
    },
  ];

  const comparisonData = [
    {
      key: '1',
      feature: 'Thời điểm thanh toán',
      cod: '100% sau khi ứng viên qua 60 ngày thử việc',
      sourcing: 'Thanh toán theo gói hồ sơ bàn giao',
      app: 'Phí đăng tin niêm yết cố định',
    },
    {
      key: '2',
      feature: 'Chính sách bảo hành',
      cod: 'Đếm ngược 60 ngày, 1-đổi-1 miễn phí hoặc hoàn tiền',
      sourcing: 'Bảo hành thay thế CV không đạt chuẩn trong 7 ngày',
      app: 'Không áp dụng bảo hành tuyển mộ',
    },
    {
      key: '3',
      feature: 'Nguồn ứng viên',
      cod: 'Mạng lưới chuyên gia Headhunter OPR độc quyền',
      sourcing: 'Hồ sơ quét & sơ loại tự động bởi AI Semantic',
      app: 'Ứng viên tự ứng tuyển công khai trên sàn việc làm',
    },
    {
      key: '4',
      feature: 'Phí hoa hồng tuyển dụng',
      cod: '15% - 20% lương năm (chỉ tính khi thành công)',
      sourcing: '0% hoa hồng tuyển dụng',
      app: '0% hoa hồng tuyển dụng',
    },
    {
      key: '5',
      feature: 'Độ phù hợp JD',
      cod: 'Chuyên gia phỏng vấn & sàng lọc vòng 1',
      sourcing: 'AI chấm điểm 4 tầng (Đạt trên 75% tiêu chí JD)',
      app: 'Doanh nghiệp tự lọc và liên hệ',
    },
  ];

  return (
    <div style={{ background: '#0f172a', minHeight: '100vh', fontFamily: "'Inter', sans-serif" }}>
      <Navbar />

      {/* Page Header */}
      <section style={{ padding: '64px 24px 40px', textAlign: 'center' }}>
        <div style={{ maxWidth: 840, margin: '0 auto' }}>
          <Tag
            color="blue"
            style={{
              padding: '4px 14px',
              fontSize: 12,
              fontWeight: 700,
              borderRadius: 100,
              marginBottom: 16,
            }}
          >
            BẢNG GIÁ & CHÍNH SÁCH DỊCH VỤ 2026
          </Tag>
          <Title
            level={1}
            style={{
              color: '#f8fafc',
              fontSize: 'clamp(32px, 4.5vw, 48px)',
              fontWeight: 800,
              marginBottom: 16,
              letterSpacing: '-1px',
            }}
          >
            3 Mô hình Tuyển dụng Tối ưu cho Mọi Quy mô Doanh nghiệp
          </Title>
          <Paragraph style={{ color: '#94a3b8', fontSize: 16, lineHeight: 1.7 }}>
            HR Connect giải quyết bài toán tuyển dụng nhân sự cấp trung và cao cấp thông qua mạng lưới Affiliate Headhunter kết hợp công nghệ thẩm định AI. Chọn gói dịch vụ phù hợp nhất với ngân sách và chiến lược của bạn.
          </Paragraph>
        </div>
      </section>

      {/* 3 Core Packages Card Section */}
      <ServicePackages />

      {/* Deep Comparison Table */}
      <section style={{ padding: '64px 24px 96px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <Title level={2} style={{ color: '#f8fafc', fontSize: 28, fontWeight: 700 }}>
              Bảng so sánh Chi tiết Tính năng & Quyền lợi
            </Title>
            <Text style={{ color: '#94a3b8', fontSize: 15 }}>
              Đối chiếu quyền lợi giữa các mô hình để đưa ra lựa chọn tối ưu nhất cho kế hoạch tuyển dụng.
            </Text>
          </div>

          <div
            style={{
              background: 'rgba(30, 41, 59, 0.6)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: 16,
              overflow: 'hidden',
              padding: 16,
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)',
            }}
          >
            <Table
              columns={comparisonColumns}
              dataSource={comparisonData}
              pagination={false}
              bordered={false}
              style={{ background: 'transparent' }}
            />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer
        style={{
          padding: '28px 40px',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          textAlign: 'center',
          color: '#64748b',
          fontSize: 13,
        }}
      >
        © 2026 HR Connect. Nền tảng Tuyển dụng Thông minh & Mạng lưới Affiliate Headhunter.
      </footer>
    </div>
  );
};
