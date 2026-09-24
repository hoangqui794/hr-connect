import React, { useMemo } from 'react';
import { Row, Col, Card, Typography, Button, Tag, Space, Table, Empty, Avatar } from 'antd';
import {
  RobotOutlined, TeamOutlined, FileTextOutlined, CheckCircleOutlined,
  ClockCircleOutlined, TrophyOutlined, RightOutlined, ArrowUpOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { UserRole } from '@/types/roles';
import { RoleBadge } from '@/components/common/RoleBadge';
import { getAllJobs } from '@/services/localStorageService';
import { useApplicationStore } from '@/stores/applicationStore';
import { MOCK_CANDIDATES } from '@/services/mockData';
import { ScoreTierTag } from '@/components/common/ScoreTierTag';

const { Title, Text } = Typography;

export const HRDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, role } = useAuthStore();
  const applications = useApplicationStore((s) => s.applications);

  const allJobs = useMemo(() => getAllJobs(), []);
  const pendingJobs = useMemo(() => allJobs.filter((j) => j.status === 'PENDING'), [allJobs]);
  const activeJobs = useMemo(() => allJobs.filter((j) => j.status === 'ACTIVE'), [allJobs]);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Chào buổi sáng';
    if (hour < 18) return 'Chào buổi chiều';
    return 'Chào buổi tối';
  }, []);

  return (
    <div style={{ padding: '0 4px' }}>
      {/* Header Banner */}
      <div
        style={{
          background: 'linear-gradient(135deg, #0f172a, #1e293b, #047857)',
          borderRadius: 16,
          padding: '24px 28px',
          marginBottom: 24,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 16,
          boxShadow: '0 4px 20px -2px rgba(0, 0, 0, 0.1)',
        }}
      >
        <div>
          <div style={{ color: '#a7f3d0', fontSize: 13, marginBottom: 4 }}>
            {greeting}, {user?.name || 'HR Specialist'}! 👋
          </div>
          <Title level={2} style={{ color: '#fff', margin: 0, fontWeight: 800 }}>
            Trung Tâm Vận Hành Tuyển Dụng &amp; Sàng Lọc AI (Internal HR)
          </Title>
          <div style={{ marginTop: 8 }}>
            <RoleBadge role={role || UserRole.INTERNAL_HR} />
            <span style={{ color: '#ecfdf5', fontSize: 13, marginLeft: 12, fontWeight: 600 }}>
              🛡️ Đảm bảo SLA 48h kiểm duyệt việc làm &amp; đối soát ứng viên
            </span>
          </div>
        </div>
        <Space wrap>
          <Button
            type="primary"
            icon={<FileTextOutlined />}
            size="large"
            onClick={() => navigate('/hr/jobs')}
            style={{
              borderRadius: 8,
              fontWeight: 700,
              background: 'linear-gradient(135deg, #10b981, #059669)',
              border: 'none',
              boxShadow: '0 2px 8px rgba(16, 185, 129, 0.35)',
            }}
          >
            Duyệt tin tuyển dụng ({pendingJobs.length} tin chờ)
          </Button>
          <Button
            size="large"
            icon={<RobotOutlined />}
            onClick={() => navigate('/hr/screening')}
            style={{ borderRadius: 8, fontWeight: 600 }}
          >
            Mở công cụ Sàng lọc AI
          </Button>
        </Space>
      </div>

      {/* Operational KPIs */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {[
          {
            label: 'Tin tuyển dụng chờ duyệt',
            value: pendingJobs.length,
            sub: pendingJobs.length > 0 ? 'Cần duyệt để hiển thị lên sàn' : 'Không có tin tồn đọng',
            icon: <ClockCircleOutlined />,
            color: '#ef4444',
            action: () => navigate('/hr/jobs'),
          },
          {
            label: 'Việc làm đang hoạt động (Sàn)',
            value: activeJobs.length,
            sub: 'Affiliate & Ứng viên đang nộp',
            icon: <FileTextOutlined />,
            color: '#0284c7',
            action: () => navigate('/hr/jobs'),
          },
          {
            label: 'Hồ sơ chờ sàng lọc AI',
            value: applications.length > 0 ? applications.length : 18,
            sub: 'Chấm điểm ATS tự động',
            icon: <RobotOutlined />,
            color: '#8b5cf6',
            action: () => navigate('/hr/screening'),
          },
          {
            label: 'Lịch phỏng vấn tuần này',
            value: 6,
            sub: 'Đã xếp lịch với Doanh nghiệp',
            icon: <TrophyOutlined />,
            color: '#10b981',
            action: () => navigate('/hr/interviews'),
          },
        ].map((stat) => (
          <Col key={stat.label} xs={12} sm={6}>
            <div
              className="hrc-stat-card"
              onClick={stat.action}
              style={{
                cursor: 'pointer',
                background: '#fff',
                borderRadius: 14,
                padding: '20px',
                border: '1px solid #e2e8f0',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
                transition: 'all 0.2s ease',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 10,
                    background: `${stat.color}15`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: stat.color,
                    fontSize: 20,
                  }}
                >
                  {stat.icon}
                </div>
                <ArrowUpOutlined style={{ color: '#10b981', fontSize: 13 }} />
              </div>
              <div style={{ fontSize: 30, fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>{stat.value}</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#475569', marginTop: 8 }}>{stat.label}</div>
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>{stat.sub}</div>
            </div>
          </Col>
        ))}
      </Row>

      {/* Main Content: Pending Jobs & Screening Queue */}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={14}>
          <Card
            title={
              <Space>
                <ClockCircleOutlined style={{ color: '#ef4444' }} />
                <span style={{ fontWeight: 700, fontSize: 15 }}>Hàng đợi duyệt tin tuyển dụng Doanh nghiệp</span>
              </Space>
            }
            extra={
              <Button type="link" size="small" onClick={() => navigate('/hr/jobs')} style={{ fontWeight: 600 }}>
                Quản lý tất cả việc làm <RightOutlined />
              </Button>
            }
            style={{ borderRadius: 14, border: '1px solid #e2e8f0' }}
          >
            {pendingJobs.length === 0 ? (
              <Empty description="Tuyệt vời! Hiện không có tin tuyển dụng nào chờ duyệt" style={{ padding: '32px 0' }}>
                <Button onClick={() => navigate('/hr/jobs')}>Xem danh sách tin đang mở</Button>
              </Empty>
            ) : (
              <Table
                dataSource={pendingJobs}
                rowKey="id"
                pagination={false}
                size="middle"
                columns={[
                  {
                    title: 'Tin tuyển dụng',
                    key: 'job',
                    render: (_, record) => (
                      <div>
                        <div style={{ fontWeight: 700, color: '#0f172a' }}>{record.title}</div>
                        <div style={{ fontSize: 11, color: '#64748b' }}>{record.company} · {record.location}</div>
                      </div>
                    ),
                  },
                  {
                    title: 'Trạng thái',
                    dataIndex: 'status',
                    key: 'status',
                    width: 130,
                    render: () => <Tag color="warning" style={{ borderRadius: 6, fontWeight: 600 }}>⏳ Chờ HR duyệt</Tag>,
                  },
                  {
                    title: 'Thao tác',
                    key: 'action',
                    width: 100,
                    render: (_, record) => (
                      <Button
                        type="primary"
                        size="small"
                        onClick={() => navigate('/hr/jobs')}
                        style={{
                          borderRadius: 6,
                          fontWeight: 600,
                          background: 'linear-gradient(135deg, #10b981, #059669)',
                          border: 'none',
                        }}
                      >
                        Xem &amp; Duyệt
                      </Button>
                    ),
                  },
                ]}
              />
            )}
          </Card>
        </Col>

        <Col xs={24} lg={10}>
          <Card
            title={
              <Space>
                <RobotOutlined style={{ color: '#0284c7' }} />
                <span style={{ fontWeight: 700, fontSize: 15 }}>Hàng đợi Sàng lọc Ứng viên AI</span>
              </Space>
            }
            extra={
              <Button type="link" size="small" onClick={() => navigate('/hr/screening')} style={{ fontWeight: 600 }}>
                Chi tiết sàng lọc <RightOutlined />
              </Button>
            }
            style={{ borderRadius: 14, border: '1px solid #e2e8f0' }}
          >
            {MOCK_CANDIDATES.slice(0, 4).map((c) => (
              <div
                key={c.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 0',
                  borderBottom: '1px solid #f1f5f9',
                }}
              >
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <Avatar style={{ background: '#8b5cf6', fontWeight: 700 }}>{c.name.slice(0, 2)}</Avatar>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13, color: '#0f172a' }}>{c.name}</div>
                    <div style={{ fontSize: 11, color: '#64748b' }}>{c.currentTitle}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {c.aiScore !== undefined && <ScoreTierTag score={c.aiScore} showScore />}
                  <Button
                    size="small"
                    onClick={() => navigate('/hr/screening')}
                    style={{ borderRadius: 6, fontSize: 11 }}
                  >
                    Đánh giá
                  </Button>
                </div>
              </div>
            ))}
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default HRDashboardPage;
