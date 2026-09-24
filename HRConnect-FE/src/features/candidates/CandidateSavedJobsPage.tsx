import React, { useState } from 'react';
import {
  Card,
  Row,
  Col,
  Button,
  Tag,
  Space,
  Empty,
  Typography,
  message,
} from 'antd';
import {
  HeartFilled,
  SendOutlined,
  DeleteOutlined,
  EnvironmentOutlined,
  CompassOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { useCandidateStore } from '@/stores/candidateStore';
import { FEATURED_HOT_JOBS, FeaturedJobItem } from '@/features/landing/components/FeaturedHotJobs';
import { ApplyJobModal } from '@/features/candidates/ApplyJobModal';

const { Title, Text, Paragraph } = Typography;

export const CandidateSavedJobsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const currentUserEmail = (user?.email || '').toLowerCase().trim();
  const { savedJobs, toggleSaveJob } = useCandidateStore();
  const [selectedJobForApply, setSelectedJobForApply] = useState<FeaturedJobItem | null>(null);

  // Read saved job ids isolated by currentUser.email from localStorage or store
  const userSavedJobIds = React.useMemo(() => {
    if (!currentUserEmail) return [];
    try {
      const userKey = `hrconnect_saved_jobs_${currentUserEmail}`;
      const raw = localStorage.getItem(userKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    const list = savedJobs || [];
    return list
      .filter((j) => (j.userEmail || '').toLowerCase().trim() === currentUserEmail)
      .map((j) => j.jobId);
  }, [currentUserEmail, savedJobs]);

  const savedJobsList = FEATURED_HOT_JOBS.filter((job) => userSavedJobIds.includes(job.id));

  return (
    <div style={{ maxWidth: 1180, margin: '0 auto', paddingBottom: 60 }}>
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
                Việc Làm Đã Lưu (Bookmarked Jobs)
              </Title>
              <Tag color="#ef4444" style={{ borderRadius: 10, fontWeight: 700 }}>
                {savedJobsList.length} Việc làm
              </Tag>
            </div>
            <Text style={{ color: '#94a3b8', fontSize: 14 }}>
              Danh sách các cơ hội nghề nghiệp bạn đã đánh dấu lưu từ Trang chủ để cân nhắc và ứng tuyển khi sẵn sàng.
            </Text>
          </div>

          <Button
            type="primary"
            icon={<CompassOutlined />}
            onClick={() => navigate('/')}
            style={{
              borderRadius: 8,
              fontWeight: 700,
              background: 'linear-gradient(135deg, #0284c7, #0369a1)',
              border: 'none',
              height: 40,
            }}
          >
            Tìm kiếm thêm việc làm
          </Button>
        </div>
      </Card>

      {/* Danh sách việc làm đã lưu */}
      {savedJobsList.length === 0 ? (
        <Card style={{ borderRadius: 16, textAlign: 'center', padding: '60px 20px', border: '1px solid #e2e8f0' }}>
          <HeartFilled style={{ fontSize: 48, color: '#cbd5e1', marginBottom: 16 }} />
          <Title level={4} style={{ color: '#0f172a', marginBottom: 8 }}>
            Bạn chưa lưu việc làm nào
          </Title>
          <Paragraph style={{ color: '#64748b', fontSize: 14, maxWidth: 460, margin: '0 auto 24px' }}>
            Hãy ghé thăm Trang chủ sàn việc làm HR Connect và bấm biểu tượng trái tim để lưu lại các vị trí yêu thích.
          </Paragraph>
          <Button
            type="primary"
            size="large"
            onClick={() => navigate('/')}
            style={{ borderRadius: 8, fontWeight: 700, background: '#0284c7' }}
          >
            Khám phá việc làm ngay
          </Button>
        </Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {savedJobsList.map((job) => (
            <Card
              key={job.id}
              hoverable
              style={{
                borderRadius: 14,
                border: '1px solid #e2e8f0',
                transition: 'all 0.25s ease',
              }}
              styles={{ body: { padding: '22px 26px' } }}
            >
              <Row gutter={[20, 20]} align="middle" justify="space-between">
                <Col xs={24} md={16}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                    <Text strong style={{ fontSize: 17, color: '#0f172a' }}>
                      {job.title}
                    </Text>
                    <Tag color="purple" style={{ borderRadius: 4, fontWeight: 700, fontSize: 10 }}>
                      {job.workMode}
                    </Tag>
                  </div>

                  <div style={{ color: '#64748b', fontSize: 13, marginBottom: 10 }}>
                    🏢 <strong>{job.company}</strong> • <EnvironmentOutlined /> {job.location}
                  </div>

                  {/* Lương VNĐ nổi bật */}
                  <div style={{ marginBottom: 12 }}>
                    <span style={{ color: '#059669', fontWeight: 800, fontSize: 15 }}>
                      💰 {(job.salaryMin / 1000000).toFixed(0)} - {(job.salaryMax / 1000000).toFixed(0)} Triệu VNĐ / tháng
                    </span>
                  </div>

                  {/* Skills tags */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {job.tags.map((t) => (
                      <Tag key={t} style={{ borderRadius: 4, fontSize: 11, background: '#f1f5f9', border: 'none' }}>
                        {t}
                      </Tag>
                    ))}
                  </div>
                </Col>

                <Col xs={24} md={8} style={{ textAlign: 'right' }}>
                  <Space size={10} wrap>
                    <Button
                      type="primary"
                      icon={<SendOutlined />}
                      onClick={() => setSelectedJobForApply(job)}
                      style={{
                        borderRadius: 8,
                        fontWeight: 700,
                        background: 'linear-gradient(135deg, #0284c7, #0369a1)',
                        border: 'none',
                        height: 38,
                      }}
                    >
                      Ứng tuyển ngay
                    </Button>

                    <Button
                      danger
                      icon={<DeleteOutlined />}
                      onClick={() => {
                        toggleSaveJob(job.id, currentUserEmail);
                        message.success('Đã bỏ lưu tin việc làm!');
                      }}
                      style={{ borderRadius: 8, height: 38, fontWeight: 600 }}
                    >
                      Bỏ lưu
                    </Button>
                  </Space>
                </Col>
              </Row>
            </Card>
          ))}
        </div>
      )}

      {/* Modal ứng tuyển nhanh */}
      <ApplyJobModal
        open={!!selectedJobForApply}
        job={selectedJobForApply}
        onClose={() => setSelectedJobForApply(null)}
      />
    </div>
  );
};
