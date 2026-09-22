import React, { useState } from 'react';
import {
  Table, Card, Typography, Space, Tag, Button, Modal, Input,
  DatePicker, Select, Row, Col, Badge, Avatar, message, Popconfirm,
  Statistic, Tooltip,
} from 'antd';
import {
  CalendarOutlined, CheckCircleOutlined, CloseCircleOutlined,
  ClockCircleOutlined, VideoCameraOutlined, UserOutlined,
  BankOutlined, ReloadOutlined, EditOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

interface InterviewSchedule {
  id: string;
  candidateName: string;
  candidateEmail: string;
  companyName: string;
  jobTitle: string;
  roundName: string;
  scheduledTime: string;
  meetingLink: string;
  interviewerName: string;
  status: 'SCHEDULED' | 'PASSED' | 'FAILED' | 'RESCHEDULED';
  notes?: string;
}

const INITIAL_INTERVIEWS: InterviewSchedule[] = [
  {
    id: 'int-001',
    candidateName: 'Le Hoang Minh',
    candidateEmail: 'minh.le@example.com',
    companyName: 'Blata33 Technology JSC',
    jobTitle: 'Senior React Developer (COD)',
    roundName: 'Vòng 2: Kỹ thuật chuyên sâu & Culture Fit',
    scheduledTime: '2026-09-24 14:00',
    meetingLink: 'https://meet.google.com/hrc-int-01',
    interviewerName: 'Nguyen Thi HR & Tech Lead',
    status: 'SCHEDULED',
    notes: 'Ứng viên có điểm AI Screening 92/100, kinh nghiệm React 5 năm.',
  },
  {
    id: 'int-002',
    candidateName: 'Tran Thi Thu',
    candidateEmail: 'thu.tran@gmail.com',
    companyName: 'VNG Corporation',
    jobTitle: 'Product Manager - Fintech',
    roundName: 'Vòng 1: Phỏng vấn sơ loại HR & Client',
    scheduledTime: '2026-09-25 10:30',
    meetingLink: 'https://meet.google.com/hrc-int-02',
    interviewerName: 'Phan Quoc Bao (VNG HR)',
    status: 'SCHEDULED',
    notes: 'Kinh nghiệm quản lý sản phẩm ví điện tử 4 năm.',
  },
  {
    id: 'int-003',
    candidateName: 'Nguyen Van B',
    candidateEmail: 'vanb.devops@tech.io',
    companyName: 'Techcombank Digital Lab',
    jobTitle: 'DevOps Engineer (AWS/K8s)',
    roundName: 'Vòng 2: Phỏng vấn Kỹ thuật Cloud',
    scheduledTime: '2026-09-26 15:30',
    meetingLink: 'https://meet.google.com/hrc-int-03',
    interviewerName: 'Tran Minh Tuan (Tech Lead)',
    status: 'SCHEDULED',
    notes: 'Có chứng chỉ AWS Solutions Architect Professional.',
  },
  {
    id: 'int-004',
    candidateName: 'Hoang Nam Anh',
    candidateEmail: 'namanh.dev@gmail.com',
    companyName: 'NexGen AI Solutions Ltd',
    jobTitle: 'AI Research Scientist',
    roundName: 'Vòng 1: Đánh giá Năng lực Thuật toán',
    scheduledTime: '2026-09-20 09:00',
    meetingLink: 'https://meet.google.com/hrc-int-04',
    interviewerName: 'Dr. Le Hoang Nam',
    status: 'PASSED',
    notes: 'Kết quả xuất sắc, đã gửi đề nghị Offer.',
  },
  {
    id: 'int-005',
    candidateName: 'Pham Minh Tuan',
    candidateEmail: 'tuan.pm@outlook.com',
    companyName: 'Blata33 Technology JSC',
    jobTitle: 'Fullstack Node.js Developer',
    roundName: 'Vòng 1: Phỏng vấn Kỹ thuật cơ bản',
    scheduledTime: '2026-09-19 14:00',
    meetingLink: 'https://meet.google.com/hrc-int-05',
    interviewerName: 'Nguyen Thi HR',
    status: 'FAILED',
    notes: 'Chưa đáp ứng yêu cầu kinh nghiệm Microservices.',
  },
];

export const HRInterviewsPage: React.FC = () => {
  const [interviews, setInterviews] = useState<InterviewSchedule[]>(INITIAL_INTERVIEWS);
  const [rescheduleModalOpen, setRescheduleModalOpen] = useState(false);
  const [selectedInterview, setSelectedInterview] = useState<InterviewSchedule | null>(null);
  const [newTime, setNewTime] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  const handleUpdateStatus = (id: string, status: 'PASSED' | 'FAILED') => {
    setInterviews((prev) =>
      prev.map((i) => (i.id === id ? { ...i, status } : i))
    );
    if (status === 'PASSED') {
      message.success('Đã cập nhật kết quả: ĐẠT (PASS) — Đã chuyển ứng viên sang phễu xem xét Offer!');
    } else {
      message.warning('Đã cập nhật kết quả: KHÔNG ĐẠT (FAIL) — Đã lưu trữ hồ sơ.');
    }
  };

  const handleReschedule = () => {
    if (!selectedInterview || !newTime) return;
    setInterviews((prev) =>
      prev.map((i) =>
        i.id === selectedInterview.id
          ? { ...i, scheduledTime: newTime, status: 'RESCHEDULED' }
          : i
      )
    );
    message.success(`Đã xếp lại lịch phỏng vấn cho ${selectedInterview.candidateName} sang ${newTime}!`);
    setRescheduleModalOpen(false);
  };

  const scheduledThisWeek = interviews.filter((i) => i.status === 'SCHEDULED');
  const passedCount = interviews.filter((i) => i.status === 'PASSED').length;

  const filteredInterviews = interviews.filter((i) =>
    statusFilter === 'ALL' ? true : i.status === statusFilter
  );

  const columns: ColumnsType<InterviewSchedule> = [
    {
      title: 'Ứng viên & Vị trí',
      key: 'candidate',
      render: (_, record) => (
        <div>
          <div style={{ fontWeight: 700, color: '#0f172a' }}>{record.candidateName}</div>
          <div style={{ fontSize: 12, color: '#64748b' }}>{record.candidateEmail}</div>
          <Tag color="blue" style={{ marginTop: 4, borderRadius: 4, fontSize: 11 }}>
            {record.jobTitle}
          </Tag>
        </div>
      ),
    },
    {
      title: 'Doanh nghiệp & Người PV',
      key: 'company',
      render: (_, record) => (
        <div>
          <div style={{ fontWeight: 600, color: '#1e293b' }}>
            <BankOutlined style={{ marginRight: 4, color: '#0284c7' }} />
            {record.companyName}
          </div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
            <UserOutlined style={{ marginRight: 4 }} />
            {record.interviewerName}
          </div>
          <div style={{ fontSize: 11, color: '#7c3aed', marginTop: 2, fontWeight: 500 }}>
            {record.roundName}
          </div>
        </div>
      ),
    },
    {
      title: 'Thời gian & Phòng họp',
      key: 'schedule',
      render: (_, record) => (
        <div>
          <div style={{ fontWeight: 700, color: '#0f172a' }}>
            <ClockCircleOutlined style={{ marginRight: 6, color: '#10b981' }} />
            {record.scheduledTime}
          </div>
          <div style={{ marginTop: 4 }}>
            <a
              href={record.meetingLink}
              target="_blank"
              rel="noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                fontSize: 12,
                color: '#0284c7',
                fontWeight: 600,
              }}
            >
              <VideoCameraOutlined /> Tham gia phỏng vấn
            </a>
          </div>
        </div>
      ),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      render: (s: string) => {
        if (s === 'SCHEDULED') {
          return <Badge status="processing" text={<span style={{ fontWeight: 700, color: '#0284c7' }}>Sắp diễn ra</span>} />;
        }
        if (s === 'RESCHEDULED') {
          return <Badge status="warning" text={<span style={{ fontWeight: 700, color: '#d97706' }}>Đã dời lịch</span>} />;
        }
        if (s === 'PASSED') {
          return <Badge status="success" text={<span style={{ fontWeight: 700, color: '#16a34a' }}>Đạt (PASS)</span>} />;
        }
        return <Badge status="error" text={<span style={{ fontWeight: 600, color: '#dc2626' }}>Không đạt (FAIL)</span>} />;
      },
    },
    {
      title: 'Thao tác',
      key: 'actions',
      render: (_, record) => (
        <Space size="small">
          {record.status === 'SCHEDULED' || record.status === 'RESCHEDULED' ? (
            <>
              <Popconfirm
                title="Cập nhật kết quả: ĐẠT"
                description={`Xác nhận ứng viên ${record.candidateName} đã vượt qua vòng này?`}
                onConfirm={() => handleUpdateStatus(record.id, 'PASSED')}
                okText="Đạt (Pass)"
                cancelText="Hủy"
                okButtonProps={{ style: { background: '#16a34a', borderColor: '#16a34a' } }}
              >
                <Button
                  size="small"
                  type="primary"
                  icon={<CheckCircleOutlined />}
                  style={{ borderRadius: 6, fontSize: 12, background: '#16a34a', borderColor: '#16a34a' }}
                >
                  Đạt
                </Button>
              </Popconfirm>

              <Popconfirm
                title="Cập nhật kết quả: KHÔNG ĐẠT"
                description={`Xác nhận đánh dấu không đạt cho ${record.candidateName}?`}
                onConfirm={() => handleUpdateStatus(record.id, 'FAILED')}
                okText="Không đạt"
                cancelText="Hủy"
                okButtonProps={{ danger: true }}
              >
                <Button
                  size="small"
                  danger
                  icon={<CloseCircleOutlined />}
                  style={{ borderRadius: 6, fontSize: 12 }}
                >
                  Rớt
                </Button>
              </Popconfirm>

              <Button
                size="small"
                icon={<EditOutlined />}
                onClick={() => {
                  setSelectedInterview(record);
                  setNewTime(record.scheduledTime);
                  setRescheduleModalOpen(true);
                }}
                style={{ borderRadius: 6, fontSize: 12 }}
              >
                Dời lịch
              </Button>
            </>
          ) : (
            <span style={{ fontSize: 12, color: '#94a3b8' }}>Đã hoàn thành</span>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: '0 4px' }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <Title level={3} style={{ margin: 0, color: '#0f172a' }}>
          <CalendarOutlined style={{ color: '#10b981', marginRight: 10 }} />
          Lịch Phỏng vấn Ứng viên (Recruitment Pipeline)
        </Title>
        <Text type="secondary" style={{ fontSize: 13 }}>
          Điều phối lịch phỏng vấn giữa Doanh nghiệp và Ứng viên, cập nhật kết quả PASS/FAIL và xếp lịch lại các vòng phỏng vấn.
        </Text>
      </div>

      {/* KPI Stats */}
      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col xs={12} sm={8}>
          <Card style={{ borderRadius: 12, border: '1px solid #e2e8f0', background: '#f0fdf4' }}>
            <Statistic
              title="Phỏng vấn trong tuần"
              value={scheduledThisWeek.length}
              valueStyle={{ color: '#10b981', fontWeight: 800, fontSize: 28 }}
              prefix={<Badge count={scheduledThisWeek.length} style={{ backgroundColor: '#10b981' }} />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8}>
          <Card style={{ borderRadius: 12, border: '1px solid #e2e8f0' }}>
            <Statistic
              title="Ứng viên Đạt (Chờ Offer)"
              value={passedCount}
              valueStyle={{ color: '#0284c7', fontWeight: 800, fontSize: 28 }}
              prefix={<CheckCircleOutlined style={{ color: '#0284c7' }} />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card style={{ borderRadius: 12, border: '1px solid #e2e8f0' }}>
            <Statistic
              title="Tỷ lệ tham gia đúng giờ"
              value={100}
              suffix="%"
              valueStyle={{ color: '#7c3aed', fontWeight: 800, fontSize: 28 }}
            />
          </Card>
        </Col>
      </Row>

      {/* Filter Card */}
      <Card
        style={{
          borderRadius: 12,
          marginBottom: 16,
          border: '1px solid #e2e8f0',
        }}
        styles={{ body: { padding: '12px 18px' } }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Space>
            <span style={{ fontWeight: 600 }}>Lọc theo trạng thái:</span>
            <Select
              value={statusFilter}
              onChange={setStatusFilter}
              style={{ width: 180 }}
              options={[
                { label: 'Tất cả trạng thái', value: 'ALL' },
                { label: 'Sắp diễn ra (Scheduled)', value: 'SCHEDULED' },
                { label: 'Đã đạt (Passed)', value: 'PASSED' },
                { label: 'Không đạt (Failed)', value: 'FAILED' },
              ]}
            />
          </Space>
          <Button icon={<ReloadOutlined />} onClick={() => setStatusFilter('ALL')} style={{ borderRadius: 8 }}>
            Làm mới
          </Button>
        </div>
      </Card>

      {/* Table */}
      <Card
        style={{
          borderRadius: 12,
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        }}
      >
        <Table
          dataSource={filteredInterviews}
          columns={columns}
          rowKey="id"
          pagination={{ pageSize: 8 }}
          size="middle"
        />
      </Card>

      {/* Reschedule Modal */}
      <Modal
        open={rescheduleModalOpen}
        onCancel={() => setRescheduleModalOpen(false)}
        title={
          <Space>
            <ClockCircleOutlined style={{ color: '#0284c7' }} />
            <span>Xếp lại lịch phỏng vấn (Reschedule)</span>
          </Space>
        }
        onOk={handleReschedule}
        okText="Cập nhật lịch mới"
        cancelText="Hủy"
        okButtonProps={{ style: { borderRadius: 8, background: '#0284c7' } }}
        cancelButtonProps={{ style: { borderRadius: 8 } }}
      >
        {selectedInterview && (
          <div style={{ marginTop: 12 }}>
            <div style={{ padding: 12, background: '#f8fafc', borderRadius: 8, marginBottom: 16 }}>
              <div><strong>Ứng viên:</strong> {selectedInterview.candidateName}</div>
              <div><strong>Doanh nghiệp:</strong> {selectedInterview.companyName}</div>
              <div><strong>Lịch hiện tại:</strong> {selectedInterview.scheduledTime}</div>
            </div>

            <div style={{ marginBottom: 6, fontWeight: 600 }}>Chọn thời gian phỏng vấn mới:</div>
            <Input
              value={newTime}
              onChange={(e) => setNewTime(e.target.value)}
              placeholder="VD: 2026-09-28 14:00"
              style={{ borderRadius: 8 }}
            />
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
              Hệ thống sẽ tự động gửi email thông báo cập nhật lịch tới cả Ứng viên và Doanh nghiệp.
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
