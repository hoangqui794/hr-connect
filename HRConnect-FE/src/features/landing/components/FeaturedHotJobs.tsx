import React from 'react';
import { Row, Col, Typography, Tag, Button } from 'antd';
import {
  EnvironmentOutlined,
  DollarOutlined,
  GiftOutlined,
  ThunderboltOutlined,
  ArrowRightOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { ServiceType } from '@/types/job';

const { Title, Text } = Typography;

export interface FeaturedJobItem {
  id: string;
  title: string; // Job Title strictly in English
  company: string;
  location: string;
  workMode: 'Hybrid' | 'Remote' | 'On-site';
  level: 'Senior' | 'Tech Lead' | 'Lead' | 'Middle - Senior';
  salaryMin: number;
  salaryMax: number;
  serviceType: ServiceType;
  commissionRate: number; // Percentage
  estimatedCommission: string;
  tags: string[]; // Technical skills strictly in English
  isUrgent?: boolean;
}

export const FEATURED_HOT_JOBS: FeaturedJobItem[] = [
  {
    id: 'job-hot-001',
    title: 'Senior Java Backend Engineer',
    company: 'TechCorp Enterprise Solutions',
    location: 'TP. Hồ Chí Minh',
    workMode: 'Hybrid',
    level: 'Senior',
    salaryMin: 45000000,
    salaryMax: 70000000,
    serviceType: ServiceType.HEADHUNT_COD,
    commissionRate: 18,
    estimatedCommission: '12.600.000₫',
    tags: ['Java Spring Boot', 'Kafka', 'PostgreSQL', 'Microservices', 'Docker'],
    isUrgent: true,
  },
  {
    id: 'job-hot-002',
    title: 'Senior Frontend Developer (React / Next.js)',
    company: 'DigitalWave FinTech Agency',
    location: 'Hà Nội',
    workMode: 'Hybrid',
    level: 'Senior',
    salaryMin: 40000000,
    salaryMax: 65000000,
    serviceType: ServiceType.HEADHUNT_COD,
    commissionRate: 16,
    estimatedCommission: '10.400.000₫',
    tags: ['ReactJS', 'TypeScript', 'Next.js', 'TailwindCSS', 'Redux'],
    isUrgent: true,
  },
  {
    id: 'job-hot-003',
    title: 'DevOps / Platform Engineer',
    company: 'CloudNative Systems Ltd.',
    location: 'TP. Hồ Chí Minh',
    workMode: 'Remote',
    level: 'Senior',
    salaryMin: 48000000,
    salaryMax: 75000000,
    serviceType: ServiceType.HEADHUNT_COD,
    commissionRate: 20,
    estimatedCommission: '15.000.000₫',
    tags: ['Kubernetes', 'AWS', 'Terraform', 'CI/CD', 'Docker'],
  },
  {
    id: 'job-hot-004',
    title: 'Senior Data Engineer (Big Data & AI)',
    company: 'RetailGiant Global Labs',
    location: 'Hà Nội',
    workMode: 'On-site',
    level: 'Senior',
    salaryMin: 42000000,
    salaryMax: 68000000,
    serviceType: ServiceType.CV_SOURCING,
    commissionRate: 15,
    estimatedCommission: '10.200.000₫',
    tags: ['Python', 'Spark', 'Airflow', 'Snowflake', 'PostgreSQL'],
  },
  {
    id: 'job-hot-005',
    title: 'Lead Mobile Engineer (React Native / iOS)',
    company: 'HealthTech Innovations Hub',
    location: 'Đà Nẵng',
    workMode: 'Hybrid',
    level: 'Tech Lead',
    salaryMin: 50000000,
    salaryMax: 80000000,
    serviceType: ServiceType.HEADHUNT_COD,
    commissionRate: 18,
    estimatedCommission: '14.400.000₫',
    tags: ['React Native', 'Swift', 'TypeScript', 'GraphQL', 'Firebase'],
    isUrgent: true,
  },
  {
    id: 'job-hot-006',
    title: 'Senior Product Manager (PM — B2B SaaS)',
    company: 'NextGen SaaS Platform',
    location: 'TP. Hồ Chí Minh',
    workMode: 'Hybrid',
    level: 'Senior',
    salaryMin: 45000000,
    salaryMax: 70000000,
    serviceType: ServiceType.CV_APPLICATION,
    commissionRate: 12,
    estimatedCommission: '8.400.000₫',
    tags: ['Product Strategy', 'Figma', 'Agile/Scrum', 'Data Analytics', 'OKR'],
  },
];

const formatSalaryVND = (min: number, max: number) => {
  const minM = (min / 1000000).toFixed(0);
  const maxM = (max / 1000000).toFixed(0);
  return `${minM} - ${maxM} Triệu VNĐ`;
};

export const FeaturedHotJobs: React.FC = () => {
  const navigate = useNavigate();

  return (
    <section style={{ padding: '80px 24px', background: '#0b1120', position: 'relative' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        {/* Header Block */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            marginBottom: 44,
            flexWrap: 'wrap',
            gap: 20,
          }}
        >
          <div>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                background: 'rgba(2, 132, 199, 0.12)',
                border: '1px solid rgba(2, 132, 199, 0.3)',
                borderRadius: 100,
                padding: '4px 14px',
                marginBottom: 12,
              }}
            >
              <ThunderboltOutlined style={{ color: '#38bdf8' }} />
              <span style={{ color: '#38bdf8', fontSize: 12, fontWeight: 700, letterSpacing: '0.06em' }}>
                VIỆC LÀM IT NỔI BẬT & HOA HỒNG CAO
              </span>
            </div>
            <Title
              level={2}
              style={{
                color: '#f8fafc',
                fontSize: 'clamp(26px, 3.5vw, 36px)',
                fontWeight: 800,
                margin: 0,
                letterSpacing: '-0.5px',
              }}
            >
              Cơ hội Nghề nghiệp Nổi bật dành cho Tech Talent & Headhunter
            </Title>
            <Text style={{ color: '#94a3b8', fontSize: 15, display: 'block', marginTop: 8 }}>
              Hồ sơ được thẩm định trực tiếp qua hệ thống AI, nhận việc nhanh với mức đãi ngộ và hoa hồng minh bạch.
            </Text>
          </div>

          <Button
            type="link"
            onClick={() => navigate('/jobs')}
            style={{
              color: '#38bdf8',
              fontWeight: 600,
              fontSize: 15,
              padding: 0,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            Xem tất cả 120+ việc làm IT <ArrowRightOutlined />
          </Button>
        </div>

        {/* 6-Job Grid */}
        <Row gutter={[24, 24]}>
          {FEATURED_HOT_JOBS.map((job) => (
            <Col key={job.id} xs={24} md={12} lg={8} style={{ display: 'flex' }}>
              <div
                style={{
                  background: 'linear-gradient(180deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.85) 100%)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: 16,
                  padding: '24px 20px',
                  width: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  position: 'relative',
                  transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.2)',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-5px)';
                  e.currentTarget.style.borderColor = 'rgba(2, 132, 199, 0.5)';
                  e.currentTarget.style.boxShadow = '0 16px 36px rgba(2, 132, 199, 0.15)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                  e.currentTarget.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.2)';
                }}
                onClick={() => navigate('/jobs')}
              >
                <div>
                  {/* Top Badges: Service line & Urgent status */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <Tag
                        color={job.serviceType === ServiceType.HEADHUNT_COD ? 'blue' : 'cyan'}
                        style={{
                          borderRadius: 6,
                          fontSize: 11,
                          fontWeight: 700,
                          padding: '2px 8px',
                          border: 'none',
                        }}
                      >
                        {job.serviceType === ServiceType.HEADHUNT_COD && <SafetyCertificateOutlined style={{ marginRight: 4 }} />}
                        {job.serviceType}
                      </Tag>
                      <Tag
                        style={{
                          background: 'rgba(255, 255, 255, 0.08)',
                          color: '#cbd5e1',
                          borderRadius: 6,
                          fontSize: 11,
                          border: 'none',
                        }}
                      >
                        {job.level} • {job.workMode}
                      </Tag>
                    </div>

                    {job.isUrgent && (
                      <span
                        style={{
                          color: '#f43f5e',
                          fontSize: 11,
                          fontWeight: 700,
                          background: 'rgba(244, 63, 94, 0.12)',
                          padding: '2px 8px',
                          borderRadius: 100,
                          border: '1px solid rgba(244, 63, 94, 0.3)',
                        }}
                      >
                        Tuyển gấp
                      </span>
                    )}
                  </div>

                  {/* Title (strictly English as required) */}
                  <Title
                    level={4}
                    style={{
                      color: '#f8fafc',
                      fontSize: 17,
                      fontWeight: 700,
                      marginBottom: 6,
                      lineHeight: 1.35,
                    }}
                  >
                    {job.title}
                  </Title>

                  {/* Company Name */}
                  <Text style={{ color: '#94a3b8', fontSize: 13, display: 'block', marginBottom: 14 }}>
                    {job.company}
                  </Text>

                  {/* Salary & Location */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 14, flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#38bdf8', fontWeight: 700, fontSize: 14 }}>
                      <DollarOutlined />
                      <span>{formatSalaryVND(job.salaryMin, job.salaryMax)}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#94a3b8', fontSize: 13 }}>
                      <EnvironmentOutlined />
                      <span>{job.location}</span>
                    </div>
                  </div>

                  {/* Affiliate Commission Tag (Aniday-style high-conversion banner) */}
                  <div
                    style={{
                      background: 'rgba(16, 185, 129, 0.1)',
                      border: '1px solid rgba(16, 185, 129, 0.3)',
                      borderRadius: 8,
                      padding: '8px 12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: 16,
                    }}
                  >
                    <span style={{ color: '#10b981', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
                      <GiftOutlined /> Hoa hồng Headhunter ({job.commissionRate}%):
                    </span>
                    <span style={{ color: '#34d399', fontWeight: 700, fontSize: 13 }}>
                      {job.estimatedCommission}
                    </span>
                  </div>

                  {/* Technical Skills (Strictly English as required) */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 20 }}>
                    {job.tags.map((tag) => (
                      <span
                        key={tag}
                        style={{
                          background: 'rgba(255, 255, 255, 0.05)',
                          color: '#cbd5e1',
                          fontSize: 11,
                          padding: '3px 8px',
                          borderRadius: 6,
                          border: '1px solid rgba(255, 255, 255, 0.08)',
                          fontWeight: 500,
                        }}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Card Action Buttons */}
                <div style={{ display: 'flex', gap: 10, borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: 14 }}>
                  <Button
                    type="primary"
                    block
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate('/jobs');
                    }}
                    style={{
                      borderRadius: 8,
                      fontWeight: 600,
                      fontSize: 13,
                      background: 'linear-gradient(135deg, #0284c7, #0ea5e9)',
                      border: 'none',
                    }}
                  >
                    Ứng tuyển ngay
                  </Button>
                  <Button
                    block
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate('/affiliate/referral');
                    }}
                    style={{
                      borderRadius: 8,
                      fontWeight: 600,
                      fontSize: 13,
                      background: 'rgba(255, 255, 255, 0.05)',
                      color: '#34d399',
                      border: '1px solid rgba(52, 211, 153, 0.3)',
                    }}
                  >
                    Giới thiệu ứng viên
                  </Button>
                </div>
              </div>
            </Col>
          ))}
        </Row>
      </div>
    </section>
  );
};
