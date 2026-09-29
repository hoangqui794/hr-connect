import React, { useMemo, useState } from 'react';
import { Row, Col, Typography, Button, Table, Empty, Switch, Progress, message, Tag } from 'antd';
import {
  FileTextOutlined, TrophyOutlined, TeamOutlined, ClockCircleOutlined,
  SearchOutlined, RightOutlined, CheckCircleFilled, ThunderboltFilled,
  SafetyCertificateOutlined, EyeOutlined, CheckOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { useCandidateStore } from '@/stores/candidateStore';
import { useApplicationStore, APPLICATION_STATUS_LABELS, APPLICATION_STATUS_COLORS } from '@/stores/applicationStore';
import { UserRole } from '@/types/roles';
import { RoleBadge } from '@/components/common/RoleBadge';
import { PageHeaderB2B } from '@/components/common/PageHeaderB2B';
import { FintechMetricCard } from '@/components/common/FintechMetricCard';

const { Text } = Typography;

export const CandidateDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, role } = useAuthStore();
  const { cvs, applications: storeApps, savedJobs, interviews } = useCandidateStore();
  const sharedApps = useApplicationStore((s) => s.applications);

  // Job seeking toggle status persisted in localStorage
  const [isJobSeeking, setIsJobSeeking] = useState<boolean>(() => {
    try {
      const raw = localStorage.getItem('hrconnect_candidate_job_seeking');
      return raw !== null ? JSON.parse(raw) : true;
    } catch {
      return true;
    }
  });

  const handleToggleJobSeeking = (checked: boolean) => {
    setIsJobSeeking(checked);
    try {
      localStorage.setItem('hrconnect_candidate_job_seeking', JSON.stringify(checked));
    } catch {}
    if (checked) {
      message.success({
        content: 'Đã bật trạng thái tìm việc! Hồ sơ của bạn đã hiển thị cho các nhà tuyển dụng và Headhunter.',
        icon: <CheckCircleFilled style={{ color: '#10b981' }} />,
      });
    } else {
      message.info('Đã tắt tìm việc. Hồ sơ của bạn hiện đang ở chế độ riêng tư.');
    }
  };

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

  // Stat 2: Scheduled interviews for this candidate
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

  // Stat 3: Saved jobs for this candidate
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

  // Stat 4: CVs created/uploaded by this candidate
  const userCVsCount = useMemo(() => {
    if (!currentUserEmail) return 0;
    return (cvs || []).filter((c) => (c.userEmail || '').toLowerCase().trim() === currentUserEmail).length;
  }, [currentUserEmail, cvs]);

  return (
    <div className="space-y-6">
      {/* ─── Minimalist B2B Header ────────────────────────────────────────── */}
      <PageHeaderB2B
        title="Không Gian Ứng Viên & Phát Triển Sự Nghiệp"
        badge={
          <div className="flex items-center gap-2">
            <RoleBadge role={role || UserRole.CANDIDATE} size="small" />
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
              🎯 Chuẩn ATS Tối Ưu Hóa
            </span>
          </div>
        }
        subtitle="Tìm kiếm vị trí tuyển dụng phù hợp, theo dõi hồ sơ ứng tuyển từ Headhunter và đồng bộ lịch phỏng vấn doanh nghiệp."
        actions={
          <>
            <Button
              type="primary"
              icon={<SearchOutlined />}
              onClick={() => navigate('/jobs')}
              className="h-10 px-4 rounded-xl font-semibold bg-blue-600 hover:bg-blue-700 text-white border-none shadow-sm"
            >
              Tìm việc làm ngay
            </Button>
            <Button
              icon={<FileTextOutlined />}
              onClick={() => navigate('/cv-builder')}
              className="h-10 px-4 rounded-xl font-semibold bg-white border-slate-200 hover:bg-slate-50 text-slate-700 shadow-sm"
            >
              Tạo CV chuyên nghiệp
            </Button>
          </>
        }
      />

      {/* ─── TopCV Candidate Status & Profile Completion Header Bar ──── */}
      <Row gutter={[16, 16]}>
        {/* Card 1: Toggle Trạng thái tìm việc */}
        <Col xs={24} lg={11}>
          <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs h-full flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-3 mb-2">
                <div className="flex items-center gap-2.5">
                  <span className="relative flex h-3 w-3">
                    {isJobSeeking ? (
                      <>
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
                      </>
                    ) : (
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-slate-300" />
                    )}
                  </span>
                  <span className="font-extrabold text-sm sm:text-base text-slate-900">
                    {isJobSeeking ? 'Đang bật tìm việc' : 'Đang tắt tìm việc'}
                  </span>
                </div>
                <Switch
                  checked={isJobSeeking}
                  onChange={handleToggleJobSeeking}
                  className={isJobSeeking ? 'bg-emerald-500' : 'bg-slate-300'}
                />
              </div>

              <p className="text-xs text-slate-600 leading-relaxed m-0">
                {isJobSeeking
                  ? 'Cho phép 1.200+ Nhà tuyển dụng & Mạng lưới Headhunter OPR Hub tìm kiếm hồ sơ của bạn và chủ động gửi lời mời phỏng vấn.'
                  : 'Hồ sơ của bạn đang ở chế độ riêng tư. Nhà tuyển dụng sẽ không tìm thấy hoặc gửi lời mời ứng tuyển đến bạn.'}
              </p>
            </div>

            <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between text-2xs">
              <span
                className={`font-semibold inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full ${
                  isJobSeeking
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/80'
                    : 'bg-slate-100 text-slate-500 border border-slate-200'
                }`}
              >
                {isJobSeeking ? (
                  <>
                    <ThunderboltFilled className="text-emerald-500" />
                    Sẵn sàng nhận lời mời phỏng vấn
                  </>
                ) : (
                  'Chế độ riêng tư'
                )}
              </span>
              <button
                type="button"
                onClick={() => navigate('/candidate/profile')}
                className="text-blue-600 hover:text-blue-700 font-semibold"
              >
                Cài đặt hiển thị →
              </button>
            </div>
          </div>
        </Col>

        {/* Card 2: Thanh tiến độ hoàn thiện CV 75% chuẩn ATS */}
        <Col xs={24} lg={13}>
          <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs h-full flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <div className="flex items-center gap-2">
                  <SafetyCertificateOutlined className="text-blue-600 text-base" />
                  <span className="font-extrabold text-sm sm:text-base text-slate-900">
                    Hồ sơ của bạn đạt 75% chuẩn ATS
                  </span>
                </div>
                <span className="text-xs font-extrabold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200/80">
                  75% ATS
                </span>
              </div>

              {/* Progress bar */}
              <div className="my-2">
                <Progress
                  percent={75}
                  strokeColor={{ '0%': '#2563eb', '100%': '#38bdf8' }}
                  showInfo={false}
                  size="small"
                />
              </div>

              <p className="text-xs text-slate-500 m-0">
                Gợi ý bổ sung thêm kỹ năng để đạt 90%+ ATS và tăng 2.5x cơ hội được tuyển chọn:
              </p>

              {/* Skill Suggestions Chips */}
              <div className="flex flex-wrap gap-1.5 mt-2.5">
                {[
                  '+ Docker / K8s',
                  '+ Ngoại ngữ (IELTS/B2)',
                  '+ Link GitHub/Portfolio',
                  '+ Định lượng KPI/Metrics',
                ].map((skill) => (
                  <button
                    key={skill}
                    type="button"
                    onClick={() => navigate('/candidate/profile')}
                    className="text-2xs font-semibold px-2 py-1 rounded-lg bg-slate-50 hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200/80 hover:border-blue-200 transition-colors cursor-pointer"
                  >
                    {skill}
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between text-2xs">
              <span className="text-slate-500 font-medium">
                Cập nhật lần cuối: Hôm nay
              </span>
              <Button
                type="link"
                size="small"
                onClick={() => navigate('/candidate/profile')}
                className="font-bold text-xs text-blue-600 hover:text-blue-700 p-0"
              >
                Hoàn thiện hồ sơ ngay →
              </Button>
            </div>
          </div>
        </Col>
      </Row>

      {/* ─── Stats Grid ───────────────────────────────────────────────────── */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <FintechMetricCard
            label="Đơn ứng tuyển & Giới thiệu"
            value={myApplicationsCount}
            subLabel="Tiến trình tuyển dụng trực tiếp"
            statusBadge="Pipeline"
            statusType="eligible"
            icon={<TeamOutlined />}
            iconColor="#10b981"
            onClick={() => navigate('/candidate/applications')}
          />
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <FintechMetricCard
            label="Lịch phỏng vấn sắp tới"
            value={interviewCount}
            subLabel="Thông báo từ HR & Doanh nghiệp"
            statusBadge="Lịch PV"
            statusType="warranty"
            icon={<ClockCircleOutlined />}
            iconColor="#f59e0b"
            onClick={() => navigate('/candidate/applications')}
          />
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <FintechMetricCard
            label="Việc làm đã lưu"
            value={userSavedJobsCount}
            subLabel="Theo dõi cập nhật tuyển dụng"
            statusBadge="Saved"
            statusType="paid"
            icon={<TrophyOutlined />}
            iconColor="#2563eb"
            onClick={() => navigate('/candidate/saved-jobs')}
          />
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <FintechMetricCard
            label="Hồ sơ CV chuẩn ATS"
            value={userCVsCount}
            subLabel="Sẵn sàng gửi ứng tuyển"
            statusBadge="ATS Ready"
            statusType="info"
            icon={<FileTextOutlined />}
            iconColor="#6366f1"
            onClick={() => navigate('/candidate/profile')}
          />
        </Col>
      </Row>

      {/* ─── Main Content Panels ─────────────────────────────────────────── */}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={15}>
          <div className="b2b-card p-5">
            <div className="flex items-center justify-between gap-2 mb-4 pb-3 border-b border-slate-200/80">
              <div className="flex items-center gap-2">
                <TeamOutlined className="text-emerald-600" />
                <h3 className="text-sm font-bold text-slate-900 tracking-tight m-0">
                  Hồ sơ ứng tuyển &amp; được giới thiệu của tôi
                </h3>
              </div>
              <Button
                type="link"
                size="small"
                onClick={() => navigate('/candidate/applications')}
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 p-0"
              >
                Xem tất cả ({dedupedApps.length}) →
              </Button>
            </div>

            {dedupedApps.length === 0 ? (
              <Empty
                description={<span className="text-xs text-slate-500">Bạn chưa có hồ sơ ứng tuyển hoặc được giới thiệu nào.</span>}
                className="py-8"
              >
                <Button
                  type="primary"
                  onClick={() => navigate('/jobs')}
                  className="rounded-xl font-semibold bg-blue-600 hover:bg-blue-700 text-white border-none shadow-sm"
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
                className="bg-transparent"
                columns={[
                  {
                    title: 'VỊ TRÍ CÔNG VIỆC',
                    key: 'job',
                    render: (_, record) => (
                      <div>
                        <div className="font-semibold text-sm text-slate-900">
                          {record.jobTitle}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          🏢 {record.company}
                        </div>
                      </div>
                    ),
                  },
                  {
                    title: 'NGÀY NỘP',
                    dataIndex: 'appliedDate',
                    key: 'appliedDate',
                    width: 130,
                    render: (v: string) => <span className="text-xs font-mono text-slate-500">{v}</span>,
                  },
                  {
                    title: 'TRẠNG THÁI',
                    key: 'status',
                    width: 170,
                    render: (_, record) => (
                      <span
                        className="text-xs font-semibold px-2.5 py-0.5 rounded-full border inline-block"
                        style={{
                          color: record.statusColor,
                          background: `${record.statusColor}15`,
                          borderColor: `${record.statusColor}35`,
                        }}
                      >
                        {record.statusLabel}
                      </span>
                    ),
                  },
                ]}
              />
            )}
          </div>
        </Col>

        <Col xs={24} lg={9}>
          <div className="b2b-card p-5">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-200/80">
              <TrophyOutlined className="text-blue-600" />
              <h3 className="text-sm font-bold text-slate-900 tracking-tight m-0">
                Gợi ý nâng cấp hồ sơ
              </h3>
            </div>

            <div className="space-y-3">
              <div className="p-3.5 rounded-xl bg-slate-50/70 border border-slate-200/80">
                <div className="font-bold text-sm text-slate-900">
                  📄 Hoàn thiện hồ sơ cá nhân
                </div>
                <div className="text-xs text-slate-600 mt-1 leading-relaxed">
                  Cập nhật kỹ năng, ngoại ngữ và kinh nghiệm để thuật toán Sentence-BERT khớp nối với JD nhanh hơn.
                </div>
                <Button
                  size="small"
                  type="link"
                  onClick={() => navigate('/candidate/profile')}
                  className="p-0 mt-2 font-semibold text-xs text-blue-600 hover:text-blue-700"
                >
                  Cập nhật hồ sơ →
                </Button>
              </div>

              <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200/80">
                <div className="font-bold text-sm text-emerald-800">
                  🎯 Xuất CV chuẩn ATS (PDF)
                </div>
                <div className="text-xs text-slate-600 mt-1 leading-relaxed">
                  Xuất file PDF tương thích với các hệ thống ATS hàng đầu, định dạng chuẩn quốc tế.
                </div>
                <Button
                  size="small"
                  type="link"
                  onClick={() => navigate('/cv-builder')}
                  className="p-0 mt-2 font-semibold text-xs text-emerald-700 hover:text-emerald-800"
                >
                  Tạo CV ngay →
                </Button>
              </div>
            </div>
          </div>
        </Col>
      </Row>
    </div>
  );
};

export default CandidateDashboardPage;
