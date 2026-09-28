import React, { useState } from 'react';
import {
  Card,
  Tabs,
  Table,
  Tag,
  Button,
  Space,
  Modal,
  Row,
  Col,
  Avatar,
  Steps,
  Empty,
  Typography,
  Divider,
  message,
} from 'antd';
import {
  CheckCircleOutlined,
  CalendarOutlined,
  TeamOutlined,
  VideoCameraOutlined,
  EnvironmentOutlined,
  EyeOutlined,
  FileTextOutlined,
  SafetyCertificateOutlined,
  ClockCircleOutlined,
  CheckOutlined,
  CloseOutlined,
  UserOutlined,
  CompassOutlined,
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
      salary: 'Thỏa thuận theo năng lực',
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
      statusColor: APPLICATION_STATUS_COLORS[a.status] || '#0284c7',
      cvUsed: 'CV Chuyên viên Phát triển Phần mềm (ATS Standard)',
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
      message.success('Chúc mừng bạn đã chấp thuận Thư mời nhận việc! HR sẽ liên hệ để hướng dẫn onboard.');
    } else {
      message.info('Bạn đã từ chối thư mời nhận việc.');
    }
  };

  // Helper for Steps in Job Application
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
    <div style={{ maxWidth: 1200, margin: '0 auto', paddingBottom: 60 }}>
      {/* Header Banner */}
      <div
        style={{
          borderRadius: 20,
          background: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(51, 65, 85, 0.65)',
          color: '#fff',
          marginBottom: 24,
          padding: '28px 32px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <Title level={3} style={{ color: '#fff', margin: 0, fontWeight: 800, letterSpacing: '-0.02em' }}>
                Lịch Sử Ứng Tuyển & Lịch Phỏng Vấn
              </Title>
              <Tag
                style={{
                  borderRadius: 9999,
                  fontWeight: 700,
                  fontSize: 11,
                  background: 'rgba(37, 99, 235, 0.15)',
                  color: '#60a5fa',
                  border: '1px solid rgba(59, 130, 246, 0.3)',
                  padding: '2px 10px',
                }}
              >
                Thời Gian Thực
              </Tag>
            </div>
            <Text style={{ color: '#94a3b8', fontSize: 14 }}>
              Theo dõi xuyên suốt tiến độ hồ sơ tuyển dụng từ lúc nộp, sơ tuyển AI, lịch phỏng vấn đến khi nhận Offer.
            </Text>
          </div>

          <div style={{ display: 'flex', gap: 14 }}>
            <div style={{ textAlign: 'center', background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(51, 65, 85, 0.65)', padding: '10px 18px', borderRadius: 14 }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#38bdf8', fontFamily: 'monospace' }}>{applications.length}</div>
              <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Việc làm đã nộp</div>
            </div>
            <div style={{ textAlign: 'center', background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(51, 65, 85, 0.65)', padding: '10px 18px', borderRadius: 14 }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#a78bfa', fontFamily: 'monospace' }}>{userInterviews.length}</div>
              <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Lịch PV sắp tới</div>
            </div>
            <div style={{ textAlign: 'center', background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(51, 65, 85, 0.65)', padding: '10px 18px', borderRadius: 14 }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#34d399', fontFamily: 'monospace' }}>{userRecruiterConnects.length}</div>
              <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Hồ sơ gửi Recruiter</div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Tabs */}
      <div
        style={{
          borderRadius: 20,
          background: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(51, 65, 85, 0.65)',
          padding: '24px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
        }}
      >
        <Tabs
          activeKey={activeTabKey}
          onChange={(key) => setSearchParams({ subtab: key })}
          size="large"
          items={[
            // ==================== TAB 1 ====================
            {
              key: 'applied',
              label: (
                <span style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <CheckCircleOutlined />
                  Việc làm đã nộp ({applications.length})
                </span>
              ),
              children: (
                <div style={{ paddingTop: 10 }}>
                  {applications.length === 0 ? (
                    <Empty
                      description="Bạn chưa nộp hồ sơ vào công việc nào."
                      style={{ padding: '40px 0' }}
                    >
                      <Button type="primary" onClick={() => navigate('/')} style={{ borderRadius: 12, height: 40, fontWeight: 600 }}>
                        Khám phá việc làm ngay
                      </Button>
                    </Empty>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                      {applications.map((app) => {
                        const currentStep = getStepCurrent(app.status);
                        const isOffered = app.status === 'OFFER';

                        return (
                          <div
                            key={app.id}
                            style={{
                              borderRadius: 16,
                              border: isOffered ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(51, 65, 85, 0.65)',
                              background: isOffered ? 'rgba(6, 78, 59, 0.2)' : 'rgba(15, 23, 42, 0.7)',
                              padding: '22px 24px',
                              transition: 'all 0.2s ease',
                            }}
                          >
                            <Row gutter={[20, 20]} align="middle">
                              {/* Thông tin công việc */}
                              <Col xs={24} lg={10}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                  <Text strong style={{ fontSize: 16, color: '#f8fafc', letterSpacing: '-0.01em' }}>
                                    {app.jobTitle}
                                  </Text>
                                  {isOffered && (
                                    <Tag
                                      style={{
                                        borderRadius: 9999,
                                        fontWeight: 700,
                                        fontSize: 11,
                                        background: 'rgba(16, 185, 129, 0.2)',
                                        color: '#34d399',
                                        border: '1px solid rgba(16, 185, 129, 0.4)',
                                      }}
                                    >
                                      Offer đã sẵn sàng
                                    </Tag>
                                  )}
                                </div>
                                <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 8 }}>
                                  🏢 {app.company}
                                </div>
                                <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 12.5, color: '#cbd5e1' }}>
                                  <span>💰 <strong>{app.salary}</strong></span>
                                  <span>📅 Nộp: {app.appliedDate}</span>
                                </div>
                                <div style={{ marginTop: 8, fontSize: 12, color: '#94a3b8' }}>
                                  <FileTextOutlined style={{ marginRight: 4, color: '#38bdf8' }} />
                                  CV sử dụng: <strong style={{ color: '#cbd5e1' }}>{app.cvUsed}</strong>
                                </div>
                              </Col>

                              {/* Tiến độ quy trình (Antd Steps thu nhỏ) */}
                              <Col xs={24} lg={10}>
                                <div style={{ padding: '8px 0' }}>
                                  <Steps
                                    size="small"
                                    current={currentStep}
                                    items={[
                                      { title: 'Đã nộp hồ sơ' },
                                      { title: 'Sơ tuyển AI' },
                                      { title: 'Phỏng vấn' },
                                      { title: 'Nhận Offer' },
                                    ]}
                                  />
                                </div>
                              </Col>

                              {/* Hành động */}
                              <Col xs={24} lg={4} style={{ textAlign: 'right' }}>
                                {isOffered ? (
                                  <Button
                                    type="primary"
                                    icon={<SafetyCertificateOutlined />}
                                    onClick={() => setSelectedOfferApp(app)}
                                    style={{
                                      borderRadius: 12,
                                      fontWeight: 700,
                                      background: 'linear-gradient(135deg, #10b981, #059669)',
                                      border: 'none',
                                      boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
                                      height: 38,
                                    }}
                                  >
                                    Xem Thư Mời
                                  </Button>
                                ) : (
                                  <Tag
                                    style={{
                                      padding: '6px 14px',
                                      borderRadius: 9999,
                                      fontWeight: 700,
                                      fontSize: 12,
                                      background: `${app.statusColor}18`,
                                      color: app.statusColor,
                                      border: `1px solid ${app.statusColor}40`,
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

            // ==================== TAB 2 ====================
            {
              key: 'interviews',
              label: (
                <span style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <CalendarOutlined />
                  Lịch phỏng vấn sắp tới ({userInterviews.length})
                </span>
              ),
              children: (
                <div style={{ paddingTop: 10 }}>
                  {userInterviews.length === 0 ? (
                    <Empty description="Hiện chưa có lịch phỏng vấn nào được xếp." style={{ padding: '40px 0' }} />
                  ) : (
                    <Row gutter={[20, 20]}>
                      {userInterviews.map((item) => (
                        <Col xs={24} md={12} key={item.id}>
                          <div
                            style={{
                              borderRadius: 16,
                              border: '1px solid rgba(51, 65, 85, 0.65)',
                              background: 'rgba(15, 23, 42, 0.7)',
                              height: '100%',
                              display: 'flex',
                              flexDirection: 'column',
                              justifyContent: 'space-between',
                              padding: '24px',
                              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.15)',
                            }}
                          >
                            <div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                                <div>
                                  <div style={{ fontWeight: 800, fontSize: 16, color: '#f8fafc' }}>
                                    {item.jobTitle}
                                  </div>
                                  <div style={{ fontSize: 13, color: '#94a3b8' }}>
                                    🏢 {item.company}
                                  </div>
                                </div>
                                <Tag
                                  style={{
                                    borderRadius: 9999,
                                    fontWeight: 700,
                                    padding: '3px 10px',
                                    background: item.mode === 'ONLINE' ? 'rgba(37, 99, 235, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                                    color: item.mode === 'ONLINE' ? '#60a5fa' : '#34d399',
                                    border: item.mode === 'ONLINE' ? '1px solid rgba(59, 130, 246, 0.3)' : '1px solid rgba(16, 185, 129, 0.3)',
                                  }}
                                >
                                  {item.mode === 'ONLINE' ? 'Phỏng vấn Online' : 'Phỏng vấn Trực tiếp'}
                                </Tag>
                              </div>

                              <div style={{ background: 'rgba(11, 15, 23, 0.6)', border: '1px solid rgba(51, 65, 85, 0.5)', padding: '12px 16px', borderRadius: 12, marginBottom: 16 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#38bdf8', fontWeight: 700, fontSize: 14 }}>
                                  <ClockCircleOutlined />
                                  <span>{item.datetime}</span>
                                </div>
                              </div>

                              <div style={{ marginBottom: 12, fontSize: 13 }}>
                                <Text type="secondary" style={{ display: 'block', fontWeight: 600, color: '#94a3b8' }}>Người phỏng vấn:</Text>
                                <Text strong style={{ color: '#cbd5e1' }}>{item.interviewers}</Text>
                              </div>

                              {item.address && (
                                <div style={{ marginBottom: 12, fontSize: 13 }}>
                                  <Text type="secondary" style={{ display: 'block', fontWeight: 600, color: '#94a3b8' }}>Địa chỉ văn phòng:</Text>
                                  <Text style={{ color: '#cbd5e1' }}><EnvironmentOutlined /> {item.address}</Text>
                                </div>
                              )}

                              <div style={{ fontSize: 13 }}>
                                <Text type="secondary" style={{ display: 'block', fontWeight: 600, color: '#94a3b8' }}>Ghi chú chuẩn bị:</Text>
                                <Text style={{ color: '#94a3b8' }}>{item.notes}</Text>
                              </div>
                            </div>

                            <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid rgba(51, 65, 85, 0.4)' }}>
                              {item.mode === 'ONLINE' && item.link ? (
                                <Button
                                  type="primary"
                                  block
                                  icon={<VideoCameraOutlined />}
                                  href={item.link}
                                  target="_blank"
                                  style={{
                                    borderRadius: 12,
                                    fontWeight: 700,
                                    height: 40,
                                    background: 'linear-gradient(135deg, #0284c7, #0369a1)',
                                    border: 'none',
                                  }}
                                >
                                  Vào phòng Google Meet / Zoom
                                </Button>
                              ) : (
                                <Button
                                  block
                                  icon={<EnvironmentOutlined />}
                                  onClick={() => message.info(`Địa điểm: ${item.address}`)}
                                  style={{
                                    borderRadius: 12,
                                    fontWeight: 700,
                                    height: 40,
                                    background: 'rgba(15, 23, 42, 0.8)',
                                    border: '1px solid rgba(51, 65, 85, 0.65)',
                                    color: '#f8fafc',
                                  }}
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

            // ==================== TAB 3 ====================
            {
              key: 'recruiters',
              label: (
                <span style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <TeamOutlined />
                  Hồ sơ gửi Recruiter ({userRecruiterConnects.length})
                </span>
              ),
              children: (
                <div style={{ paddingTop: 10 }}>
                  {userRecruiterConnects.length === 0 ? (
                    <Empty
                      description="Bạn chưa gửi gắm hồ sơ cho chuyên gia Recruiter nào."
                      style={{ padding: '40px 0' }}
                    >
                      <Button type="primary" onClick={() => navigate('/?mode=recruiters')} style={{ borderRadius: 12, height: 40, fontWeight: 600 }}>
                        Khám phá Mạng lưới Recruiter OPR Hub
                      </Button>
                    </Empty>
                  ) : (
                    <Table
                      dataSource={userRecruiterConnects}
                      rowKey="id"
                      pagination={false}
                      columns={[
                        {
                          title: 'Chuyên gia Headhunter',
                          key: 'recruiter',
                          render: (_, record) => (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                              <Avatar size={42} style={{ background: '#0284c7', fontWeight: 800 }}>
                                {record.recruiterAvatar}
                              </Avatar>
                              <div>
                                <div style={{ fontWeight: 700, fontSize: 14, color: '#f8fafc' }}>{record.recruiterName}</div>
                                <div style={{ fontSize: 12, color: '#94a3b8' }}>{record.recruiterTitle}</div>
                              </div>
                            </div>
                          ),
                        },
                        {
                          title: 'Bản CV đã gửi',
                          dataIndex: 'cvUsed',
                          key: 'cvUsed',
                          render: (cv) => (
                            <Tag icon={<FileTextOutlined />} style={{ borderRadius: 9999, background: 'rgba(30, 41, 59, 0.8)', border: '1px solid rgba(51, 65, 85, 0.6)', color: '#cbd5e1', padding: '2px 10px' }}>
                              {cv}
                            </Tag>
                          ),
                        },
                        {
                          title: 'Ngày gửi',
                          dataIndex: 'sentDate',
                          key: 'sentDate',
                          width: 120,
                        },
                        {
                          title: 'Lời nhắn gửi kèm',
                          dataIndex: 'note',
                          key: 'note',
                          render: (note) => (
                            <Paragraph ellipsis={{ rows: 2, tooltip: note }} style={{ margin: 0, fontSize: 13, color: '#cbd5e1' }}>
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
                                style={{
                                  borderRadius: 9999,
                                  fontWeight: 700,
                                  background: `${record.statusColor}18`,
                                  color: record.statusColor,
                                  border: `1px solid ${record.statusColor}40`,
                                  padding: '3px 10px',
                                }}
                              >
                                {record.statusLabel}
                              </Tag>
                              {record.matchedJob && (
                                <div style={{ fontSize: 11, color: '#34d399', fontWeight: 600, marginTop: 4 }}>
                                  🎯 {record.matchedJob}
                                </div>
                              )}
                            </div>
                          ),
                        },
                      ]}
                    />
                  )}
                </div>
              ),
            },
          ]}
        />
      </div>

      {/* Modal Xem Thư Mời Nhận Việc (Official Offer Letter) */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#34d399' }}>
            <SafetyCertificateOutlined style={{ fontSize: 20 }} />
            <span style={{ fontSize: 17, fontWeight: 800 }}>Thư Mời Nhận Việc Chính Thức (Job Offer Letter)</span>
          </div>
        }
        open={!!selectedOfferApp}
        onCancel={() => setSelectedOfferApp(null)}
        width={620}
        styles={{
          body: {
            background: '#0f172a',
            borderRadius: 16,
          },
        }}
        footer={[
          <Button
            key="reject"
            danger
            icon={<CloseOutlined />}
            onClick={() => selectedOfferApp && handleDecision(selectedOfferApp.id, 'REJECTED')}
            style={{ borderRadius: 12, fontWeight: 600, height: 38 }}
          >
            Từ chối Offer
          </Button>,
          <Button
            key="accept"
            type="primary"
            icon={<CheckOutlined />}
            onClick={() => selectedOfferApp && handleDecision(selectedOfferApp.id, 'ACCEPTED')}
            style={{
              borderRadius: 12,
              fontWeight: 700,
              background: '#10b981',
              border: 'none',
              boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
              height: 38,
            }}
          >
            Chấp thuận Offer
          </Button>,
        ]}
      >
        {selectedOfferApp && selectedOfferApp.offerDetails && (
          <div style={{ padding: '8px 0' }}>
            <div style={{ background: 'rgba(11, 15, 23, 0.8)', padding: '16px 20px', borderRadius: 14, marginBottom: 18, border: '1px solid rgba(51, 65, 85, 0.65)' }}>
              <div style={{ fontSize: 17, fontWeight: 800, color: '#f8fafc' }}>
                {selectedOfferApp.offerDetails.position}
              </div>
              <div style={{ color: '#94a3b8', fontSize: 13, marginTop: 2 }}>
                Doanh nghiệp: <strong style={{ color: '#cbd5e1' }}>{selectedOfferApp.company}</strong>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 18 }}>
              <div style={{ background: 'rgba(6, 78, 59, 0.2)', padding: 14, borderRadius: 12, border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                <Text style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#6ee7b7' }}>
                  Mức lương chính thức (Gross)
                </Text>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#34d399', marginTop: 4, fontFamily: 'monospace' }}>
                  {selectedOfferApp.offerDetails.salary}
                </div>
              </div>

              <div style={{ background: 'rgba(30, 58, 138, 0.2)', padding: 14, borderRadius: 12, border: '1px solid rgba(59, 130, 246, 0.3)' }}>
                <Text style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#93c5fd' }}>
                  Ngày bắt đầu làm việc
                </Text>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#60a5fa', marginTop: 4, fontFamily: 'monospace' }}>
                  {selectedOfferApp.offerDetails.startDate}
                </div>
              </div>
            </div>

            <div style={{ background: 'rgba(11, 15, 23, 0.8)', padding: 16, borderRadius: 14, border: '1px solid rgba(51, 65, 85, 0.65)', fontSize: 13, lineHeight: 1.7 }}>
              <Text strong style={{ display: 'block', marginBottom: 4, color: '#f8fafc' }}>
                Chính sách đãi ngộ & Thử việc:
              </Text>
              <Paragraph style={{ margin: 0, color: '#94a3b8' }}>
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

