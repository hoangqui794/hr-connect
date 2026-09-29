import React, { useState } from 'react';
import {
  Card,
  Tabs,
  Table,
  Tag,
  Button,
  Modal,
  Row,
  Col,
  Avatar,
  Steps,
  Empty,
  Typography,
  message,
} from 'antd';
import {
  CheckCircleOutlined,
  CalendarOutlined,
  TeamOutlined,
  VideoCameraOutlined,
  EnvironmentOutlined,
  FileTextOutlined,
  SafetyCertificateOutlined,
  ClockCircleOutlined,
  CheckOutlined,
  CloseOutlined,
  DollarCircleOutlined,
  FireOutlined,
} from '@ant-design/icons';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useCandidateStore, CandidateApplication } from '@/stores/candidateStore';
import { useAuthStore } from '@/stores/authStore';
import { useApplicationStore, APPLICATION_STATUS_LABELS, APPLICATION_STATUS_COLORS } from '@/stores/applicationStore';

const { Title, Text, Paragraph } = Typography;

export const CandidateApplicationsPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTabKey = searchParams.get('subtab') || 'applied';

  const { applications: storeApplications, interviews, recruiterConnects, respondToOffer } = useCandidateStore();
  const { user } = useAuthStore();
  const sharedApps = useApplicationStore((s) => s.applications);

  const currentUserEmail = (user?.email || '').toLowerCase().trim();

  const mySharedApps = React.useMemo(() => {
    if (!currentUserEmail) return [];
    return sharedApps.filter((a) => {
      const email = ((a as any).candidateEmail || a.email || '').toLowerCase().trim();
      return email === currentUserEmail;
    });
  }, [currentUserEmail, sharedApps]);

  const myStoreApps = React.useMemo(() => {
    if (!currentUserEmail) return [];
    return (storeApplications || []).filter((a) => {
      const email = (a.candidateEmail || a.applicantEmail || '').toLowerCase().trim();
      return email === currentUserEmail;
    });
  }, [currentUserEmail, storeApplications]);

  const applications: CandidateApplication[] = React.useMemo(() => {
    const fromShared: CandidateApplication[] = mySharedApps.map((a) => ({
      id: a.id,
      jobId: a.jobId,
      jobTitle: a.jobTitle,
      company: a.company,
      salary: '35.000.000 - 55.000.000 đ',
      appliedDate: new Date(a.applyDate).toLocaleDateString('vi-VN'),
      status:
        a.status === 'OFFERED' || a.status === 'ONBOARDED'
          ? 'OFFER'
          : a.status === 'INTERVIEW_SCHEDULED' || a.status === 'INTERVIEW_PASSED'
          ? 'INTERVIEW'
          : a.status === 'SCREENING'
          ? 'SCREENED'
          : 'SUBMITTED',
      statusLabel: APPLICATION_STATUS_LABELS[a.status] || a.status,
      statusColor: APPLICATION_STATUS_COLORS[a.status] || '#00b14f',
      cvUsed: 'CV Kỹ sư Frontend Web / ReactJS Developer (ATS Standard)',
      applicantName: a.fullName,
      applicantEmail: a.email,
      candidateEmail: a.email,
      applicantPhone: a.phone,
    }));

    const sharedJobIds = new Set(fromShared.map((f) => f.jobId));
    const rest = myStoreApps.filter((app) => !sharedJobIds.has(app.jobId));
    return [...fromShared, ...rest];
  }, [mySharedApps, myStoreApps]);

  const userInterviews = React.useMemo(() => {
    if (!currentUserEmail) return [];
    return (interviews || []).filter((i) => {
      const email = (i.candidateEmail || i.applicantEmail || '').toLowerCase().trim();
      return email === currentUserEmail;
    });
  }, [currentUserEmail, interviews]);

  const userRecruiterConnects = React.useMemo(() => {
    if (!currentUserEmail) return [];
    return (recruiterConnects || []).filter((r) => {
      const email = (r.candidateEmail || r.userEmail || '').toLowerCase().trim();
      return email === currentUserEmail;
    });
  }, [currentUserEmail, recruiterConnects]);

  // Offer Letter Modal State
  const [selectedOfferApp, setSelectedOfferApp] = useState<CandidateApplication | null>(null);

  const handleDecision = (appId: string, decision: 'ACCEPTED' | 'REJECTED') => {
    respondToOffer(appId, decision);
    setSelectedOfferApp(null);
    if (decision === 'ACCEPTED') {
      message.success('Chúc mừng bạn đã chấp thuận Thư mời nhận việc! Bộ phận HR sẽ liên hệ onboarding.');
    } else {
      message.info('Bạn đã từ chối Offer nhận việc này.');
    }
  };

  const getStepCurrent = (status: CandidateApplication['status']) => {
    switch (status) {
      case 'SUBMITTED':
        return 0;
      case 'SCREENED':
        return 1;
      case 'INTERVIEW':
        return 2;
      case 'OFFER':
        return 3;
      default:
        return 0;
    }
  };

  return (
    <div className="max-w-6xl mx-auto pt-8 pb-16 px-4 font-sans">
      {/* ─── Top Header Card ────────────────────────────────────────── */}
      <Card
        className="mb-6 border border-slate-200/90 shadow-sm hover:shadow-md transition-all duration-300 rounded-2xl bg-white"
        bodyStyle={{ padding: '28px 32px' }}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              <Title level={2} style={{ margin: 0, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' }}>
                Lịch Sử Ứng Tuyển & Lịch Phỏng Vấn
              </Title>
              <Tag color="success" className="font-bold text-xs px-2.5 py-0.5 rounded-full border-emerald-300 bg-emerald-50 text-emerald-700">
                ● Cập nhật Thời Gian Thực
              </Tag>
            </div>
            <Text className="text-slate-600 text-sm">
              Theo dõi trực tiếp trạng thái tiến độ tuyển dụng từ lúc nộp, sơ tuyển AI, lịch phỏng vấn đến khi nhận Offer chính thức.
            </Text>
          </div>

          <div className="flex items-center gap-3">
            <div className="bg-slate-50 border border-slate-200/80 rounded-xl px-5 py-3 text-center min-w-[105px]">
              <div className="text-2xl font-extrabold text-emerald-600 tabular-nums">
                {applications.length}
              </div>
              <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Đã nộp hồ sơ
              </div>
            </div>
            <div className="bg-slate-50 border border-slate-200/80 rounded-xl px-5 py-3 text-center min-w-[105px]">
              <div className="text-2xl font-extrabold text-blue-600 tabular-nums">
                {userInterviews.length}
              </div>
              <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Lịch PV sắp tới
              </div>
            </div>
            <div className="bg-slate-50 border border-slate-200/80 rounded-xl px-5 py-3 text-center min-w-[105px]">
              <div className="text-2xl font-extrabold text-purple-600 tabular-nums">
                {userRecruiterConnects.length}
              </div>
              <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Gửi Recruiter
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* ─── Main Tabs Container ────────────────────────────────────── */}
      <Card
        className="border border-slate-200/90 shadow-sm rounded-2xl bg-white"
        bodyStyle={{ padding: '24px' }}
      >
        <Tabs
          activeKey={activeTabKey}
          onChange={(key) => setSearchParams({ subtab: key })}
          size="large"
          items={[
            // ==================== TAB 1: APPLICATIONS ====================
            {
              key: 'applied',
              label: (
                <span className="font-semibold text-sm flex items-center gap-2">
                  <CheckCircleOutlined />
                  Việc làm đã nộp ({applications.length})
                </span>
              ),
              children: (
                <div className="pt-2">
                  {applications.length === 0 ? (
                    <Empty
                      description="Bạn chưa nộp hồ sơ vào công việc nào."
                      className="py-12"
                    >
                      <Button
                        type="primary"
                        onClick={() => navigate('/')}
                        className="rounded-lg h-10 font-semibold bg-emerald-600 hover:bg-emerald-700 border-none"
                      >
                        Khám phá việc làm ngay
                      </Button>
                    </Empty>
                  ) : (
                    <div className="flex flex-col gap-4">
                      {applications.map((app) => {
                        const currentStep = getStepCurrent(app.status);
                        const isOffered = app.status === 'OFFER';

                        return (
                          <div
                            key={app.id}
                            className={`rounded-xl border p-5 transition-all duration-300 ${
                              isOffered
                                ? 'border-emerald-300 bg-emerald-50/20 hover:border-emerald-400 shadow-sm'
                                : 'border-slate-200/90 bg-white hover:border-slate-300 hover:shadow-md'
                            }`}
                          >
                            <Row gutter={[20, 16]} align="middle">
                              {/* Thông tin công việc & Lương */}
                              <Col xs={24} lg={9}>
                                <div className="flex items-center gap-2.5 mb-1.5 flex-wrap">
                                  <Text strong className="text-base text-slate-900 font-bold tracking-tight">
                                    {app.jobTitle}
                                  </Text>
                                  {isOffered && (
                                    <Tag color="success" className="font-bold text-[11px] rounded-full border-emerald-300">
                                      <FireOutlined className="mr-1" />
                                      Offer đã sẵn sàng
                                    </Tag>
                                  )}
                                </div>
                                <div className="text-xs text-slate-500 font-medium mb-2.5 flex items-center gap-1.5">
                                  <span>🏢</span>
                                  <span className="font-semibold text-slate-700">{app.company}</span>
                                </div>
                                
                                {/* Thẻ Mức lương kỳ vọng nổi bật */}
                                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold mb-2">
                                  <DollarCircleOutlined className="text-emerald-600 text-sm" />
                                  <span>Lương kỳ vọng:</span>
                                  <span className="tabular-nums currency-kpi font-extrabold text-emerald-700">
                                    {app.salary || '35.000.000 - 55.000.000 đ'}
                                  </span>
                                </div>

                                <div className="flex items-center gap-3 text-xs text-slate-500">
                                  <span>📅 Nộp: <strong className="text-slate-700">{app.appliedDate}</strong></span>
                                  <span>•</span>
                                  <span className="truncate max-w-[220px]">
                                    <FileTextOutlined className="mr-1 text-slate-400" />
                                    {app.cvUsed}
                                  </span>
                                </div>
                              </Col>

                              {/* Tiến độ Stepper 4 bước chuẩn Antd v5 (Không bao giờ vỡ text) */}
                              <Col xs={24} lg={11}>
                                <div className="py-2 px-3 bg-slate-50/80 rounded-xl border border-slate-100">
                                  <Steps
                                    size="small"
                                    current={currentStep}
                                    responsive={false}
                                    items={[
                                      {
                                        title: 'Bước 1',
                                        description: 'Đã nộp hồ sơ',
                                      },
                                      {
                                        title: 'Bước 2',
                                        description: (
                                          <span className="font-semibold text-emerald-700">
                                            Sơ tuyển AI (89% Match)
                                          </span>
                                        ),
                                      },
                                      {
                                        title: 'Bước 3',
                                        description: 'Lịch phỏng vấn',
                                      },
                                      {
                                        title: 'Bước 4',
                                        description: 'Nhận Offer',
                                      },
                                    ]}
                                  />
                                </div>
                              </Col>

                              {/* Hành động & Nút Xem Thư Mời hiệu ứng Pulsing */}
                              <Col xs={24} lg={4} className="text-right">
                                {isOffered ? (
                                  <Button
                                    type="primary"
                                    icon={<SafetyCertificateOutlined />}
                                    onClick={() => setSelectedOfferApp(app)}
                                    className="offer-pulse-btn rounded-xl font-bold bg-emerald-600 hover:bg-emerald-700 text-white border-none h-10 px-5 shadow-sm inline-flex items-center gap-2"
                                  >
                                    Xem Thư Mời
                                  </Button>
                                ) : (
                                  <Tag
                                    className="py-1 px-3.5 rounded-full font-bold text-xs"
                                    style={{
                                      background: `${app.statusColor}14`,
                                      color: app.statusColor,
                                      border: `1px solid ${app.statusColor}35`,
                                    }}
                                  >
                                    {app.statusLabel}
                                  </Tag>
                                )}
                              </Col>
                            </Row>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ),
            },

            // ==================== TAB 2: INTERVIEWS ====================
            {
              key: 'interviews',
              label: (
                <span className="font-semibold text-sm flex items-center gap-2">
                  <CalendarOutlined />
                  Lịch phỏng vấn sắp tới ({userInterviews.length})
                </span>
              ),
              children: (
                <div className="pt-2">
                  {userInterviews.length === 0 ? (
                    <Empty description="Hiện chưa có lịch phỏng vấn nào được xếp." className="py-12" />
                  ) : (
                    <Row gutter={[20, 20]}>
                      {userInterviews.map((item) => (
                        <Col xs={24} md={12} key={item.id}>
                          <div className="rounded-xl border border-slate-200/90 bg-white p-5 flex flex-col justify-between h-full hover:shadow-md transition-all duration-300">
                            <div>
                              <div className="flex justify-between items-start mb-3 gap-2">
                                <div>
                                  <div className="font-bold text-base text-slate-900">
                                    {item.jobTitle}
                                  </div>
                                  <div className="text-xs text-slate-500 font-medium">
                                    🏢 {item.company}
                                  </div>
                                </div>
                                <Tag
                                  className="rounded-full font-bold text-xs px-2.5 py-0.5"
                                  color={item.mode === 'ONLINE' ? 'blue' : 'success'}
                                >
                                  {item.mode === 'ONLINE' ? 'Phỏng vấn Online' : 'Phỏng vấn Trực tiếp'}
                                </Tag>
                              </div>

                              <div className="bg-slate-50 border border-slate-200/80 p-3 rounded-lg mb-3">
                                <div className="flex items-center gap-2 text-emerald-700 font-bold text-sm">
                                  <ClockCircleOutlined />
                                  <span>{item.datetime}</span>
                                </div>
                              </div>

                              <div className="mb-2 text-xs">
                                <Text type="secondary" className="block font-semibold text-slate-500">Người phỏng vấn:</Text>
                                <Text strong className="text-slate-800">{item.interviewers}</Text>
                              </div>

                              {item.address && (
                                <div className="mb-2 text-xs">
                                  <Text type="secondary" className="block font-semibold text-slate-500">Địa chỉ văn phòng:</Text>
                                  <Text className="text-slate-700"><EnvironmentOutlined /> {item.address}</Text>
                                </div>
                              )}

                              <div className="text-xs">
                                <Text type="secondary" className="block font-semibold text-slate-500">Ghi chú chuẩn bị:</Text>
                                <Text className="text-slate-600">{item.notes}</Text>
                              </div>
                            </div>

                            <div className="mt-4 pt-3 border-t border-slate-100">
                              {item.mode === 'ONLINE' && item.link ? (
                                <Button
                                  type="primary"
                                  block
                                  icon={<VideoCameraOutlined />}
                                  href={item.link}
                                  target="_blank"
                                  className="rounded-lg font-bold h-9 bg-emerald-600 hover:bg-emerald-700 text-white border-none"
                                >
                                  Vào phòng Google Meet / Zoom
                                </Button>
                              ) : (
                                <Button
                                  block
                                  icon={<EnvironmentOutlined />}
                                  onClick={() => message.info(`Địa điểm: ${item.address}`)}
                                  className="rounded-lg font-bold h-9 border-slate-200 text-slate-700"
                                >
                                  Xem chỉ đường văn phòng
                                </Button>
                              )}
                            </div>
                          </div>
                        </Col>
                      ))}
                    </Row>
                  )}
                </div>
              ),
            },

            // ==================== TAB 3: RECRUITERS ====================
            {
              key: 'recruiters',
              label: (
                <span className="font-semibold text-sm flex items-center gap-2">
                  <TeamOutlined />
                  Hồ sơ gửi Recruiter ({userRecruiterConnects.length})
                </span>
              ),
              children: (
                <div className="pt-2">
                  {userRecruiterConnects.length === 0 ? (
                    <Empty
                      description="Bạn chưa gửi gắm hồ sơ cho chuyên gia Recruiter nào."
                      className="py-12"
                    >
                      <Button
                        type="primary"
                        onClick={() => navigate('/?mode=recruiters')}
                        className="rounded-lg h-10 font-semibold bg-emerald-600 hover:bg-emerald-700 border-none"
                      >
                        Khám phá Mạng lưới Recruiter OPR Hub
                      </Button>
                    </Empty>
                  ) : (
                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                      <Table
                        dataSource={userRecruiterConnects}
                        rowKey="id"
                        pagination={false}
                        columns={[
                          {
                            title: 'Chuyên gia Headhunter',
                            key: 'recruiter',
                            render: (_, record) => (
                              <div className="flex items-center gap-3">
                                <Avatar size={40} className="bg-emerald-600 font-extrabold text-white">
                                  {record.recruiterAvatar}
                                </Avatar>
                                <div>
                                  <div className="font-bold text-sm text-slate-900">{record.recruiterName}</div>
                                  <div className="text-xs text-slate-500">{record.recruiterTitle}</div>
                                </div>
                              </div>
                            ),
                          },
                          {
                            title: 'Bản CV đã gửi',
                            dataIndex: 'cvUsed',
                            key: 'cvUsed',
                            render: (cv) => (
                              <Tag icon={<FileTextOutlined />} className="rounded-full bg-slate-100 border-slate-200 text-slate-700 px-2.5 py-0.5 text-xs font-medium">
                                {cv}
                              </Tag>
                            ),
                          },
                          {
                            title: 'Ngày gửi',
                            dataIndex: 'sentDate',
                            key: 'sentDate',
                            width: 120,
                            render: (date) => <span className="text-xs text-slate-600 font-medium tabular-nums">{date}</span>,
                          },
                          {
                            title: 'Lời nhắn gửi kèm',
                            dataIndex: 'note',
                            key: 'note',
                            render: (note) => (
                              <Paragraph ellipsis={{ rows: 2, tooltip: note }} className="mb-0 text-xs text-slate-600">
                                {note}
                              </Paragraph>
                            ),
                          },
                          {
                            title: 'Trạng thái kết nối',
                            key: 'status',
                            render: (_, record) => (
                              <div>
                                <Tag
                                  className="rounded-full font-bold text-xs px-2.5 py-0.5"
                                  style={{
                                    background: `${record.statusColor}14`,
                                    color: record.statusColor,
                                    border: `1px solid ${record.statusColor}40`,
                                  }}
                                >
                                  {record.statusLabel}
                                </Tag>
                                {record.matchedJob && (
                                  <div className="text-[11px] text-emerald-600 font-semibold mt-1">
                                    🎯 {record.matchedJob}
                                  </div>
                                )}
                              </div>
                            ),
                          },
                        ]}
                      />
                    </div>
                  )}
                </div>
              ),
            },
          ]}
        />
      </Card>

      {/* ─── Modal Xem Thư Mời Nhận Việc (Official Offer Letter) ─────── */}
      <Modal
        title={
          <div className="flex items-center gap-2.5 text-emerald-700">
            <SafetyCertificateOutlined className="text-xl" />
            <span className="text-base font-extrabold">Thư Mời Nhận Việc Chính Thức (Job Offer Letter)</span>
          </div>
        }
        open={!!selectedOfferApp}
        onCancel={() => setSelectedOfferApp(null)}
        width={600}
        footer={[
          <Button
            key="reject"
            danger
            icon={<CloseOutlined />}
            onClick={() => selectedOfferApp && handleDecision(selectedOfferApp.id, 'REJECTED')}
            className="rounded-lg font-semibold h-9"
          >
            Từ chối Offer
          </Button>,
          <Button
            key="accept"
            type="primary"
            icon={<CheckOutlined />}
            onClick={() => selectedOfferApp && handleDecision(selectedOfferApp.id, 'ACCEPTED')}
            className="rounded-lg font-bold bg-emerald-600 hover:bg-emerald-700 text-white border-none h-9 px-5 shadow-sm"
          >
            Chấp thuận Offer
          </Button>,
        ]}
      >
        {selectedOfferApp && selectedOfferApp.offerDetails && (
          <div className="py-2">
            <div className="bg-slate-50 p-4 rounded-xl mb-4 border border-slate-200/80">
              <div className="text-base font-bold text-slate-900">
                {selectedOfferApp.offerDetails.position}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                Doanh nghiệp tuyển dụng: <strong className="text-slate-800">{selectedOfferApp.company}</strong>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-emerald-50 p-3.5 rounded-xl border border-emerald-200">
                <Text className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 block">
                  Mức lương chính thức (Gross)
                </Text>
                <div className="text-base font-extrabold text-emerald-700 mt-1 tabular-nums currency-kpi">
                  {selectedOfferApp.offerDetails.salary}
                </div>
              </div>

              <div className="bg-blue-50 p-3.5 rounded-xl border border-blue-200">
                <Text className="text-[11px] font-bold uppercase tracking-wider text-blue-700 block">
                  Ngày bắt đầu làm việc
                </Text>
                <div className="text-base font-extrabold text-blue-700 mt-1 tabular-nums">
                  {selectedOfferApp.offerDetails.startDate}
                </div>
              </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 text-xs leading-relaxed">
              <Text strong className="block mb-1 text-slate-800">
                Chính sách đãi ngộ & Thời hạn thử việc:
              </Text>
              <Paragraph className="mb-0 text-slate-600">
                {selectedOfferApp.offerDetails.note}
              </Paragraph>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default CandidateApplicationsPage;
