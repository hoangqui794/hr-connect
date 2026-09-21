import React, { useState } from 'react';
import { Card, Table, Tag, Button, Space, Typography, Input, Modal, Radio, message } from 'antd';
import {
  SearchOutlined,
  PlusCircleOutlined,
  EyeOutlined,
  UserAddOutlined,
  FileTextOutlined,
  CheckCircleFilled,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useJobs } from '@/services/queries/useJobs';
import { ServiceType, JobStatus, SERVICE_TYPE_LABELS } from '@/types/job';
import { useAuthStore } from '@/stores/authStore';
import { UserRole } from '@/types/roles';
import type { Job } from '@/types/job';
import type { ColumnsType } from 'antd/es/table';

const { Title, Text } = Typography;

const SERVICE_TYPE_COLOR: Record<ServiceType, string> = {
  [ServiceType.HEADHUNT_COD]: '#0284c7',
  [ServiceType.CV_SOURCING]: '#10b981',
  [ServiceType.CV_APPLICATION]: '#8b5cf6',
};

/**
 * Định dạng khoảng lương chuẩn Việt Nam (VND):
 * Ví dụ: "45.000.000 - 70.000.000 đ/tháng" (không chứa ký hiệu $ phía trước).
 */
export const formatSalaryVND = (min: number, max: number, currency: string = 'VND'): string => {
  const minStr = min.toLocaleString('vi-VN');
  const maxStr = max.toLocaleString('vi-VN');

  if (currency === 'USD') {
    return `$${minStr} - $${maxStr}/tháng`;
  }
  return `${minStr} - ${maxStr} đ/tháng`;
};

export const JobListTable: React.FC = () => {
  const navigate = useNavigate();
  const { role } = useAuthStore();
  const { data: jobs, isLoading } = useJobs();
  const [search, setSearch] = useState('');

  // Quick Apply Modal state for Candidate
  const [selectedJobForApply, setSelectedJobForApply] = useState<Job | null>(null);
  const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);
  const [selectedCv, setSelectedCv] = useState('cv-1');
  const [coverNote, setCoverNote] = useState('');
  const [submittingApply, setSubmittingApply] = useState(false);

  const handleOpenApplyModal = (job: Job) => {
    setSelectedJobForApply(job);
    setIsApplyModalOpen(true);
  };

  const handleConfirmApply = async () => {
    if (!selectedJobForApply) return;
    setSubmittingApply(true);
    await new Promise((r) => setTimeout(r, 400));
    setSubmittingApply(false);
    setIsApplyModalOpen(false);
    message.success({
      content: `Nộp hồ sơ ứng tuyển thành công vị trí "${selectedJobForApply.title}" tại ${selectedJobForApply.company}!`,
      icon: <CheckCircleFilled style={{ color: '#10b981' }} />,
      duration: 3.5,
    });
  };

  // Lọc theo tên công việc, tên công ty hoặc kỹ năng (mustHaveTags, shouldHaveTags)
  const filtered = (jobs ?? []).filter((j) => {
    if (!search) return true;
    const query = search.toLowerCase().trim();
    return (
      j.title.toLowerCase().includes(query) ||
      j.company.toLowerCase().includes(query) ||
      (j.mustHaveTags && j.mustHaveTags.some((t) => t.toLowerCase().includes(query))) ||
      (j.shouldHaveTags && j.shouldHaveTags.some((t) => t.toLowerCase().includes(query)))
    );
  });

  const columns: ColumnsType<Job> = [
    {
      title: 'Vị trí công việc',
      key: 'title',
      width: 280,
      render: (_, record) => (
        <div>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a', lineHeight: 1.4 }}>
            {record.title}
          </div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
            {record.company} · {record.location}
          </div>
          <div style={{ marginTop: 6, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {record.mustHaveTags?.slice(0, 3).map((tag) => (
              <Tag
                key={tag}
                style={{
                  borderRadius: 6,
                  fontSize: 11,
                  margin: 0,
                  background: '#f1f5f9',
                  border: '1px solid #e2e8f0',
                  color: '#475569',
                }}
              >
                {tag}
              </Tag>
            ))}
          </div>
        </div>
      ),
    },
    {
      title: 'Gói dịch vụ',
      dataIndex: 'serviceType',
      key: 'serviceType',
      width: 190,
      render: (type: ServiceType) => {
        const label = SERVICE_TYPE_LABELS[type] || type.replace('_', ' ');
        const color = SERVICE_TYPE_COLOR[type] || '#0284c7';
        return (
          <Tag
            style={{
              color,
              background: `${color}14`,
              border: `1px solid ${color}30`,
              borderRadius: 6,
              fontWeight: 600,
              fontSize: 11,
              padding: '2px 8px',
            }}
          >
            {label}
          </Tag>
        );
      },
    },
    {
      title: 'Mức lương',
      key: 'salary',
      width: 230,
      render: (_, record) => (
        <div>
          <div style={{ fontWeight: 700, fontSize: 13, color: '#059669', letterSpacing: '-0.01em' }}>
            {formatSalaryVND(record.salaryRange.min, record.salaryRange.max, record.salaryRange.currency)}
          </div>
          {record.salaryRange.negotiable && (
            <div style={{ fontSize: 11, color: '#64748b', fontWeight: 500, marginTop: 2 }}>
              (Thỏa thuận theo năng lực)
            </div>
          )}
        </div>
      ),
    },
    ...(role === UserRole.AFFILIATE
      ? [
          {
            title: 'Hoa hồng',
            key: 'commission',
            width: 140,
            render: (_: unknown, record: Job) => (
              <div>
                <div style={{ fontWeight: 800, fontSize: 15, color: '#0284c7' }}>
                  {record.engagementTerms?.commissionRate || 15}%
                </div>
                <div style={{ fontSize: 11, color: '#64748b' }}>tháng lương đầu</div>
              </div>
            ),
          },
        ]
      : []),
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      width: 130,
      render: (status: JobStatus) => {
        const isActive = status === JobStatus.ACTIVE || status === 'ACTIVE';
        return (
          <Tag
            style={{
              borderRadius: 6,
              fontWeight: 700,
              fontSize: 12,
              padding: '3px 10px',
              border: isActive ? '1px solid #86efac' : '1px solid #e2e8f0',
              background: isActive ? '#f0fdf4' : '#f8fafc',
              color: isActive ? '#16a34a' : '#64748b',
            }}
          >
            {isActive
              ? 'Đang tuyển'
              : status === JobStatus.PAUSED
              ? 'Tạm dừng'
              : status === JobStatus.CLOSED
              ? 'Đã đóng'
              : 'Bản nháp'}
          </Tag>
        );
      },
    },
    {
      title: 'Số ứng viên',
      key: 'applicants',
      width: 140,
      render: (_, record) => (
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontWeight: 800, fontSize: 16, color: '#0f172a' }}>
            {record.applicationCount}
          </div>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 1 }}>
            {record.shortlistedCount} đã sơ loại
          </div>
        </div>
      ),
    },
    {
      title: 'Thao tác',
      key: 'action',
      width: 120,
      render: (_, record) => (
        <Space>
          {role === UserRole.AFFILIATE && (
            <Button
              type="primary"
              size="small"
              icon={<UserAddOutlined />}
              onClick={() => navigate('/affiliate/referral')}
              style={{
                borderRadius: 6,
                fontWeight: 600,
                background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                border: 'none',
              }}
            >
              Giới thiệu
            </Button>
          )}
          {(role === UserRole.INTERNAL_HR || role === UserRole.ADMIN || role === UserRole.CLIENT) && (
            <Button
              size="small"
              icon={<EyeOutlined />}
              onClick={() => navigate('/screening')}
              style={{
                borderRadius: 6,
                fontWeight: 600,
                borderColor: '#cbd5e1',
                color: '#0f172a',
              }}
            >
              Xem hồ sơ
            </Button>
          )}
          {role === UserRole.CANDIDATE && (
            <Button
              type="primary"
              size="small"
              style={{
                borderRadius: 6,
                fontWeight: 700,
                background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
                border: 'none',
              }}
              onClick={() => handleOpenApplyModal(record)}
            >
              Ứng tuyển ngay
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      {/* Header Bar */}
      <div
        style={{
          marginBottom: 20,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div>
          <Title level={3} style={{ margin: '0 0 4px', fontWeight: 800, color: '#0f172a' }}>
            {role === UserRole.AFFILIATE
              ? '💼 Bảng tin việc làm — Cơ hội hoa hồng Headhunter'
              : '📋 Danh sách vị trí tuyển dụng'}
          </Title>
          <Text type="secondary" style={{ fontSize: 13 }}>
            {role === UserRole.AFFILIATE
              ? 'Giới thiệu ứng viên tiềm năng và nhận hoa hồng hấp dẫn khi ứng viên thử việc thành công.'
              : 'Quản lý, theo dõi tiến độ tuyển dụng và hồ sơ ứng viên qua các gói dịch vụ.'}
          </Text>
        </div>

        {(role === UserRole.CLIENT || role === UserRole.ADMIN) && (
          <Button
            type="primary"
            icon={<PlusCircleOutlined />}
            onClick={() => navigate('/jobs/create')}
            style={{
              borderRadius: 8,
              fontWeight: 700,
              height: 40,
              background: 'linear-gradient(135deg, #0284c7, #0369a1)',
              border: 'none',
              boxShadow: '0 4px 12px rgba(2, 132, 199, 0.25)',
            }}
          >
            Tạo tin tuyển dụng mới
          </Button>
        )}
      </div>

      {/* Filter / Search Bar */}
      <Card
        style={{
          borderRadius: 14,
          marginBottom: 16,
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        }}
        styles={{ body: { padding: '14px 18px' } }}
      >
        <Input
          prefix={<SearchOutlined style={{ color: '#94a3b8', fontSize: 15 }} />}
          placeholder="Tìm theo tên công việc, kỹ năng hoặc công ty..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          allowClear
          size="middle"
          style={{ borderRadius: 8, maxWidth: 460, height: 38 }}
        />
      </Card>

      {/* Main Table */}
      <Card
        style={{
          borderRadius: 16,
          border: '1px solid #e2e8f0',
          boxShadow: '0 4px 20px -4px rgba(0,0,0,0.05)',
          overflow: 'hidden',
        }}
        styles={{ body: { padding: 0 } }}
      >
        <Table
          columns={columns}
          dataSource={filtered}
          loading={isLoading}
          rowKey="id"
          pagination={{
            pageSize: 10,
            showTotal: (total) => `Tổng cộng ${total} vị trí`,
            style: { paddingRight: 16, marginBottom: 16 },
          }}
          scroll={{ x: 950 }}
        />
      </Card>

      {/* Quick Apply Modal for Candidate */}
      <Modal
        title={
          <div>
            <div style={{ fontWeight: 800, fontSize: 16, color: '#0f172a' }}>
              Ứng tuyển nhanh vào vị trí
            </div>
            <div style={{ fontSize: 13, color: '#8b5cf6', fontWeight: 600, marginTop: 2 }}>
              {selectedJobForApply?.title} · {selectedJobForApply?.company}
            </div>
          </div>
        }
        open={isApplyModalOpen}
        onCancel={() => setIsApplyModalOpen(false)}
        footer={null}
        width={560}
      >
        <div style={{ marginTop: 16 }}>
          <div
            style={{
              marginBottom: 16,
              background: '#f8fafc',
              padding: '12px 16px',
              borderRadius: 10,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div>
              <div style={{ fontSize: 12, color: '#64748b' }}>Mức lương vị trí</div>
              <div style={{ fontWeight: 700, fontSize: 14, color: '#059669' }}>
                {selectedJobForApply &&
                  formatSalaryVND(
                    selectedJobForApply.salaryRange.min,
                    selectedJobForApply.salaryRange.max,
                    selectedJobForApply.salaryRange.currency
                  )}
              </div>
            </div>
            <Tag color="purple" style={{ borderRadius: 6, fontWeight: 700, padding: '2px 8px' }}>
              Chuẩn ATS AI Screen
            </Tag>
          </div>

          <div style={{ fontWeight: 700, fontSize: 13, color: '#0f172a', marginBottom: 10 }}>
            Chọn CV để nộp tức thì:
          </div>

          <Radio.Group
            value={selectedCv}
            onChange={(e) => setSelectedCv(e.target.value)}
            style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 18 }}
          >
            <Radio
              value="cv-1"
              style={{
                border: '1.5px solid #e2e8f0',
                padding: '12px 14px',
                borderRadius: 10,
                width: '100%',
                background: selectedCv === 'cv-1' ? '#faf5ff' : '#fff',
                borderColor: selectedCv === 'cv-1' ? '#8b5cf6' : '#e2e8f0',
              }}
            >
              <div>
                <span style={{ fontWeight: 700, fontSize: 13, color: '#0f172a' }}>
                  CV Senior Fullstack Engineer (ATS Standard 2026)
                </span>
                <Tag color="purple" style={{ marginLeft: 8, fontSize: 10, fontWeight: 700 }}>
                  Khuyên dùng (94% Match)
                </Tag>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                  CV mặc định · Cập nhật 16/09/2026
                </div>
              </div>
            </Radio>

            <Radio
              value="cv-2"
              style={{
                border: '1.5px solid #e2e8f0',
                padding: '12px 14px',
                borderRadius: 10,
                width: '100%',
                background: selectedCv === 'cv-2' ? '#faf5ff' : '#fff',
                borderColor: selectedCv === 'cv-2' ? '#8b5cf6' : '#e2e8f0',
              }}
            >
              <div>
                <span style={{ fontWeight: 700, fontSize: 13, color: '#0f172a' }}>
                  CV Frontend Lead & React Architecture
                </span>
                <Tag color="blue" style={{ marginLeft: 8, fontSize: 10, fontWeight: 700 }}>
                  89% Match
                </Tag>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                  Cập nhật 08/09/2026
                </div>
              </div>
            </Radio>
          </Radio.Group>

          <div style={{ marginBottom: 20 }}>
            <div style={{ fontWeight: 600, fontSize: 13, color: '#0f172a', marginBottom: 6 }}>
              Thư giới thiệu ngắn (Cover letter / Lời nhắn tới HR):
            </div>
            <Input.TextArea
              rows={3}
              value={coverNote}
              onChange={(e) => setCoverNote(e.target.value)}
              placeholder="Tôi có 5+ năm kinh nghiệm phát triển phần mềm và rất mong muốn được trao đổi sâu hơn về vị trí..."
              style={{ borderRadius: 8 }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <Button onClick={() => setIsApplyModalOpen(false)} style={{ borderRadius: 8 }}>
              Hủy bỏ
            </Button>
            <Button
              type="primary"
              loading={submittingApply}
              onClick={handleConfirmApply}
              style={{
                borderRadius: 8,
                fontWeight: 700,
                background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
                border: 'none',
              }}
            >
              Xác nhận nộp hồ sơ tức thì
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
