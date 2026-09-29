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

const { Title, Text, Paragraph } = Typography;

export const CandidateApplicationsPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTabKey = searchParams.get('subtab') || 'applied';

  const { applications, interviews, recruiterConnects, respondToOffer } = useCandidateStore();

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
      <Card
        bordered={false}
        style={{
          borderRadius: 16,
          background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
          color: '#fff',
          marginBottom: 24,
        }}
        styles={{ body: { padding: '28px 32px' } }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <Title level={3} style={{ color: '#fff', margin: 0, fontWeight: 800 }}>
                Lịch Sử Ứng Tuyển & Lịch Phỏng Vấn
              </Title>
              <Tag color="#0284c7" style={{ borderRadius: 10, fontWeight: 700 }}>
                Thời Gian Thực
              </Tag>
            </div>
            <Text style={{ color: '#94a3b8', fontSize: 14 }}>
              Theo dõi xuyên suốt tiến độ hồ sơ tuyển dụng từ lúc nộp, sơ tuyển AI, lịch phỏng vấn đến khi nhận Offer.
            </Text>
          </div>

          <div style={{ display: 'flex', gap: 20 }}>
            <div style={{ textAlign: 'center', background: 'rgba(255,255,255,0.06)', padding: '8px 18px', borderRadius: 12 }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#38bdf8' }}>{applications.length}</div>
              <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>Việc làm đã nộp</div>
            </div>
            <div style={{ textAlign: 'center', background: 'rgba(255,255,255,0.06)', padding: '8px 18px', borderRadius: 12 }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#a78bfa' }}>{interviews.length}</div>
              <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>Lịch PV sắp tới</div>
            </div>
            <div style={{ textAlign: 'center', background: 'rgba(255,255,255,0.06)', padding: '8px 18px', borderRadius: 12 }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#34d399' }}>{recruiterConnects.length}</div>
              <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>Hồ sơ gửi Recruiter</div>
            </div>
          </div>
        </div>
      </Card>

      {/* Main Tabs */}
      <Card bordered={false} style={{ borderRadius: 16, boxShadow: '0 4px 12px rgba(0,0,0,0.04)' }}>
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
                      <Button type="primary" onClick={() => navigate('/')} style={{ borderRadius: 8 }}>
                        Khám phá việc làm ngay
                      </Button>
                    </Empty>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                      {applications.map((app) => {
                        const currentStep = getStepCurrent(app.status);
                        const isOffered = app.status === 'OFFER';

                        return (
                          <Card
                            key={app.id}
                            style={{
                              borderRadius: 14,
                              border: isOffered ? '1.5px solid #10b981' : '1px solid #e2e8f0',
                              background: isOffered ? '#f0fdf4' : '#ffffff',
                              boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
                            }}
                            styles={{ body: { padding: '22px 24px' } }}
                          >
                            <Row gutter={[20, 20]} align="middle">
                              {/* Thông tin công việc */}
                              <Col xs={24} lg={10}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                  <Text strong style={{ fontSize: 16, color: '#0f172a' }}>
                                    {app.jobTitle}
                                  </Text>
                                  {isOffered && (
                                    <Tag color="success" style={{ borderRadius: 6, fontWeight: 700 }}>
                                      Offer đã sẵn sàng
                                    </Tag>
                                  )}
                                </div>
                                <div style={{ fontSize: 13, color: '#64748b', marginBottom: 8 }}>
                                  🏢 {app.company}
                                </div>
                                <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 12.5, color: '#475569' }}>
                                  <span>💰 <strong>{app.salary}</strong></span>
                                  <span>📅 Nộp: {app.appliedDate}</span>
                                </div>
                                <div style={{ marginTop: 8, fontSize: 12, color: '#64748b' }}>
                                  <FileTextOutlined style={{ marginRight: 4, color: '#0284c7' }} />
                                  CV sử dụng: <strong>{app.cvUsed}</strong>
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
                                      borderRadius: 8,
                                      fontWeight: 700,
                                      background: 'linear-gradient(135deg, #10b981, #059669)',
                                      border: 'none',
                                      boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
                                    }}
                                  >
                                    Xem Thư Mời Nhận Việc
                                  </Button>
                                ) : (
                                  <Tag
                                    style={{
                                      padding: '6px 12px',
                                      borderRadius: 8,
                                      fontWeight: 700,
                                      fontSize: 12,
                                      background: `${app.statusColor}15`,
                                      color: app.statusColor,
                                      border: `1px solid ${app.statusColor}40`,
                                    }}
                                  >
                                    {app.statusLabel}
                                  </Tag>
                                )}
                              </Col>
                            </Row>
                          </Card>
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
                  Lịch phỏng vấn sắp tới ({interviews.length})
                </span>
              ),
              children: (
                <div style={{ paddingTop: 10 }}>
                  {interviews.length === 0 ? (
                    <Empty description="Hiện chưa có lịch phỏng vấn nào được xếp." style={{ padding: '40px 0' }} />
                  ) : (
                    <Row gutter={[20, 20]}>
                      {interviews.map((item) => (
                        <Col xs={24} md={12} key={item.id}>
                          <Card
                            hoverable
                            style={{
                              borderRadius: 14,
                              border: '1px solid #e2e8f0',
                              height: '100%',
                              display: 'flex',
                              flexDirection: 'column',
                              justifyContent: 'space-between',
                            }}
                            styles={{ body: { padding: '24px' } }}
                          >
                            <div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                                <div>
                                  <div style={{ fontWeight: 800, fontSize: 16, color: '#0f172a' }}>
                                    {item.jobTitle}
                                  </div>
                                  <div style={{ fontSize: 13, color: '#64748b' }}>
                                    🏢 {item.company}
                                  </div>
                                </div>
                                <Tag
                                  color={item.mode === 'ONLINE' ? 'blue' : 'green'}
                                  style={{ borderRadius: 6, fontWeight: 700, padding: '3px 8px' }}
                                >
                                  {item.mode === 'ONLINE' ? 'Phỏng vấn Online' : 'Phỏng vấn Trực tiếp'}
                                </Tag>
                              </div>

                              <div style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: 10, marginBottom: 16 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#0284c7', fontWeight: 700, fontSize: 14 }}>
                                  <ClockCircleOutlined />
                                  <span>{item.datetime}</span>
                                </div>
                              </div>

                              <div style={{ marginBottom: 12, fontSize: 13 }}>
                                <Text type="secondary" style={{ display: 'block', fontWeight: 600 }}>Người phỏng vấn:</Text>
                                <Text strong style={{ color: '#334155' }}>{item.interviewers}</Text>
                              </div>

                              {item.address && (
                                <div style={{ marginBottom: 12, fontSize: 13 }}>
                                  <Text type="secondary" style={{ display: 'block', fontWeight: 600 }}>Địa chỉ văn phòng:</Text>
                                  <Text style={{ color: '#334155' }}><EnvironmentOutlined /> {item.address}</Text>
                                </div>
                              )}

                              <div style={{ fontSize: 13 }}>
                                <Text type="secondary" style={{ display: 'block', fontWeight: 600 }}>Ghi chú chuẩn bị:</Text>
                                <Text style={{ color: '#64748b' }}>{item.notes}</Text>
                              </div>
                            </div>

                            <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid #f1f5f9' }}>
                              {item.mode === 'ONLINE' && item.link ? (
                                <Button
                                  type="primary"
                                  block
                                  icon={<VideoCameraOutlined />}
                                  href={item.link}
                                  target="_blank"
                                  style={{
                                    borderRadius: 8,
                                    fontWeight: 700,
                                    background: 'linear-gradient(135deg, #0284c7, #0369a1)',
                                  }}
                                >
                                  Vào phòng Google Meet / Zoom
                                </Button>
                              ) : (
                                <Button
                                  block
                                  icon={<EnvironmentOutlined />}
                                  onClick={() => message.info(`Địa điểm: ${item.address}`)}
                                  style={{ borderRadius: 8, fontWeight: 700 }}
                                >
                                  Xem chỉ đường văn phòng
                                </Button>
                              )}
                            </div>
                          </Card>
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
                  Hồ sơ gửi Recruiter ({recruiterConnects.length})
                </span>
              ),
              children: (
                <div style={{ paddingTop: 10 }}>
                  {recruiterConnects.length === 0 ? (
                    <Empty
                      description="Bạn chưa gửi gắm hồ sơ cho chuyên gia Recruiter nào."
                      style={{ padding: '40px 0' }}
                    >
                      <Button type="primary" onClick={() => navigate('/?mode=recruiters')} style={{ borderRadius: 8 }}>
                        Khám phá Mạng lưới Recruiter OPR Hub
                      </Button>
                    </Empty>
                  ) : (
                    <Table
                      dataSource={recruiterConnects}
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
                                <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>{record.recruiterName}</div>
                                <div style={{ fontSize: 12, color: '#64748b' }}>{record.recruiterTitle}</div>
                              </div>
                            </div>
                          ),
                        },
                        {
                          title: 'Bản CV đã gửi',
                          dataIndex: 'cvUsed',
                          key: 'cvUsed',
                          render: (cv) => <Tag icon={<FileTextOutlined />} style={{ borderRadius: 4 }}>{cv}</Tag>,
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
                            <Paragraph ellipsis={{ rows: 2, tooltip: note }} style={{ margin: 0, fontSize: 13, color: '#475569' }}>
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
                                  borderRadius: 6,
                                  fontWeight: 700,
                                  background: `${record.statusColor}15`,
                                  color: record.statusColor,
                                  border: `1px solid ${record.statusColor}40`,
                                }}
                              >
                                {record.statusLabel}
                              </Tag>
                              {record.matchedJob && (
                                <div style={{ fontSize: 11, color: '#059669', fontWeight: 600, marginTop: 4 }}>
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
      </Card>

      {/* Modal Xem Thư Mời Nhận Việc (Official Offer Letter) */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#10b981' }}>
            <SafetyCertificateOutlined style={{ fontSize: 20 }} />
            <span style={{ fontSize: 17, fontWeight: 800 }}>Thư Mời Nhận Việc Chính Thức (Job Offer Letter)</span>
          </div>
        }
        open={!!selectedOfferApp}
        onCancel={() => setSelectedOfferApp(null)}
        width={620}
        footer={[
          <Button
            key="reject"
            danger
            icon={<CloseOutlined />}
            onClick={() => selectedOfferApp && handleDecision(selectedOfferApp.id, 'REJECTED')}
            style={{ borderRadius: 8, fontWeight: 600 }}
          >
            Từ chối Offer
          </Button>,
          <Button
            key="accept"
            type="primary"
            icon={<CheckOutlined />}
            onClick={() => selectedOfferApp && handleDecision(selectedOfferApp.id, 'ACCEPTED')}
            style={{
              borderRadius: 8,
              fontWeight: 700,
              background: '#10b981',
              border: 'none',
              boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
            }}
          >
            Chấp thuận Offer
          </Button>,
        ]}
      >
        {selectedOfferApp && selectedOfferApp.offerDetails && (
          <div style={{ padding: '8px 0' }}>
            <div style={{ background: '#f8fafc', padding: '16px 20px', borderRadius: 12, marginBottom: 18, border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: 17, fontWeight: 800, color: '#0f172a' }}>
                {selectedOfferApp.offerDetails.position}
              </div>
              <div style={{ color: '#64748b', fontSize: 13, marginTop: 2 }}>
                Doanh nghiệp: <strong>{selectedOfferApp.company}</strong>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 18 }}>
              <div style={{ background: '#ecfdf5', padding: 14, borderRadius: 10, border: '1px solid #a7f3d0' }}>
                <Text type="secondary" style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>
                  Mức lương chính thức (Gross)
                </Text>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#059669', marginTop: 4 }}>
                  {selectedOfferApp.offerDetails.salary}
                </div>
              </div>

              <div style={{ background: '#eff6ff', padding: 14, borderRadius: 10, border: '1px solid #bfdbfe' }}>
                <Text type="secondary" style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>
                  Ngày bắt đầu làm việc
                </Text>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#0284c7', marginTop: 4 }}>
                  {selectedOfferApp.offerDetails.startDate}
                </div>
              </div>
            </div>

            <div style={{ background: '#f8fafc', padding: 16, borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 13, lineHeight: 1.7 }}>
              <Text strong style={{ display: 'block', marginBottom: 4, color: '#0f172a' }}>
                Chính sách đãi ngộ & Thử việc:
              </Text>
              <Paragraph style={{ margin: 0, color: '#475569' }}>
                {selectedOfferApp.offerDetails.note}
              </Paragraph>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
