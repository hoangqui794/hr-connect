import React, { useMemo, useState } from 'react';
import { Row, Col, Typography, Button, Table, Empty, Tag } from 'antd';
import {
  FileTextOutlined, TeamOutlined, TrophyOutlined, ClockCircleOutlined,
  PlusCircleOutlined, RightOutlined, ShopOutlined, CheckCircleOutlined, SafetyCertificateOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { UserRole } from '@/types/roles';
import { RoleBadge } from '@/components/common/RoleBadge';
import { getJobsForClient } from '@/services/localStorageService';
import { useApplicationStore } from '@/stores/applicationStore';
import { MOCK_CANDIDATES } from '@/services/mockData';
import { ScoreTierTag } from '@/components/common/ScoreTierTag';
import { CandidateHighlightPills } from '@/components/common/CandidateHighlightPills';
import { PageHeaderB2B } from '@/components/common/PageHeaderB2B';
import { FintechMetricCard } from '@/components/common/FintechMetricCard';
import { useCompanyProfile } from '@/services/queries/useProfiles';
import { CompanyProfileModal } from '@/features/client/CompanyProfileModal';

export const ClientDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, role } = useAuthStore();
  const applications = useApplicationStore((s) => s.applications);

  const [isCompanyModalOpen, setIsCompanyModalOpen] = useState(false);
  const { data: company } = useCompanyProfile();

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

  const isVerified = company?.verificationStatus === 'VERIFIED';

  return (
    <div className="space-y-6">
      {/* ─── Minimalist B2B Header ────────────────────────────────────────── */}
      <PageHeaderB2B
        title="Bảng điều khiển Tuyển dụng Doanh nghiệp"
        badge={
          <div className="flex items-center gap-2">
            <RoleBadge role={role || UserRole.CLIENT} size="small" />
            <span
              className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 cursor-pointer hover:bg-slate-200 transition-colors"
              onClick={() => setIsCompanyModalOpen(true)}
              title="Xem và chỉnh sửa hồ sơ doanh nghiệp"
            >
              🏢 {company?.companyName || user?.company || 'Doanh nghiệp'}
            </span>
            <Tag
              color={isVerified ? 'success' : 'warning'}
              icon={isVerified ? <CheckCircleOutlined /> : <SafetyCertificateOutlined />}
              style={{ borderRadius: 6, margin: 0, fontWeight: 600, fontSize: 11 }}
            >
              {isVerified ? 'Đã xác thực' : 'Chờ xác thực'}
            </Tag>
          </div>
        }
        subtitle={
          <span>
            Quản trị vị trí tuyển dụng, đối soát phễu ứng viên AI và giám sát tiến độ phỏng vấn & bảo hành thử việc (COD).
          </span>
        }
        actions={
          <>
            <Button
              type="primary"
              icon={<PlusCircleOutlined />}
              onClick={() => navigate('/client/post-job')}
              className="h-10 px-4 rounded-xl font-semibold bg-blue-600 hover:bg-blue-700 border-none shadow-sm"
            >
              Đăng tin tuyển dụng mới
            </Button>
            <Button
              icon={<FileTextOutlined />}
              onClick={() => navigate('/client/jobs')}
              className="h-10 px-4 rounded-xl font-semibold bg-white border-slate-200 hover:border-slate-300 text-slate-700 shadow-sm"
            >
              Quản lý việc làm ({clientJobs.length})
            </Button>
            <Button
              icon={<ShopOutlined />}
              onClick={() => setIsCompanyModalOpen(true)}
              className="h-10 px-4 rounded-xl font-semibold bg-white border-slate-200 hover:border-slate-300 text-slate-700 shadow-sm"
            >
              Hồ sơ công ty
            </Button>
          </>
        }
      />

      {/* ─── Fintech / SaaS Metric Cards Grid ─────────────────────────────── */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <FintechMetricCard
            label="Vị trí đang tuyển"
            value={activeJobs.length}
            subLabel={pendingJobs.length > 0 ? `+${pendingJobs.length} tin chờ duyệt` : 'Tất cả đã kích hoạt'}
            statusBadge="Active"
            statusType="eligible"
            icon={<FileTextOutlined />}
            iconColor="#2563eb"
            onClick={() => navigate('/client/jobs')}
          />
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <FintechMetricCard
            label="Tổng ứng viên tiếp nhận"
            value={totalApplicants}
            subLabel="Từ CTV & Ứng viên trực tiếp"
            statusBadge="AI Scored"
            statusType="info"
            icon={<TeamOutlined />}
            iconColor="#4f46e5"
            onClick={() => navigate('/client/candidates')}
          />
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <FintechMetricCard
            label="Đã sơ loại & Phỏng vấn"
            value={totalShortlisted}
            subLabel="Đạt tiêu chí vòng 1"
            statusBadge="Pipeline"
            statusType="eligible"
            icon={<TrophyOutlined />}
            iconColor="#059669"
            onClick={() => navigate('/client/interviews-offers')}
          />
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <FintechMetricCard
            label="Bảo hành tuyển dụng"
            value="3 Deals"
            subLabel="Bảo hành 60 ngày (COD)"
            statusBadge="60D Warranty"
            statusType="warranty"
            icon={<ClockCircleOutlined />}
            iconColor="#d97706"
            onClick={() => navigate('/client/warranty')}
          />
        </Col>
      </Row>

      {/* ─── Main Content Panels: Active Jobs & High-Match Candidates ───────── */}
      <Row gutter={[16, 16]}>
        {/* Left: Client Jobs List */}
        <Col xs={24} lg={14}>
          <div className="b2b-card p-5">
            <div className="flex items-center justify-between gap-2 mb-4 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <FileTextOutlined className="text-blue-600" />
                <h3 className="text-sm font-bold text-slate-900 tracking-tight m-0">
                  Tin tuyển dụng gần đây
                </h3>
              </div>
              <Button
                type="link"
                size="small"
                onClick={() => navigate('/client/jobs')}
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 p-0"
              >
                Xem tất cả ({clientJobs.length}) →
              </Button>
            </div>

            {clientJobs.length === 0 ? (
              <Empty
                description={<span className="text-xs text-slate-400">Doanh nghiệp chưa có bài đăng tuyển dụng nào</span>}
                className="py-8"
              >
                <Button
                  type="primary"
                  icon={<PlusCircleOutlined />}
                  onClick={() => navigate('/client/post-job')}
                  className="rounded-xl font-semibold bg-blue-600"
                >
                  Tạo tin tuyển dụng đầu tiên
                </Button>
              </Empty>
            ) : (
              <Table
                dataSource={clientJobs.slice(0, 5)}
                rowKey="id"
                pagination={false}
                size="middle"
                className="bg-transparent"
                columns={[
                  {
                    title: 'VỊ TRÍ TUYỂN DỤNG',
                    key: 'title',
                    render: (_, record) => (
                      <div>
                        <div className="font-semibold text-sm text-slate-800 hover:text-blue-600 cursor-pointer transition-colors" onClick={() => navigate('/client/jobs')}>
                          {record.title}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          {record.servicePackage || 'Tuyển dụng trọn gói COD'} • {record.location}
                        </div>
                      </div>
                    ),
                  },
                  {
                    title: 'TRẠNG THÁI',
                    dataIndex: 'status',
                    key: 'status',
                    width: 130,
                    render: (status: string) => {
                      if (status === 'PENDING') {
                        return <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">⏳ Chờ duyệt</span>;
                      }
                      if (status === 'ACTIVE') {
                        return <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">Đang mở</span>;
                      }
                      return <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">{status}</span>;
                    },
                  },
                  {
                    title: 'HỒ SƠ NỘP',
                    key: 'apps',
                    width: 110,
                    render: (_, record) => (
                      <span className="font-mono font-bold text-blue-600 text-xs">
                        {record.applicationCount || 0} ứng viên
                      </span>
                    ),
                  },
                  {
                    title: '',
                    key: 'act',
                    width: 50,
                    render: () => (
                      <Button
                        type="text"
                        size="small"
                        icon={<RightOutlined className="text-slate-400" />}
                        onClick={() => navigate('/client/jobs')}
                      />
                    ),
                  },
                ]}
              />
            )}
          </div>
        </Col>

        {/* Right: AI High-Match Candidate Highlights */}
        <Col xs={24} lg={10}>
          <div className="b2b-card p-5">
            <div className="flex items-center justify-between gap-2 mb-4 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <TeamOutlined className="text-indigo-600" />
                <h3 className="text-sm font-bold text-slate-900 tracking-tight m-0">
                  Ứng viên AI Match cao nhất
                </h3>
              </div>
              <Button
                type="link"
                size="small"
                onClick={() => navigate('/client/candidates')}
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 p-0"
              >
                Kho ứng viên →
              </Button>
            </div>

            <div className="space-y-3">
              {MOCK_CANDIDATES.slice(0, 4).map((c) => (
                <div
                  key={c.id}
                  className="p-3 rounded-xl bg-slate-50/70 border border-slate-200/80 hover:border-slate-300 transition-all duration-150"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <div className="font-bold text-sm text-slate-800">
                        {c.name}
                      </div>
                      <div className="text-xs text-slate-500">
                        {c.currentTitle}
                      </div>
                    </div>
                    {c.aiScore !== undefined && (
                      <ScoreTierTag score={c.aiScore} size="small" showScore />
                    )}
                  </div>

                  {/* Candidate Highlight Data Pills */}
                  <CandidateHighlightPills
                    yearsOfExperience={c.highlightCard.yearsOfExperience}
                    currentSalary={c.highlightCard.currentSalary}
                    expectedSalary={c.highlightCard.expectedSalary}
                    language={c.highlightCard.primaryLanguage}
                    languageLevel={c.highlightCard.languageLevel}
                    availabilityDate={c.highlightCard.availabilityDate}
                    noticePeriodDays={c.highlightCard.noticePeriod}
                  />
                </div>
              ))}
            </div>
          </div>
        </Col>
      </Row>

      {/* Company Profile Modal */}
      <CompanyProfileModal
        open={isCompanyModalOpen}
        onClose={() => setIsCompanyModalOpen(false)}
      />
    </div>
  );
};

export default ClientDashboardPage;
