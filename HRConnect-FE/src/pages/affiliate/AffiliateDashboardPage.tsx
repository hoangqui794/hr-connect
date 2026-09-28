import React, { useMemo } from 'react';
import { Row, Col, Button, Table, Empty } from 'antd';
import {
  DollarOutlined, TeamOutlined, TrophyOutlined, CheckCircleOutlined,
  PlusCircleOutlined, FileTextOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { UserRole } from '@/types/roles';
import { RoleBadge } from '@/components/common/RoleBadge';
import { useApplicationStore, APPLICATION_STATUS_LABELS, APPLICATION_STATUS_COLORS } from '@/stores/applicationStore';
import { getAllJobs } from '@/services/localStorageService';
import { PageHeaderB2B } from '@/components/common/PageHeaderB2B';
import { FintechMetricCard } from '@/components/common/FintechMetricCard';
import { AntiDuplicationBadge } from '@/components/common/AntiDuplicationBadge';

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
    <div className="space-y-6">
      {/* ─── Minimalist B2B Header ────────────────────────────────────────── */}
      <PageHeaderB2B
        title="Trung Tâm Cộng Tác Viên & Headhunter (OPR Hub)"
        badge={
          <div className="flex items-center gap-2">
            <RoleBadge role={role || UserRole.AFFILIATE} size="small" />
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
              ⭐ Điểm tín nhiệm: 4.9/5.0
            </span>
          </div>
        }
        subtitle="Quản lý mạng lưới giới thiệu ứng viên, kiểm tra dấu thời gian chống trùng lặp (Anti-Duplication) và đối soát hoa hồng COD."
        actions={
          <>
            <Button
              type="primary"
              icon={<PlusCircleOutlined />}
              onClick={() => navigate('/affiliate/referral')}
              className="h-10 px-4 rounded-xl font-semibold bg-blue-600 hover:bg-blue-700 text-white border-none shadow-sm"
            >
              Giới thiệu ứng viên mới
            </Button>
            <Button
              icon={<FileTextOutlined />}
              onClick={() => navigate('/affiliate/jobs')}
              className="h-10 px-4 rounded-xl font-semibold bg-white border-slate-200 hover:border-slate-300 text-slate-700 shadow-sm"
            >
              Khám phá việc làm hoa hồng cao
            </Button>
          </>
        }
      />

      {/* ─── Fintech Banking Standard Metric Cards ────────────────────────── */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <FintechMetricCard
            label="Tổng hoa hồng tích lũy"
            value={`${totalEarned.toLocaleString('vi-VN')} đ`}
            subLabel="Toàn bộ deal hoàn thành"
            statusBadge="Lũy kế"
            statusType="paid"
            icon={<DollarOutlined />}
            iconColor="#2563eb"
            onClick={() => navigate('/affiliate/commissions')}
          />
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <FintechMetricCard
            label="Đủ điều kiện rút ngay"
            value={`${payableAmount.toLocaleString('vi-VN')} đ`}
            subLabel="Admin đã phê duyệt giải ngân"
            statusBadge="Đủ điều kiện rút"
            statusType="eligible"
            icon={<CheckCircleOutlined />}
            iconColor="#059669"
            onClick={() => navigate('/affiliate/commissions')}
          />
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <FintechMetricCard
            label="Đang bảo hành thử việc"
            value={`${pendingAmount.toLocaleString('vi-VN')} đ`}
            subLabel="Ứng viên đang trong thử việc"
            statusBadge="Bảo hành 60 ngày (COD)"
            statusType="warranty"
            icon={<TrophyOutlined />}
            iconColor="#d97706"
            onClick={() => navigate('/affiliate/commissions')}
          />
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <FintechMetricCard
            label="Hồ sơ đã giới thiệu"
            value={mySubmissions.length > 0 ? mySubmissions.length : 12}
            subLabel="Bảo chứng First-Submission"
            statusBadge="Attribution Secured"
            statusType="info"
            icon={<TeamOutlined />}
            iconColor="#4f46e5"
            onClick={() => navigate('/affiliate/submissions')}
          />
        </Col>
      </Row>

      {/* ─── Main Content: Submissions Table & High Commission Jobs ─────────── */}
      <Row gutter={[16, 16]}>
        {/* Left: Recent Submissions with Anti-Duplication Badge */}
        <Col xs={24} lg={14}>
          <div className="b2b-card p-5">
            <div className="flex items-center justify-between gap-2 mb-4 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <TeamOutlined className="text-amber-500" />
                <h3 className="text-sm font-bold text-slate-900 tracking-tight m-0">
                  Hồ sơ ứng viên vừa giới thiệu
                </h3>
              </div>
              <Button
                type="link"
                size="small"
                onClick={() => navigate('/affiliate/submissions')}
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 p-0"
              >
                Xem tất cả ({mySubmissions.length}) →
              </Button>
            </div>

            {mySubmissions.length === 0 ? (
              <Empty
                description={<span className="text-xs text-slate-400">Bạn chưa giới thiệu ứng viên nào trên hệ thống</span>}
                className="py-8"
              >
                <Button
                  type="primary"
                  onClick={() => navigate('/affiliate/referral')}
                  className="rounded-xl font-semibold bg-blue-600 hover:bg-blue-700 text-white border-none"
                >
                  Giới thiệu ứng viên đầu tiên
                </Button>
              </Empty>
            ) : (
              <Table
                dataSource={mySubmissions.slice(0, 5)}
                rowKey="id"
                pagination={false}
                size="middle"
                className="bg-transparent"
                columns={[
                  {
                    title: 'ỨNG VIÊN & ATTRIBUTION',
                    key: 'candidate',
                    render: (_, record) => (
                      <div className="space-y-1">
                        <div className="font-semibold text-sm text-slate-800">
                          {record.fullName}
                        </div>
                        <div className="text-xs text-slate-500">
                          {record.email} • {record.phone}
                        </div>
                        <AntiDuplicationBadge
                          timestamp={record.applyDate}
                          affiliateName={user?.name}
                        />
                      </div>
                    ),
                  },
                  {
                    title: 'VỊ TRÍ ỨNG TUYỂN',
                    key: 'job',
                    render: (_, record) => (
                      <div>
                        <div className="font-medium text-sm text-slate-800">
                          {record.jobTitle}
                        </div>
                        <div className="text-xs text-slate-500">
                          🏢 {record.company}
                        </div>
                      </div>
                    ),
                  },
                  {
                    title: 'TRẠNG THÁI',
                    key: 'status',
                    width: 150,
                    render: (_, record) => (
                      <span
                        className="text-xs font-semibold px-2.5 py-0.5 rounded-full border inline-block"
                        style={{
                          color: APPLICATION_STATUS_COLORS[record.status] || '#64748b',
                          background: `${APPLICATION_STATUS_COLORS[record.status] || '#64748b'}15`,
                          borderColor: `${APPLICATION_STATUS_COLORS[record.status] || '#64748b'}35`,
                        }}
                      >
                        {APPLICATION_STATUS_LABELS[record.status] || record.status}
                      </span>
                    ),
                  },
                ]}
              />
            )}
          </div>
        </Col>

        {/* Right: High Commission Jobs */}
        <Col xs={24} lg={10}>
          <div className="b2b-card p-5">
            <div className="flex items-center justify-between gap-2 mb-4 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <DollarOutlined className="text-blue-600" />
                <h3 className="text-sm font-bold text-slate-900 tracking-tight m-0">
                  Việc làm hoa hồng hấp dẫn
                </h3>
              </div>
              <Button
                type="link"
                size="small"
                onClick={() => navigate('/affiliate/jobs')}
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 p-0"
              >
                Khám phá sàn việc →
              </Button>
            </div>

            <div className="space-y-3">
              {activeJobs.slice(0, 4).map((j) => (
                <div
                  key={j.id}
                  className="p-3.5 rounded-xl bg-slate-50/70 border border-slate-200/80 hover:border-slate-300 transition-all duration-150 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-sm text-slate-800 truncate">
                      {j.title}
                    </div>
                    <div className="text-xs text-slate-500 truncate mt-0.5">
                      🏢 {j.company} • {j.location}
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                        Hoa hồng {j.engagementTerms?.commissionRate || 15}%
                      </span>
                    </div>
                  </div>
                  <Button
                    type="primary"
                    size="small"
                    onClick={() => navigate('/affiliate/referral')}
                    className="rounded-xl font-semibold bg-blue-600 hover:bg-blue-700 border-none shrink-0"
                  >
                    Giới thiệu
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </Col>
      </Row>
    </div>
  );
};

export default AffiliateDashboardPage;
