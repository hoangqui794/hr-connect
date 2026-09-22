import React from 'react';
import { Row, Col, Card, Typography, Button, Tag, Space, Progress, Avatar, Empty } from 'antd';
import {
  ArrowUpOutlined, TeamOutlined, FileTextOutlined, RightOutlined,
  RobotOutlined, ClockCircleOutlined, TrophyOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { UserRole } from '@/types/roles';
import { MOCK_JOBS, MOCK_CANDIDATES, MOCK_COMMISSIONS, MOCK_LEDGER_SUMMARY } from '@/services/mockData';
import { ScoreTierTag } from '@/components/common/ScoreTierTag';
import { PayoutStatusBadge } from '@/components/common/StatusBadge';
import { RoleBadge } from '@/components/common/RoleBadge';
import { AdminDashboard } from '@/features/admin/AdminDashboard';
import { useCandidateStore } from '@/stores/candidateStore';

const { Title, Text } = Typography;

// ─── Role-specific dashboards ─────────────────────────────────────────────────

const ClientDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isDemoClient = user?.id === 'client-001' || user?.company?.includes('TechCorp');
  const companyJobs = isDemoClient
    ? MOCK_JOBS.filter((j) => j.company.includes('TechCorp') || j.companyId === 'client-001')
    : MOCK_JOBS.filter((j) => j.company === user?.company || j.companyId === user?.id);
  const companyName = user?.company || 'Doanh nghiệp';
  const candidates = isDemoClient ? MOCK_CANDIDATES.slice(0, 4) : [];

  return (
    <div>
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {[
          { label: `Vị trí ${companyName} đang tuyển`, value: companyJobs.filter(j => j.status === 'ACTIVE').length, icon: <FileTextOutlined />, color: '#0284c7', action: () => navigate('/client/jobs') },
          { label: 'Tổng số ứng viên nộp', value: companyJobs.reduce((a, j) => a + j.applicationCount, 0), icon: <TeamOutlined />, color: '#8b5cf6', action: () => navigate('/client/candidates') },
          { label: 'Đã duyệt phỏng vấn', value: companyJobs.reduce((a, j) => a + j.shortlistedCount, 0), icon: <TrophyOutlined />, color: '#10b981', action: () => navigate('/client/interviews-offers') },
          { label: 'Theo dõi bảo hành (COD)', value: isDemoClient ? 3 : 0, icon: <ClockCircleOutlined />, color: '#f59e0b', action: () => navigate('/client/warranty') },
        ].map((stat) => (
          <Col key={stat.label} xs={12} sm={6}>
            <div className="hrc-stat-card" onClick={stat.action} style={{ cursor: 'pointer' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: `${stat.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: stat.color, fontSize: 18 }}>
                  {stat.icon}
                </div>
                <ArrowUpOutlined style={{ color: '#10b981', fontSize: 12 }} />
              </div>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>{stat.value}</div>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 6 }}>{stat.label}</div>
            </div>
          </Col>
        ))}
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={14}>
          <Card
            title={<span style={{ fontWeight: 700 }}>Tin tuyển dụng của {companyName}</span>}
            style={{ borderRadius: 14 }}
            extra={<Button type="link" size="small" onClick={() => navigate('/client/jobs')}>Xem tất cả</Button>}
          >
            {companyJobs.length === 0 ? (
              <Empty
                description="Doanh nghiệp chưa có tin tuyển dụng nào"
                style={{ padding: '24px 0' }}
              >
                <Button type="primary" size="small" onClick={() => navigate('/client/jobs/create')}>
                  Đăng tin tuyển dụng mới
                </Button>
              </Empty>
            ) : (
              companyJobs.map(job => (
                <div key={job.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #f1f5f9' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13, color: '#0f172a' }}>{job.title}</div>
                    <div style={{ fontSize: 11, color: '#64748b' }}>{job.applicationCount} ứng viên · {job.shortlistedCount} đã duyệt</div>
                  </div>
                  <Space>
                    <Tag color="success" style={{ borderRadius: 6, fontSize: 11 }}>Đang mở</Tag>
                    <Button size="small" type="text" icon={<RightOutlined />} onClick={() => navigate('/client/candidates')} />
                  </Space>
                </div>
              ))
            )}
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          <Card title={<span style={{ fontWeight: 700 }}>Ứng viên AI đánh giá cao nhất</span>} style={{ borderRadius: 14 }}>
            {candidates.length === 0 ? (
              <Empty
                description="Chưa có dữ liệu ứng viên"
                style={{ padding: '24px 0' }}
              />
            ) : (
              candidates.map(c => (
                <div key={c.id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #f1f5f9' }}>
                  <Avatar size={32} style={{ background: '#0284c7', fontWeight: 700, fontSize: 12, flexShrink: 0 }}>
                    {c.name.slice(0, 2)}
                  </Avatar>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 12, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
                    <div style={{ fontSize: 11, color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.currentTitle}</div>
                  </div>
                  {c.aiScore !== undefined && <ScoreTierTag score={c.aiScore} showScore />}
                </div>
              ))
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
};

const AffiliateDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isDemoAffiliate = user?.id === 'aff-001' || user?.email?.includes('david.tran');
  const summary = isDemoAffiliate ? MOCK_LEDGER_SUMMARY : {
    totalEarned: 0,
    pendingAmount: 0,
    payableAmount: 0,
    paidAmount: 0,
    totalPlacements: 0,
    currency: 'VND',
  };
  const commissions = isDemoAffiliate ? MOCK_COMMISSIONS : [];

  return (
    <div>
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {[
          { label: 'Tổng hoa hồng tích lũy', value: `${summary.totalEarned.toLocaleString()} đ`, color: '#0284c7', bg: '#f0f9ff' },
          { label: 'Đủ điều kiện nhận', value: `${summary.payableAmount.toLocaleString()} đ`, color: '#10b981', bg: '#f0fdf4' },
          { label: 'Chờ duyệt (Bảo hành)', value: `${summary.pendingAmount.toLocaleString()} đ`, color: '#f59e0b', bg: '#fffbeb' },
          { label: 'Ứng viên nhận việc', value: summary.totalPlacements, color: '#8b5cf6', bg: '#faf5ff' },
        ].map((stat) => (
          <Col key={stat.label} xs={12} sm={6}>
            <div style={{ background: stat.bg, borderRadius: 14, padding: '18px 20px', border: `1px solid ${stat.color}30` }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: stat.color }}>{stat.value}</div>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>{stat.label}</div>
            </div>
          </Col>
        ))}
      </Row>
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={14}>
          <Card
            title={<span style={{ fontWeight: 700 }}>Danh sách hoa hồng của tôi</span>}
            style={{ borderRadius: 14 }}
            extra={<Button type="link" size="small" onClick={() => navigate('/affiliate/ledger')}>Xem sổ cái</Button>}
          >
            {commissions.length === 0 ? (
              <Empty description="Chưa có khoản hoa hồng nào" style={{ padding: '24px 0' }}>
                <Button type="primary" size="small" onClick={() => navigate('/affiliate/referral')}>
                  Giới thiệu ứng viên ngay
                </Button>
              </Empty>
            ) : (
              commissions.map(c => (
                <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #f1f5f9' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{c.candidateName}</div>
                    <div style={{ fontSize: 11, color: '#64748b' }}>{c.jobTitle}</div>
                    {!c.warrantyExpired && (
                      <Progress percent={c.probationProgress} size="small" style={{ width: 120, marginTop: 4 }} showInfo={false} strokeColor={{ '0%': '#10b981', '100%': '#0284c7' }} />
                    )}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 700, color: '#0284c7' }}>{c.commissionAmount.toLocaleString()} {c.currency}</div>
                    <PayoutStatusBadge status={c.status} />
                  </div>
                </div>
              ))
            )}
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          <Card title={<span style={{ fontWeight: 700 }}>Vị trí tuyển dụng nổi bật</span>} style={{ borderRadius: 14 }}>
            {MOCK_JOBS.filter(j => j.serviceType === 'HEADHUNT_COD').slice(0, 3).map(j => (
              <div key={j.id} style={{ padding: '10px 0', borderBottom: '1px solid #f1f5f9' }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{j.title}</div>
                <div style={{ fontSize: 11, color: '#64748b' }}>{j.company}</div>
                <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                  <Tag color="blue" style={{ borderRadius: 6, fontSize: 11 }}>Hoa hồng {j.engagementTerms.commissionRate}%</Tag>
                  <Tag style={{ borderRadius: 6, fontSize: 11 }}>{(j.salaryRange.min / 1000000).toFixed(0)}tr–{(j.salaryRange.max / 1000000).toFixed(0)}tr VNĐ</Tag>
                </div>
                <Button size="small" type="link" style={{ padding: 0, marginTop: 4, fontSize: 12 }} onClick={() => navigate('/affiliate/referral')}>
                  Giới thiệu ứng viên →
                </Button>
              </div>
            ))}
          </Card>
        </Col>
      </Row>
    </div>
  );
};

const HRDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isDemoHR = user?.id === 'hr-001' || user?.email?.includes('lisa.pham');
  const candidates = isDemoHR ? MOCK_CANDIDATES : [];

  return (
    <div>
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {[
          { label: 'Vị trí cần sàng lọc', value: isDemoHR ? 4 : 0, color: '#ef4444' },
          { label: 'Hồ sơ chờ duyệt', value: candidates.length, color: '#0284c7' },
          { label: 'Phỏng vấn trong tuần', value: isDemoHR ? 3 : 0, color: '#10b981' },
          { label: 'Đề nghị tuyển dụng (Offer)', value: isDemoHR ? 2 : 0, color: '#f59e0b' },
        ].map((s) => (
          <Col key={s.label} xs={12} sm={6}>
            <div className="hrc-stat-card">
              <div style={{ fontSize: 32, fontWeight: 800, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 6 }}>{s.label}</div>
            </div>
          </Col>
        ))}
      </Row>
      <Card
        title={<Space><RobotOutlined style={{ color: '#0284c7' }} /><span style={{ fontWeight: 700 }}>Hàng đợi sàng lọc hồ sơ AI</span></Space>}
        style={{ borderRadius: 14 }}
        extra={<Button type="primary" size="small" onClick={() => navigate('/screening')} style={{ borderRadius: 6 }}>Mở công cụ sàng lọc</Button>}
      >
        {candidates.length === 0 ? (
          <Empty description="Chưa có hồ sơ nào trong hàng đợi sàng lọc" style={{ padding: '24px 0' }} />
        ) : (
          candidates.map(c => (
            <div key={c.id} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #f1f5f9' }}>
              <Avatar size={32} style={{ background: '#8b5cf6', fontWeight: 700, fontSize: 12, flexShrink: 0 }}>
                {c.name.slice(0, 2)}
              </Avatar>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{c.name}</div>
                <div style={{ fontSize: 11, color: '#64748b' }}>{c.currentTitle} · {c.highlightCard.yearsOfExperience} năm kinh nghiệm</div>
              </div>
              {c.aiScore !== undefined ? <ScoreTierTag score={c.aiScore} showScore /> : <Tag style={{ borderRadius: 6, fontSize: 11 }}>Chờ AI phân tích</Tag>}
              <Button size="small" style={{ borderRadius: 6 }} onClick={() => navigate('/screening')}>Xem chi tiết</Button>
            </div>
          ))
        )}
      </Card>
    </div>
  );
};

const CandidateDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { cvs, applications, savedJobIds } = useCandidateStore();

  return (
    <div>
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {[
          { label: 'CV đã tạo', value: cvs.length, icon: <FileTextOutlined />, color: '#8b5cf6', action: () => navigate('/candidate/profile') },
          { label: 'Việc làm đã lưu', value: savedJobIds.length, icon: <TrophyOutlined />, color: '#0284c7', action: () => navigate('/candidate/saved-jobs') },
          { label: 'Đơn ứng tuyển', value: applications.length, icon: <TeamOutlined />, color: '#10b981', action: () => navigate('/candidate/applications') },
          { label: 'Lịch phỏng vấn', value: 0, icon: <ClockCircleOutlined />, color: '#f59e0b', action: () => navigate('/candidate/applications') },
        ].map((stat) => (
          <Col key={stat.label} xs={12} sm={6}>
            <div className="hrc-stat-card" onClick={stat.action} style={{ cursor: 'pointer' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: `${stat.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: stat.color, fontSize: 18 }}>
                  {stat.icon}
                </div>
                <ArrowUpOutlined style={{ color: '#10b981', fontSize: 12 }} />
              </div>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>{stat.value}</div>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 6 }}>{stat.label}</div>
            </div>
          </Col>
        ))}
      </Row>

      <Card style={{ borderRadius: 14, textAlign: 'center', padding: '36px 20px' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🎯</div>
        <Title level={3} style={{ margin: '0 0 8px' }}>Không gian tìm việc & Phát triển sự nghiệp</Title>
        <Text type="secondary">Khám phá các vị trí tuyển dụng hấp dẫn, tạo CV chuẩn ATS và theo dõi tiến độ ứng tuyển.</Text>
        <div style={{ marginTop: 24 }}>
          <Space wrap size="middle">
            <Button type="primary" size="large" onClick={() => navigate('/jobs')} style={{ borderRadius: 8, fontWeight: 600 }}>
              Khám phá việc làm
            </Button>
            <Button size="large" onClick={() => navigate('/cv-builder')} style={{ borderRadius: 8, fontWeight: 600 }}>
              Tạo CV chuyên nghiệp
            </Button>
            <Button size="large" onClick={() => navigate('/candidate/profile')} style={{ borderRadius: 8 }}>
              Cập nhật hồ sơ cá nhân
            </Button>
          </Space>
        </div>
      </Card>
    </div>
  );
};

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export const Dashboard: React.FC = () => {
  const { role, user } = useAuthStore();
  const navigate = useNavigate();

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Chào buổi sáng';
    if (hour < 18) return 'Chào buổi chiều';
    return 'Chào buổi tối';
  };

  return (
    <div>
      {/* Welcome Header */}
      <div
        style={{
          background: 'linear-gradient(135deg, #0f172a, #1e293b, #0c4a6e)',
          borderRadius: 16,
          padding: '24px 28px',
          marginBottom: 24,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 16,
        }}
      >
        <div>
          <div style={{ color: '#94a3b8', fontSize: 13, marginBottom: 4 }}>
            {getGreeting()}, {user?.name ? user.name.split(' ')[0] : 'bạn'}! 👋
          </div>
          <Title level={2} style={{ color: '#fff', margin: 0, fontWeight: 800 }}>
            Bảng điều khiển
          </Title>
          <div style={{ marginTop: 8 }}>
            <RoleBadge role={role} />
          </div>
        </div>
        <Space wrap>
          {role === UserRole.CLIENT && (
            <Button type="primary" icon={<FileTextOutlined />} onClick={() => navigate('/jobs/create')} style={{ borderRadius: 8, fontWeight: 600 }}>
              Đăng tin tuyển dụng mới
            </Button>
          )}
          {role === UserRole.AFFILIATE && (
            <Button type="primary" icon={<TeamOutlined />} onClick={() => navigate('/affiliate/referral')} style={{ borderRadius: 8, fontWeight: 600 }}>
              Giới thiệu ứng viên
            </Button>
          )}
          {role === UserRole.INTERNAL_HR && (
            <Button type="primary" icon={<RobotOutlined />} onClick={() => navigate('/screening')} style={{ borderRadius: 8, fontWeight: 600 }}>
              Bắt đầu sàng lọc AI
            </Button>
          )}
          {role === UserRole.CANDIDATE && (
            <Button type="primary" icon={<FileTextOutlined />} onClick={() => navigate('/jobs')} style={{ borderRadius: 8, fontWeight: 600 }}>
              Tìm việc ngay
            </Button>
          )}
        </Space>
      </div>

      {/* Role-specific Dashboard Content */}
      {role === UserRole.CLIENT && <ClientDashboard />}
      {role === UserRole.AFFILIATE && <AffiliateDashboard />}
      {role === UserRole.INTERNAL_HR && <HRDashboard />}
      {role === UserRole.ADMIN && <AdminDashboard />}
      {role === UserRole.CANDIDATE && <CandidateDashboard />}
      {role === UserRole.GUEST && (
        <Card style={{ borderRadius: 14, textAlign: 'center', padding: 40 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🔐</div>
          <Title level={3}>Vui lòng đăng nhập để truy cập Bảng điều khiển</Title>
          <Text type="secondary">Chọn đăng nhập với tài khoản phù hợp để truy cập không gian làm việc.</Text>
          <div style={{ marginTop: 20 }}>
            <Button type="primary" onClick={() => navigate('/login')} style={{ borderRadius: 8 }}>Đăng nhập ngay</Button>
          </div>
        </Card>
      )}
    </div>
  );
};
