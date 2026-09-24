import React, { useMemo } from 'react';
import { Row, Col, Card, Typography, Button, Tag, Space, Table, Empty } from 'antd';
import {
  FileTextOutlined, TeamOutlined, TrophyOutlined, ClockCircleOutlined,
  PlusCircleOutlined, RightOutlined, ArrowUpOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { UserRole } from '@/types/roles';
import { RoleBadge } from '@/components/common/RoleBadge';
import { getJobsForClient } from '@/services/localStorageService';
import { useApplicationStore } from '@/stores/applicationStore';
import { MOCK_CANDIDATES } from '@/services/mockData';
import { ScoreTierTag } from '@/components/common/ScoreTierTag';

const { Title, Text } = Typography;

export const ClientDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, role } = useAuthStore();
  const applications = useApplicationStore((s) => s.applications);

  // Dynamic jobs for this client (matches email, company, or demo accounts)
  const clientJobs = useMemo(() => {
    return getJobsForClient(user?.email, user?.company, user?.id);
  }, [user?.email, user?.company, user?.id]);

  const activeJobs = clientJobs.filter((j) => j.status === 'ACTIVE');
  const pendingJobs = clientJobs.filter((j) => j.status === 'PENDING');

  // Match applications associated with this client's jobs
  const clientJobIds = new Set(clientJobs.map((j) => j.id));
  const clientApps = applications.filter((a) => clientJobIds.has(a.jobId));

  const totalApplicants = clientJobs.reduce((acc, j) => acc + (j.applicationCount || 0), clientApps.length);
  const totalShortlisted = clientJobs.reduce((acc, j) => acc + (j.shortlistedCount || 0), 0);

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
          background: 'linear-gradient(135deg, #0f172a, #1e293b, #0369a1)',
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
          <div style={{ color: '#94a3b8', fontSize: 13, marginBottom: 4 }}>
            {greeting}, {user?.name || 'Quý Doanh Nghiệp'}! 👋
          </div>
          <Title level={2} style={{ color: '#fff', margin: 0, fontWeight: 800 }}>
            Bảng điều khiển Tuyển dụng Doanh nghiệp
          </Title>
          <div style={{ marginTop: 8 }}>
            <RoleBadge role={role || UserRole.CLIENT} />
            {user?.company && (
              <span style={{ color: '#cbd5e1', fontSize: 13, marginLeft: 12, fontWeight: 600 }}>
                🏢 {user.company}
              </span>
            )}
          </div>
        </div>
        <Space wrap>
          <Button
            type="primary"
            icon={<PlusCircleOutlined />}
            size="large"
            onClick={() => navigate('/client/post-job')}
            style={{
              borderRadius: 8,
              fontWeight: 700,
              background: 'linear-gradient(135deg, #0284c7, #0369a1)',
              border: 'none',
              boxShadow: '0 2px 8px rgba(2, 132, 199, 0.35)',
            }}
          >
            Đăng tin tuyển dụng mới
          </Button>
          <Button
            size="large"
            icon={<FileTextOutlined />}
            onClick={() => navigate('/client/jobs')}
            style={{ borderRadius: 8, fontWeight: 600 }}
          >
            Quản lý việc làm ({clientJobs.length})
          </Button>
        </Space>
      </div>

      {/* KPI Stats Grid */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {[
          {
            label: 'Vị trí đang tuyển (Active)',
            value: activeJobs.length,
            sub: pendingJobs.length > 0 ? `+${pendingJobs.length} tin chờ HR duyệt` : 'Tất cả đã kích hoạt',
            icon: <FileTextOutlined />,
            color: '#0284c7',
            action: () => navigate('/client/jobs'),
          },
          {
            label: 'Tổng hồ sơ ứng viên nộp',
            value: totalApplicants,
            sub: 'Từ CTV & Ứng viên nộp trực tiếp',
            icon: <TeamOutlined />,
            color: '#8b5cf6',
            action: () => navigate('/client/candidates'),
          },
          {
            label: 'Đã qua phỏng vấn / Sơ loại',
            value: totalShortlisted,
            sub: 'Đạt yêu cầu vòng 1',
            icon: <TrophyOutlined />,
            color: '#10b981',
            action: () => navigate('/client/interviews-offers'),
          },
          {
            label: 'Theo dõi bảo hành tuyển dụng',
            value: 3,
            sub: 'Cam kết bảo hành 60 ngày',
            icon: <ClockCircleOutlined />,
            color: '#f59e0b',
            action: () => navigate('/client/warranty'),
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

      {/* Main Content: Jobs Table & Candidates */}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={14}>
          <Card
            title={
              <Space>
                <FileTextOutlined style={{ color: '#0284c7' }} />
                <span style={{ fontWeight: 700, fontSize: 15 }}>Tin tuyển dụng gần đây</span>
              </Space>
            }
            extra={
              <Button type="link" size="small" onClick={() => navigate('/client/jobs')} style={{ fontWeight: 600 }}>
                Xem tất cả ({clientJobs.length}) <RightOutlined />
              </Button>
            }
            style={{ borderRadius: 14, border: '1px solid #e2e8f0' }}
          >
            {clientJobs.length === 0 ? (
              <Empty
                description="Doanh nghiệp chưa đăng tin tuyển dụng nào"
                style={{ padding: '32px 0' }}
              >
                <Button type="primary" icon={<PlusCircleOutlined />} onClick={() => navigate('/client/post-job')}>
                  Đăng tin tuyển dụng đầu tiên
                </Button>
              </Empty>
            ) : (
              <Table
                dataSource={clientJobs.slice(0, 5)}
                rowKey="id"
                pagination={false}
                size="middle"
                columns={[
                  {
                    title: 'Vị trí',
                    key: 'title',
                    render: (_, record) => (
                      <div>
                        <div style={{ fontWeight: 700, color: '#0f172a' }}>{record.title}</div>
                        <div style={{ fontSize: 11, color: '#64748b' }}>
                          {record.servicePackage || 'Tuyển dụng trọn gói'} · {record.location}
                        </div>
                      </div>
                    ),
                  },
                  {
                    title: 'Trạng thái',
                    dataIndex: 'status',
                    key: 'status',
                    width: 120,
                    render: (status: string) => {
                      if (status === 'PENDING') {
                        return <Tag color="warning" style={{ borderRadius: 6, fontWeight: 600 }}>⏳ Chờ duyệt</Tag>;
                      }
                      if (status === 'ACTIVE') {
                        return <Tag color="success" style={{ borderRadius: 6, fontWeight: 600 }}>Đang tuyển</Tag>;
                      }
                      return <Tag style={{ borderRadius: 6 }}>{status}</Tag>;
                    },
                  },
                  {
                    title: 'Ứng viên',
                    key: 'apps',
                    width: 100,
                    render: (_, record) => (
                      <span style={{ fontWeight: 700, color: '#0284c7' }}>
                        {record.applicationCount || 0} hồ sơ
                      </span>
                    ),
                  },
                  {
                    title: 'Thao tác',
                    key: 'act',
                    width: 80,
                    render: (_, record) => (
                      <Button
                        type="text"
                        size="small"
                        icon={<RightOutlined />}
                        onClick={() => navigate('/client/jobs')}
                      />
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
                <TeamOutlined style={{ color: '#8b5cf6' }} />
                <span style={{ fontWeight: 700, fontSize: 15 }}>Ứng viên nổi bật cho vị trí</span>
              </Space>
            }
            extra={
              <Button type="link" size="small" onClick={() => navigate('/client/candidates')} style={{ fontWeight: 600 }}>
                Xem kho ứng viên <RightOutlined />
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
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: '#0f172a' }}>{c.name}</div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>
                    {c.currentTitle} · {c.highlightCard.yearsOfExperience} năm kinh nghiệm
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {c.aiScore !== undefined && <ScoreTierTag score={c.aiScore} showScore />}
                  <Button
                    size="small"
                    onClick={() => navigate('/client/candidates')}
                    style={{ borderRadius: 6, fontSize: 11 }}
                  >
                    Xem
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

export default ClientDashboardPage;
