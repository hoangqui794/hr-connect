import React, { useMemo } from 'react';
import { Row, Col, Typography, Button, Table, Empty, Avatar } from 'antd';
import {
  RobotOutlined, FileTextOutlined,
  ClockCircleOutlined, TrophyOutlined, RightOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { UserRole } from '@/types/roles';
import { RoleBadge } from '@/components/common/RoleBadge';
import { getAllJobs } from '@/services/localStorageService';
import { useApplicationStore } from '@/stores/applicationStore';
import { MOCK_CANDIDATES } from '@/services/mockData';
import { ScoreTierTag } from '@/components/common/ScoreTierTag';
import { CandidateHighlightPills } from '@/components/common/CandidateHighlightPills';
import { PageHeaderB2B } from '@/components/common/PageHeaderB2B';
import { FintechMetricCard } from '@/components/common/FintechMetricCard';

const { Text } = Typography;

export const HRDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, role } = useAuthStore();
  const applications = useApplicationStore((s) => s.applications);

  const allJobs = useMemo(() => getAllJobs(), []);
  const pendingJobs = useMemo(() => allJobs.filter((j) => j.status === 'PENDING'), [allJobs]);
  const activeJobs = useMemo(() => allJobs.filter((j) => j.status === 'ACTIVE'), [allJobs]);

  return (
    <div className="space-y-6">
      {/* ─── Minimalist B2B Header ────────────────────────────────────────── */}
      <PageHeaderB2B
        title="Trung Tâm Vận Hành Tuyển Dụng & Sàng Lọc AI"
        badge={
          <div className="flex items-center gap-2">
            <RoleBadge role={role || UserRole.INTERNAL_HR} size="small" />
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
              🛡️ Cam kết SLA 48h kiểm duyệt
            </span>
          </div>
        }
        subtitle="Giám sát luồng phê duyệt tin đăng tuyển dụng, điều phối công cụ Sentence-BERT ATS và kiểm soát lịch phỏng vấn doanh nghiệp."
        actions={
          <>
            <Button
              type="primary"
              icon={<FileTextOutlined />}
              onClick={() => navigate('/hr/jobs')}
              className="h-10 px-4 rounded-xl font-semibold bg-blue-600 hover:bg-blue-700 text-white border-none shadow-sm"
            >
              Duyệt tin tuyển dụng ({pendingJobs.length} tin chờ)
            </Button>
            <Button
              icon={<RobotOutlined />}
              onClick={() => navigate('/hr/screening')}
              className="h-10 px-4 rounded-xl font-semibold bg-white border-slate-200 hover:bg-slate-50 text-slate-700 shadow-sm"
            >
              Mở công cụ Sàng lọc AI
            </Button>
          </>
        }
      />

      {/* ─── Operational & Quality KPI Cards ───────────────────────────────── */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <FintechMetricCard
            label="Tin tuyển dụng chờ duyệt"
            value={pendingJobs.length}
            subLabel={pendingJobs.length > 0 ? 'Cần kiểm duyệt để lên sàn' : 'Không có tin tồn đọng'}
            statusBadge={pendingJobs.length > 0 ? 'Cần xử lý' : 'Đạt SLA'}
            statusType={pendingJobs.length > 0 ? 'warranty' : 'eligible'}
            icon={<ClockCircleOutlined />}
            iconColor="#f43f5e"
            onClick={() => navigate('/hr/jobs')}
          />
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <FintechMetricCard
            label="Việc làm đang mở trên sàn"
            value={activeJobs.length}
            subLabel="Affiliate & Ứng viên đang nộp"
            statusBadge="Active Listings"
            statusType="eligible"
            icon={<FileTextOutlined />}
            iconColor="#2563eb"
            onClick={() => navigate('/hr/jobs')}
          />
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <FintechMetricCard
            label="Hồ sơ chờ sàng lọc AI"
            value={applications.length > 0 ? applications.length : 18}
            subLabel="Chấm điểm Sentence-BERT"
            statusBadge="ATS Engine"
            statusType="info"
            icon={<RobotOutlined />}
            iconColor="#6366f1"
            onClick={() => navigate('/hr/screening')}
          />
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <FintechMetricCard
            label="Lịch phỏng vấn tuần này"
            value="6 Buổi"
            subLabel="Đã xếp lịch với Doanh nghiệp"
            statusBadge="Phỏng vấn"
            statusType="paid"
            icon={<TrophyOutlined />}
            iconColor="#10b981"
            onClick={() => navigate('/hr/interviews')}
          />
        </Col>
      </Row>

      {/* ─── Main Content: Pending Jobs & Screening Queue ───────────────────── */}
      <Row gutter={[16, 16]}>
        {/* Left: Pending Approval Queue */}
        <Col xs={24} lg={14}>
          <div className="b2b-card p-5">
            <div className="flex items-center justify-between gap-2 mb-4 pb-3 border-b border-slate-200/80">
              <div className="flex items-center gap-2">
                <ClockCircleOutlined className="text-rose-500" />
                <h3 className="text-sm font-bold text-slate-900 tracking-tight m-0">
                  Hàng đợi duyệt tin tuyển dụng Doanh nghiệp
                </h3>
              </div>
              <Button
                type="link"
                size="small"
                onClick={() => navigate('/hr/jobs')}
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 p-0"
              >
                Quản lý tất cả việc làm →
              </Button>
            </div>

            {pendingJobs.length === 0 ? (
              <Empty
                description={<span className="text-xs text-slate-500">Tuyệt vời! Hiện không có tin tuyển dụng nào chờ duyệt tồn đọng.</span>}
                className="py-8"
              >
                <Button
                  onClick={() => navigate('/hr/jobs')}
                  className="rounded-xl font-semibold bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                >
                  Xem danh sách tin đang mở
                </Button>
              </Empty>
            ) : (
              <Table
                dataSource={pendingJobs}
                rowKey="id"
                pagination={false}
                size="middle"
                className="bg-transparent"
                columns={[
                  {
                    title: 'TIN TUYỂN DỤNG',
                    key: 'job',
                    render: (_, record) => (
                      <div>
                        <div className="font-semibold text-sm text-slate-900">
                          {record.title}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          🏢 {record.company} • {record.location}
                        </div>
                      </div>
                    ),
                  },
                  {
                    title: 'TRẠNG THÁI',
                    dataIndex: 'status',
                    key: 'status',
                    width: 140,
                    render: () => (
                      <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                        ⏳ Chờ HR duyệt
                      </span>
                    ),
                  },
                  {
                    title: 'THAO TÁC',
                    key: 'action',
                    width: 120,
                    render: (_, record) => (
                      <Button
                        type="primary"
                        size="small"
                        onClick={() => navigate('/hr/jobs')}
                        className="rounded-xl font-semibold bg-blue-600 hover:bg-blue-700 text-white border-none text-xs"
                      >
                        Xem & Duyệt
                      </Button>
                    ),
                  },
                ]}
              />
            )}
          </div>
        </Col>

        {/* Right: AI Screening Queue */}
        <Col xs={24} lg={10}>
          <div className="b2b-card p-5">
            <div className="flex items-center justify-between gap-2 mb-4 pb-3 border-b border-slate-200/80">
              <div className="flex items-center gap-2">
                <RobotOutlined className="text-blue-600" />
                <h3 className="text-sm font-bold text-slate-900 tracking-tight m-0">
                  Hàng đợi Sàng lọc Ứng viên AI
                </h3>
              </div>
              <Button
                type="link"
                size="small"
                onClick={() => navigate('/hr/screening')}
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 p-0"
              >
                Mở bộ lọc AI →
              </Button>
            </div>

            <div className="space-y-3">
              {MOCK_CANDIDATES.slice(0, 4).map((c) => (
                <div
                  key={c.id}
                  className="p-3.5 rounded-xl bg-slate-50/70 border border-slate-200/80 hover:border-slate-300 hover:bg-white transition-all duration-150"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Avatar className="bg-blue-600 font-bold shrink-0">
                        {c.name.slice(0, 2)}
                      </Avatar>
                      <div className="min-w-0">
                        <div className="font-bold text-sm text-slate-900 truncate">
                          {c.name}
                        </div>
                        <div className="text-xs text-slate-500 truncate">
                          {c.currentTitle}
                        </div>
                      </div>
                    </div>
                    {c.aiScore !== undefined && (
                      <ScoreTierTag score={c.aiScore} size="small" showScore />
                    )}
                  </div>

                  <CandidateHighlightPills
                    yearsOfExperience={c.highlightCard.yearsOfExperience}
                    currentSalary={c.highlightCard.currentSalary}
                    expectedSalary={c.highlightCard.expectedSalary}
                    language={c.highlightCard.primaryLanguage}
                    languageLevel={c.highlightCard.languageLevel}
                    availabilityDate={c.highlightCard.availabilityDate}
                    noticePeriodDays={c.highlightCard.noticePeriod}
                  />

                  <div className="mt-2.5 pt-2 border-t border-slate-200/60 flex justify-end">
                    <Button
                      size="small"
                      onClick={() => navigate('/hr/screening')}
                      className="rounded-lg text-xs bg-white hover:bg-slate-50 text-slate-700 border-slate-200"
                    >
                      Đánh giá chi tiết
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Col>
      </Row>
    </div>
  );
};

export default HRDashboardPage;
