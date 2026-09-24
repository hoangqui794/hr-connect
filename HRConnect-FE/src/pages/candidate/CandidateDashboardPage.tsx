import React, { useMemo } from 'react';
import { Row, Col, Card, Typography, Button, Tag, Space, Table, Empty } from 'antd';
import {
  FileTextOutlined, TrophyOutlined, TeamOutlined, ClockCircleOutlined,
  SearchOutlined, ArrowUpOutlined, RightOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { useCandidateStore } from '@/stores/candidateStore';
import { useApplicationStore, APPLICATION_STATUS_LABELS, APPLICATION_STATUS_COLORS } from '@/stores/applicationStore';
import { UserRole } from '@/types/roles';
import { RoleBadge } from '@/components/common/RoleBadge';
import { getAllJobs } from '@/services/localStorageService';

const { Title, Text } = Typography;

export const CandidateDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, role } = useAuthStore();
  const { cvs, applications: storeApps, savedJobs, interviews } = useCandidateStore();
  const sharedApps = useApplicationStore((s) => s.applications);

  const currentUserEmail = (user?.email || '').toLowerCase().trim();

  // Applications matching candidate's email (e.g. ungvien5@gmail.com)
  const mySharedApps = useMemo(() => {
    if (!currentUserEmail) return [];
    return sharedApps.filter((a) => {
      const email = ((a as any).candidateEmail || a.email || '').toLowerCase().trim();
      return email === currentUserEmail;
    });
  }, [currentUserEmail, sharedApps]);

  const myStoreApps = useMemo(() => {
    if (!currentUserEmail) return [];
    return (storeApps || []).filter((a) => {
      const email = (a.candidateEmail || a.applicantEmail || '').toLowerCase().trim();
      return email === currentUserEmail;
    });
  }, [currentUserEmail, storeApps]);

  const allMyApps = useMemo(() => {
    const fromShared = mySharedApps.map((a) => ({
      id: a.id,
      jobTitle: a.jobTitle,
      company: a.company,
      appliedDate: new Date(a.applyDate).toLocaleDateString('vi-VN'),
      status: a.status as string,
      statusLabel: APPLICATION_STATUS_LABELS[a.status] || a.status,
      statusColor: APPLICATION_STATUS_COLORS[a.status] || '#64748b',
    }));
    const fromStore = myStoreApps.map((a) => ({
      id: a.id,
      jobTitle: a.jobTitle,
      company: a.company,
      appliedDate: a.appliedDate,
      status: a.status,
      statusLabel: a.statusLabel,
      statusColor: a.statusColor,
    }));
    return [...fromShared, ...fromStore];
  }, [mySharedApps, myStoreApps]);

  // Deduplicate by jobTitle + company
  const dedupedApps = useMemo(() => {
    const seen = new Set<string>();
    return allMyApps.filter((a) => {
      const key = `${a.jobTitle}__${a.company}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [allMyApps]);

  // Stat 1: Applications & referrals count (0 for new user)
  const myApplicationsCount = dedupedApps.length;

  // Stat 2: Scheduled interviews for this candidate (0 for new user)
  const interviewCount = useMemo(() => {
    const fromShared = mySharedApps.filter(
      (a) => a.status === 'INTERVIEW_SCHEDULED'
    ).length;
    const fromCandidateStore = (interviews || []).filter((i) => {
      const email = (i.candidateEmail || i.applicantEmail || '').toLowerCase().trim();
      const status = i.status || 'SCHEDULED';
      return email === currentUserEmail && (status === 'SCHEDULED' || status === 'UPCOMING');
    }).length;
    return fromShared + fromCandidateStore;
  }, [mySharedApps, interviews, currentUserEmail]);

  // Stat 3: Saved jobs for this candidate (0 for new user)
  const userSavedJobsCount = useMemo(() => {
    if (!currentUserEmail) return 0;
    try {
      const userKey = `hrconnect_saved_jobs_${currentUserEmail}`;
      const raw = localStorage.getItem(userKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed.length;
      }
    } catch {}
    const list = savedJobs || [];
    return list.filter((j) => (j.userEmail || '').toLowerCase().trim() === currentUserEmail).length;
  }, [currentUserEmail, savedJobs]);

  // Stat 4: CVs created/uploaded by this candidate (0 for new user, no fallback)
  const userCVsCount = useMemo(() => {
    if (!currentUserEmail) return 0;
    return (cvs || []).filter((c) => (c.userEmail || '').toLowerCase().trim() === currentUserEmail).length;
  }, [currentUserEmail, cvs]);

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
          background: 'linear-gradient(135deg, #0f172a, #1e293b, #6b21a8)',
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
          <div style={{ color: '#e9d5ff', fontSize: 13, marginBottom: 4 }}>
            {greeting}, {user?.name || 'Bạn'}! 👋
          </div>
          <Title level={2} style={{ color: '#fff', margin: 0, fontWeight: 800 }}>
            Không Gian Ứng Viên &amp; Phát Triển Sự Nghiệp
          </Title>
          <div style={{ marginTop: 8 }}>
            <RoleBadge role={role || UserRole.CANDIDATE} />
            <span style={{ color: '#f3e8ff', fontSize: 13, marginLeft: 12, fontWeight: 600 }}>
              🎯 Hồ sơ chuẩn ATS giúp tăng 80% tỷ lệ vượt qua vòng sơ loại
            </span>
          </div>
        </div>
        <Space wrap>
          <Button
            type="primary"
            icon={<SearchOutlined />}
            size="large"
            onClick={() => navigate('/jobs')}
            style={{
              borderRadius: 8,
              fontWeight: 700,
              background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
              border: 'none',
              boxShadow: '0 2px 8px rgba(139, 92, 246, 0.35)',
            }}
          >
            Tìm kiếm việc làm ngay
          </Button>
          <Button
            size="large"
            icon={<FileTextOutlined />}
            onClick={() => navigate('/cv-builder')}
            style={{ borderRadius: 8, fontWeight: 600 }}
          >
            Tạo CV chuyên nghiệp
          </Button>
        </Space>
      </div>

      {/* Stats Grid */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {[
          {
            label: 'Đơn ứng tuyển & Giới thiệu',
            value: myApplicationsCount,
            sub: 'Đang trong quy trình phỏng vấn',
            icon: <TeamOutlined />,
            color: '#10b981',
            action: () => navigate('/candidate/applications'),
          },
          {
            label: 'Lịch phỏng vấn sắp tới',
            value: interviewCount,
            sub: 'Được thông báo từ HR/Client',
            icon: <ClockCircleOutlined />,
            color: '#f59e0b',
            action: () => navigate('/candidate/applications'),
          },
          {
            label: 'Việc làm đã lưu',
            value: userSavedJobsCount,
            sub: 'Đang theo dõi cập nhật',
            icon: <TrophyOutlined />,
            color: '#0284c7',
            action: () => navigate('/candidate/saved-jobs'),
          },
          {
            label: 'CV chuyên nghiệp chuẩn ATS',
            value: userCVsCount,
            sub: 'Đã sẵn sàng ứng tuyển',
            icon: <FileTextOutlined />,
            color: '#8b5cf6',
            action: () => navigate('/candidate/profile'),
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

      {/* Main Content: Applications & Next actions */}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={15}>
          <Card
            title={
              <Space>
                <TeamOutlined style={{ color: '#10b981' }} />
                <span style={{ fontWeight: 700, fontSize: 15 }}>Hồ sơ ứng tuyển &amp; được giới thiệu của tôi</span>
              </Space>
            }
            extra={
              <Button type="link" size="small" onClick={() => navigate('/candidate/applications')} style={{ fontWeight: 600 }}>
                Xem tất cả ({dedupedApps.length}) <RightOutlined />
              </Button>
            }
            style={{ borderRadius: 14, border: '1px solid #e2e8f0' }}
          >
            {dedupedApps.length === 0 ? (
              <Empty
                description="Bạn chưa có hồ sơ ứng tuyển hoặc được giới thiệu nào."
                style={{ padding: '32px 0' }}
              >
                <Button
                  type="primary"
                  onClick={() => navigate('/jobs')}
                  style={{
                    borderRadius: 8,
                    fontWeight: 700,
                    background: 'linear-gradient(135deg, #0284c7, #0369a1)',
                  }}
                >
                  Tìm việc làm ngay
                </Button>
              </Empty>
            ) : (
              <Table
                dataSource={dedupedApps.slice(0, 5)}
                rowKey="id"
                pagination={false}
                size="middle"
                columns={[
                  {
                    title: 'Vị trí công việc',
                    key: 'job',
                    render: (_, record) => (
                      <div>
                        <div style={{ fontWeight: 700, color: '#0f172a' }}>{record.jobTitle}</div>
                        <div style={{ fontSize: 11, color: '#64748b' }}>{record.company}</div>
                      </div>
                    ),
                  },
                  {
                    title: 'Ngày nộp',
                    dataIndex: 'appliedDate',
                    key: 'appliedDate',
                    width: 120,
                    render: (v: string) => <span style={{ fontSize: 12, color: '#64748b' }}>{v}</span>,
                  },
                  {
                    title: 'Trạng thái',
                    key: 'status',
                    width: 180,
                    render: (_, record) => (
                      <Tag
                        style={{
                          borderRadius: 6,
                          fontWeight: 600,
                          fontSize: 11,
                          color: record.statusColor,
                          background: `${record.statusColor}15`,
                          border: `1px solid ${record.statusColor}40`,
                        }}
                      >
                        {record.statusLabel}
                      </Tag>
                    ),
                  },
                ]}
              />
            )}
          </Card>
        </Col>

        <Col xs={24} lg={9}>
          <Card
            title={
              <Space>
                <TrophyOutlined style={{ color: '#0284c7' }} />
                <span style={{ fontWeight: 700, fontSize: 15 }}>Gợi ý tiếp theo cho bạn</span>
              </Space>
            }
            style={{ borderRadius: 14, border: '1px solid #e2e8f0' }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div
                style={{
                  padding: '14px',
                  borderRadius: 10,
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                }}
              >
                <div style={{ fontWeight: 700, fontSize: 13, color: '#0f172a' }}>
                  📄 Hoàn thiện hồ sơ cá nhân
                </div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                  Cập nhật kỹ năng, học vấn và kinh nghiệm làm việc để thu hút nhà tuyển dụng.
                </div>
                <Button
                  size="small"
                  type="link"
                  onClick={() => navigate('/candidate/profile')}
                  style={{ padding: 0, marginTop: 6, fontWeight: 600 }}
                >
                  Cập nhật hồ sơ →
                </Button>
              </div>

              <div
                style={{
                  padding: '14px',
                  borderRadius: 10,
                  background: '#f0fdf4',
                  border: '1px solid #bbf7d0',
                }}
              >
                <div style={{ fontWeight: 700, fontSize: 13, color: '#166534' }}>
                  🎯 Tạo CV chuẩn ATS
                </div>
                <div style={{ fontSize: 12, color: '#15803d', marginTop: 4 }}>
                  Xuất file PDF chuẩn định dạng quốc tế, tương thích với hệ thống quét tự động.
                </div>
                <Button
                  size="small"
                  type="link"
                  onClick={() => navigate('/cv-builder')}
                  style={{ padding: 0, marginTop: 6, fontWeight: 600, color: '#16a34a' }}
                >
                  Tạo CV ngay →
                </Button>
              </div>
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default CandidateDashboardPage;
