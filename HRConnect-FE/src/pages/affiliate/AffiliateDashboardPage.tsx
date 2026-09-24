import React, { useMemo } from 'react';
import { Row, Col, Card, Typography, Button, Tag, Space, Table, Empty, Progress } from 'antd';
import {
  DollarOutlined, TeamOutlined, TrophyOutlined, CheckCircleOutlined,
  PlusCircleOutlined, RightOutlined, ArrowUpOutlined, FileTextOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { UserRole } from '@/types/roles';
import { RoleBadge } from '@/components/common/RoleBadge';
import { useApplicationStore, APPLICATION_STATUS_LABELS, APPLICATION_STATUS_COLORS } from '@/stores/applicationStore';
import { getAllJobs } from '@/services/localStorageService';
import { MOCK_COMMISSIONS, MOCK_LEDGER_SUMMARY } from '@/services/mockData';
import { PayoutStatusBadge } from '@/components/common/StatusBadge';

const { Title, Text } = Typography;

export const AffiliateDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, role } = useAuthStore();
  const applications = useApplicationStore((s) => s.applications);

  // Submissions made by this affiliate
  const mySubmissions = useMemo(() => {
    if (!user?.email) return [];
    const normalized = user.email.toLowerCase();
    return applications.filter(
      (a) =>
        (a.affiliateEmail && a.affiliateEmail.toLowerCase() === normalized) ||
        (a.source === 'AFFILIATE' && (normalized.includes('cvt5') || normalized.includes('affiliate') || normalized.includes('david.tran')))
    );
  }, [user?.email, applications]);

  // Active jobs on the platform
  const activeJobs = useMemo(() => {
    return getAllJobs().filter((j) => j.status === 'ACTIVE');
  }, []);

  const totalEarned = 135000000;
  const payableAmount = 45000000;
  const pendingAmount = 90000000;

  return (
    <div style={{ padding: '0 4px' }}>
      {/* Header Banner */}
      <div
        style={{
          background: 'linear-gradient(135deg, #0f172a, #1e293b, #b45309)',
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
          <div style={{ color: '#fed7aa', fontSize: 13, marginBottom: 4 }}>
            Chào mừng trở lại, {user?.name || 'Đối tác Tuyển dụng'}! 👋
          </div>
          <Title level={2} style={{ color: '#fff', margin: 0, fontWeight: 800 }}>
            Trung Tâm Cộng Tác Viên &amp; Headhunter (OPR)
          </Title>
          <div style={{ marginTop: 8 }}>
            <RoleBadge role={role || UserRole.AFFILIATE} />
            <span style={{ color: '#fef3c7', fontSize: 13, marginLeft: 12, fontWeight: 600 }}>
              ⭐ Điểm uy tín: 4.9/5.0 (Bảo chứng bởi HR Connect)
            </span>
          </div>
        </div>
        <Space wrap>
          <Button
            type="primary"
            icon={<PlusCircleOutlined />}
            size="large"
            onClick={() => navigate('/affiliate/referral')}
            style={{
              borderRadius: 8,
              fontWeight: 700,
              background: 'linear-gradient(135deg, #f59e0b, #d97706)',
              border: 'none',
              boxShadow: '0 2px 8px rgba(245, 158, 11, 0.35)',
            }}
          >
            Giới thiệu ứng viên mới
          </Button>
          <Button
            size="large"
            icon={<FileTextOutlined />}
            onClick={() => navigate('/affiliate/jobs')}
            style={{ borderRadius: 8, fontWeight: 600 }}
          >
            Xem việc làm hoa hồng cao
          </Button>
        </Space>
      </div>

      {/* Financial KPIs */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {[
          {
            label: 'Tổng hoa hồng tích lũy',
            value: `${totalEarned.toLocaleString('vi-VN')} đ`,
            sub: 'Đã hoàn thành bảo hành',
            icon: <DollarOutlined />,
            color: '#0284c7',
            action: () => navigate('/affiliate/commissions'),
          },
          {
            label: 'Đủ điều kiện rút ngay',
            value: `${payableAmount.toLocaleString('vi-VN')} đ`,
            sub: 'Admin đã duyệt thanh toán',
            icon: <CheckCircleOutlined />,
            color: '#10b981',
            action: () => navigate('/affiliate/commissions'),
          },
          {
            label: 'Đang bảo hành (60 ngày COD)',
            value: `${pendingAmount.toLocaleString('vi-VN')} đ`,
            sub: 'Ứng viên đang thử việc',
            icon: <TrophyOutlined />,
            color: '#f59e0b',
            action: () => navigate('/affiliate/commissions'),
          },
          {
            label: 'Hồ sơ đã giới thiệu',
            value: mySubmissions.length > 0 ? mySubmissions.length : 12,
            sub: 'Theo dõi tiến độ phỏng vấn',
            icon: <TeamOutlined />,
            color: '#8b5cf6',
            action: () => navigate('/affiliate/submissions'),
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
              <div style={{ fontSize: 26, fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>{stat.value}</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#475569', marginTop: 8 }}>{stat.label}</div>
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>{stat.sub}</div>
            </div>
          </Col>
        ))}
      </Row>

      {/* Main Content */}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={14}>
          <Card
            title={
              <Space>
                <TeamOutlined style={{ color: '#f59e0b' }} />
                <span style={{ fontWeight: 700, fontSize: 15 }}>Hồ sơ ứng viên vừa giới thiệu</span>
              </Space>
            }
            extra={
              <Button type="link" size="small" onClick={() => navigate('/affiliate/submissions')} style={{ fontWeight: 600 }}>
                Xem tất cả ({mySubmissions.length}) <RightOutlined />
              </Button>
            }
            style={{ borderRadius: 14, border: '1px solid #e2e8f0' }}
          >
            {mySubmissions.length === 0 ? (
              <Empty description="Bạn chưa giới thiệu ứng viên nào" style={{ padding: '32px 0' }}>
                <Button type="primary" onClick={() => navigate('/affiliate/referral')}>
                  Giới thiệu ứng viên đầu tiên
                </Button>
              </Empty>
            ) : (
              <Table
                dataSource={mySubmissions.slice(0, 5)}
                rowKey="id"
                pagination={false}
                size="middle"
                columns={[
                  {
                    title: 'Ứng viên',
                    key: 'candidate',
                    render: (_, record) => (
                      <div>
                        <div style={{ fontWeight: 700, color: '#0f172a' }}>{record.fullName}</div>
                        <div style={{ fontSize: 11, color: '#64748b' }}>{record.email} · {record.phone}</div>
                      </div>
                    ),
                  },
                  {
                    title: 'Vị trí ứng tuyển',
                    key: 'job',
                    render: (_, record) => (
                      <div>
                        <div style={{ fontWeight: 600, color: '#334155' }}>{record.jobTitle}</div>
                        <div style={{ fontSize: 11, color: '#64748b' }}>{record.company}</div>
                      </div>
                    ),
                  },
                  {
                    title: 'Trạng thái',
                    key: 'status',
                    width: 140,
                    render: (_, record) => (
                      <Tag
                        style={{
                          borderRadius: 6,
                          fontWeight: 600,
                          fontSize: 11,
                          color: APPLICATION_STATUS_COLORS[record.status] || '#64748b',
                          background: `${APPLICATION_STATUS_COLORS[record.status] || '#64748b'}15`,
                          border: `1px solid ${APPLICATION_STATUS_COLORS[record.status] || '#64748b'}40`,
                        }}
                      >
                        {APPLICATION_STATUS_LABELS[record.status] || record.status}
                      </Tag>
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
                <DollarOutlined style={{ color: '#0284c7' }} />
                <span style={{ fontWeight: 700, fontSize: 15 }}>Cơ hội việc làm hoa hồng cao</span>
              </Space>
            }
            extra={
              <Button type="link" size="small" onClick={() => navigate('/affiliate/jobs')} style={{ fontWeight: 600 }}>
                Khám phá sàn việc làm <RightOutlined />
              </Button>
            }
            style={{ borderRadius: 14, border: '1px solid #e2e8f0' }}
          >
            {activeJobs.slice(0, 4).map((j) => (
              <div
                key={j.id}
                style={{
                  padding: '12px 0',
                  borderBottom: '1px solid #f1f5f9',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: '#0f172a' }}>{j.title}</div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>{j.company} · {j.location}</div>
                  <div style={{ marginTop: 4, display: 'flex', gap: 6 }}>
                    <Tag color="gold" style={{ borderRadius: 4, fontWeight: 700, fontSize: 10 }}>
                      Hoa hồng {j.engagementTerms?.commissionRate || 15}%
                    </Tag>
                  </div>
                </div>
                <Button
                  type="primary"
                  size="small"
                  onClick={() => navigate('/affiliate/referral')}
                  style={{
                    borderRadius: 6,
                    fontWeight: 600,
                    background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                    border: 'none',
                  }}
                >
                  Giới thiệu
                </Button>
              </div>
            ))}
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default AffiliateDashboardPage;
