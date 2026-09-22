/**
 * @file AffiliateSubmissionsPage.tsx
 * @path src/pages/affiliate/AffiliateSubmissionsPage.tsx
 * @description Candidate Submissions & Attribution Dispute Tracker for Headhunter / Affiliate (David Tran - aff-001).
 * 
 * Spec Compliance (Mục 4 & 5 - Submissions & Attribution Dispute):
 * 1. Data Columns:
 *    - Tên ứng viên & Vị trí ứng tuyển
 *    - Thời gian nộp (Timestamp lưu vết - dùng để bảo vệ quyền ưu tiên)
 *    - Trạng thái hiện tại: [Chờ HR duyệt] | [Đã vào phỏng vấn] | [Đã nhận việc] | [Bị từ chối] | [Trùng lặp]
 *    - Thao tác:
 *      * Nút [Khiếu nại Attribution] khi hồ sơ bị báo trùng (isDuplicate / DUPLICATE):
 *        Bật Modal nhập lý do, bằng chứng timestamp, email trao đổi để OPR Hub giải quyết tranh chấp.
 *      * Nút [Xem CV gốc].
 */

import React, { useState, useMemo } from 'react';
import {
  Table, Tag, Button, Input, Select, Card, Row, Col, Typography, Space,
  Avatar, Modal, Form, Tooltip, message, Alert,
} from 'antd';
import {
  SearchOutlined, DownloadOutlined, ExclamationCircleOutlined,
  CheckCircleOutlined, ClockCircleOutlined, CloseCircleOutlined,
  WarningOutlined,
  CalendarOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import type { AffiliateSubmissionDTO, SubmissionStatus } from '@/types/affiliate';

const { Title, Text } = Typography;
const { TextArea } = Input;

// ─── Initial Mock Submissions for David Tran (aff-001) ─────────────────────────
const INITIAL_SUBMISSIONS: AffiliateSubmissionDTO[] = [
  {
    id: 'SUB-AFF-001',
    jobId: 'JOB-TC-001',
    jobTitle: 'Senior Java Backend Engineer (Microservices)',
    companyName: 'TechCorp Việt Nam',
    candidateName: 'Nguyễn Văn Hoàng',
    email: 'hoang.nguyen@devmail.com',
    phone: '0901 234 567',
    cvUrl: '/files/CV_NguyenVanHoang_JavaLead.pdf',
    submittedAt: '2026-02-14T08:15:32.000Z',
    status: 'PROBATION',
    isDuplicate: false,
    hasDispute: false,
    salaryExpectation: 55000000,
    currentStageNote: 'Đã nhận việc và đang trong 60 ngày thử việc gói HEADHUNT_COD.',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
  },
  {
    id: 'SUB-AFF-002',
    jobId: 'JOB-TC-002',
    jobTitle: 'Frontend Tech Lead (React & TypeScript)',
    companyName: 'TechCorp Việt Nam',
    candidateName: 'Trần Thu Trang',
    email: 'trang.tran@techpro.vn',
    phone: '0912 345 678',
    cvUrl: '/files/CV_TranThuTrang_FrontendLead.pdf',
    submittedAt: '2026-03-10T09:45:10.000Z',
    status: 'INTERVIEW',
    isDuplicate: false,
    hasDispute: false,
    salaryExpectation: 65000000,
    currentStageNote: 'Đã hoàn thành phỏng vấn vòng 1 với Tech Director (Sarah Chen), chuẩn bị gửi Offer.',
    avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150',
  },
  {
    id: 'SUB-AFF-003',
    jobId: 'JOB-TC-003',
    jobTitle: 'Cloud Kubernetes DevOps Specialist',
    companyName: 'TechCorp Việt Nam',
    candidateName: 'Lê Quốc Bảo',
    email: 'bao.le@cloudnet.io',
    phone: '0922 888 999',
    cvUrl: '/files/CV_LeQuocBao_DevOps.pdf',
    submittedAt: '2026-03-15T14:20:00.000Z',
    status: 'DUPLICATE',
    isDuplicate: true,
    hasDispute: false,
    duplicateWithAffiliate: 'TalentHub Affiliate (aff-088)',
    duplicateSubmittedAt: '2026-03-15T14:28:45.000Z', // David Tran submitted earlier!
    salaryExpectation: 45000000,
    currentStageNote: 'Hệ thống báo trùng SĐT/Email với bên thứ ba. David Tran có bằng chứng timestamp sớm hơn 8 phút.',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
  },
  {
    id: 'SUB-AFF-004',
    jobId: 'JOB-TC-001',
    jobTitle: 'Senior Java Backend Engineer (Microservices)',
    companyName: 'TechCorp Việt Nam',
    candidateName: 'Đặng Quốc Huy',
    email: 'huy.dang@fintech.vn',
    phone: '0933 777 666',
    cvUrl: '/files/CV_DangQuocHuy_Backend.pdf',
    submittedAt: '2026-03-16T11:05:18.000Z',
    status: 'SUBMITTED',
    isDuplicate: false,
    hasDispute: false,
    salaryExpectation: 50000000,
    currentStageNote: 'Đang trong hàng đợi sơ loại CV của Internal HR.',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150',
  },
  {
    id: 'SUB-AFF-005',
    jobId: 'JOB-TC-004',
    jobTitle: 'Application Security Specialist',
    companyName: 'TechCorp Việt Nam',
    candidateName: 'Vũ Hải Đăng',
    email: 'dang.vu@secops.com',
    phone: '0944 111 222',
    cvUrl: '/files/CV_VuHaiDang_AppSec.pdf',
    submittedAt: '2026-03-02T16:40:22.000Z',
    status: 'REJECTED',
    isDuplicate: false,
    hasDispute: false,
    salaryExpectation: 42000000,
    currentStageNote: 'Chưa đủ năm kinh nghiệm về Penetration Testing thực chiến.',
    avatar: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=150',
  },
  {
    id: 'SUB-AFF-006',
    jobId: 'JOB-TC-002',
    jobTitle: 'Frontend Tech Lead (React & TypeScript)',
    companyName: 'TechCorp Việt Nam',
    candidateName: 'Phạm Minh Trí',
    email: 'tri.pham@reactlead.com',
    phone: '0955 333 444',
    cvUrl: '/files/CV_PhamMinhTri_React.pdf',
    submittedAt: '2026-03-12T10:12:05.000Z',
    status: 'DUPLICATE',
    isDuplicate: true,
    hasDispute: true,
    disputeStatus: 'PENDING',
    disputeReason: 'Ứng viên xác nhận chỉ đồng ý cho David Tran đại diện qua email ngày 12/03 lúc 09:00.',
    disputeEvidence: 'Email screenshot và bản cam kết thỏa thuận ứng tuyển độc quyền.',
    duplicateWithAffiliate: 'FastHire Network (aff-012)',
    duplicateSubmittedAt: '2026-03-12T10:15:30.000Z',
    salaryExpectation: 60000000,
    currentStageNote: 'Đang trong quy trình giải quyết khiếu nại trọng tài OPR Hub.',
    avatar: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=150',
  },
];

export const AffiliateSubmissionsPage: React.FC = () => {
  const [submissions, setSubmissions] = useState<AffiliateSubmissionDTO[]>(INITIAL_SUBMISSIONS);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');

  // Dispute Modal State
  const [disputeModalOpen, setDisputeModalOpen] = useState<boolean>(false);
  const [targetSubmission, setTargetSubmission] = useState<AffiliateSubmissionDTO | null>(null);
  const [disputeForm] = Form.useForm();
  const [submittingDispute, setSubmittingDispute] = useState<boolean>(false);

  // Open Dispute Modal
  const handleOpenDispute = (record: AffiliateSubmissionDTO) => {
    setTargetSubmission(record);
    disputeForm.setFieldsValue({
      candidateName: record.candidateName,
      jobTitle: record.jobTitle,
      submittedAt: dayjs(record.submittedAt).format('DD/MM/YYYY HH:mm:ss'),
      competitorTimestamp: record.duplicateSubmittedAt
        ? dayjs(record.duplicateSubmittedAt).format('DD/MM/YYYY HH:mm:ss')
        : 'Không rõ',
      reason: 'FIRST_SUBMISSION_PRIORITY',
      notes: `Tôi đã gửi hồ sơ ứng viên ${record.candidateName} trước đối tác khác. Ứng viên có xác nhận đồng ý cho tôi nộp hồ sơ độc quyền vào vị trí ${record.jobTitle}.`,
    });
    setDisputeModalOpen(true);
  };

  // Submit Dispute
  const handleDisputeSubmit = async () => {
    try {
      const values = await disputeForm.validateFields();
      if (!targetSubmission) return;

      setSubmittingDispute(true);
      setTimeout(() => {
        setSubmissions((prev) =>
          prev.map((item) => {
            if (item.id === targetSubmission.id) {
              return {
                ...item,
                hasDispute: true,
                disputeStatus: 'PENDING',
                disputeReason: values.notes,
                disputeEvidence: values.evidenceUrl || 'Đã đính kèm ảnh chụp màn hình xác nhận của ứng viên',
                currentStageNote: 'Đã gửi khiếu nại tranh chấp Attribution tới Ban trọng tài OPR Hub.',
              };
            }
            return item;
          })
        );
        message.success(
          `Đã gửi khiếu nại tranh chấp Attribution cho hồ sơ "${targetSubmission.candidateName}" thành công! OPR Hub sẽ xử lý trong vòng 4 giờ làm việc.`
        );
        setSubmittingDispute(false);
        setDisputeModalOpen(false);
      }, 600);
    } catch {
      // Form validation error
    }
  };

  // Filtered dataset
  const filteredSubmissions = useMemo(() => {
    return submissions.filter((item) => {
      const matchSearch =
        !searchTerm ||
        item.candidateName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.jobTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.email.toLowerCase().includes(searchTerm.toLowerCase());

      const matchStatus =
        selectedStatus === 'ALL' ||
        (selectedStatus === 'DUPLICATE' && item.isDuplicate) ||
        item.status === selectedStatus;

      return matchSearch && matchStatus;
    });
  }, [submissions, searchTerm, selectedStatus]);

  // Status tag mapper
  const renderStatusBadge = (status: SubmissionStatus, isDuplicate: boolean, hasDispute: boolean) => {
    if (isDuplicate) {
      if (hasDispute) {
        return (
          <Tag color="volcano" icon={<ExclamationCircleOutlined />}>
            Đang khiếu nại Attribution
          </Tag>
        );
      }
      return (
        <Tag color="error" icon={<CloseCircleOutlined />}>
          Trùng lặp (Duplicate)
        </Tag>
      );
    }

    switch (status) {
      case 'SUBMITTED':
        return (
          <Tag color="blue" icon={<ClockCircleOutlined />}>
            Chờ HR duyệt
          </Tag>
        );
      case 'HR_SCREENING':
        return (
          <Tag color="cyan" icon={<ClockCircleOutlined />}>
            HR sơ loại
          </Tag>
        );
      case 'INTERVIEW':
        return (
          <Tag color="purple" icon={<CalendarOutlined />}>
            Đã vào phỏng vấn
          </Tag>
        );
      case 'HIRED':
      case 'PROBATION':
        return (
          <Tag color="success" icon={<CheckCircleOutlined />}>
            Đã nhận việc / Thử việc
          </Tag>
        );
      case 'REJECTED':
        return (
          <Tag color="default" icon={<CloseCircleOutlined />}>
            Bị từ chối
          </Tag>
        );
      default:
        return <Tag>{status}</Tag>;
    }
  };

  // Table Columns Definition
  const columns: ColumnsType<AffiliateSubmissionDTO> = [
    {
      title: 'Ứng viên & Vị trí ứng tuyển',
      key: 'candidate',
      minWidth: 280,
      render: (_: any, record: AffiliateSubmissionDTO) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Avatar src={record.avatar} size={42} style={{ border: '2px solid #e2e8f0' }}>
            {record.candidateName.charAt(0)}
          </Avatar>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14, color: '#0f172a' }}>{record.candidateName}</div>
            <div style={{ fontSize: 12, color: '#2563eb', fontWeight: 500 }}>{record.jobTitle}</div>
            <div style={{ fontSize: 11, color: '#64748b' }}>
              {record.companyName} • Lương kỳ vọng: <strong>{record.salaryExpectation?.toLocaleString('vi-VN')} đ</strong>
            </div>
          </div>
        </div>
      ),
    },
    {
      title: 'Thời gian nộp (Timestamp lưu vết)',
      dataIndex: 'submittedAt',
      key: 'submittedAt',
      minWidth: 220,
      sorter: (a, b) => new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime(),
      render: (dateStr: string, record: AffiliateSubmissionDTO) => (
        <div>
          <div style={{ fontFamily: 'monospace', fontWeight: 600, color: '#0f172a', fontSize: 13 }}>
            {dayjs(dateStr).format('DD/MM/YYYY HH:mm:ss')}
          </div>
          <div style={{ fontSize: 11, color: '#059669', marginTop: 2 }}>
            <ClockCircleOutlined style={{ marginRight: 4 }} />
            Khóa Attribution ưu tiên
          </div>
          {record.duplicateSubmittedAt && (
            <div style={{ fontSize: 11, color: '#dc2626', marginTop: 2 }}>
              Đối thủ submit: {dayjs(record.duplicateSubmittedAt).format('HH:mm:ss DD/MM')}
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Trạng thái hiện tại',
      key: 'status',
      minWidth: 200,
      render: (_: any, record: AffiliateSubmissionDTO) => (
        <div>
          {renderStatusBadge(record.status, record.isDuplicate, record.hasDispute)}
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 4, maxWidth: 220 }}>
            {record.currentStageNote}
          </div>
        </div>
      ),
    },
    {
      title: 'Thao tác & Khiếu nại',
      key: 'actions',
      minWidth: 220,
      render: (_: any, record: AffiliateSubmissionDTO) => (
        <Space size={8}>
          <Tooltip title="Tải xuống CV gốc của ứng viên">
            <Button
              size="small"
              icon={<DownloadOutlined />}
              onClick={() => message.success(`Đang tải file: ${record.cvUrl}`)}
            >
              Xem CV
            </Button>
          </Tooltip>

          {record.isDuplicate && !record.hasDispute && (
            <Button
              size="small"
              type="primary"
              danger
              icon={<WarningOutlined />}
              onClick={() => handleOpenDispute(record)}
            >
              Khiếu nại Attribution
            </Button>
          )}

          {record.hasDispute && (
            <Tooltip title={record.disputeReason}>
              <Tag color="orange" style={{ cursor: 'pointer' }}>
                Đang thụ lý tranh chấp
              </Tag>
            </Tooltip>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div style={{ maxWidth: 1240, margin: '0 auto' }}>
      {/* ─── PAGE HEADER ──────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 20 }}>
        <Title level={3} style={{ margin: 0, color: '#0f172a' }}>
          Hồ sơ đã giới thiệu & Tiến độ tuyển dụng
        </Title>
        <Text style={{ color: '#64748b' }}>
          Headhunter: <strong style={{ color: '#0f172a' }}>David Tran</strong> (RecruitPro Network) • Giám sát trạng thái phễu tuyển dụng & bảo vệ bản quyền giới thiệu
        </Text>
      </div>

      {/* ─── OVERVIEW STATS ───────────────────────────────────────────────────── */}
      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col xs={24} sm={6}>
          <Card style={{ borderRadius: 8, border: '1px solid #e2e8f0' }}>
            <Text type="secondary" style={{ fontSize: 13 }}>Tổng hồ sơ đã nộp</Text>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#0f172a', marginTop: 4 }}>
              {submissions.length}
            </div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>Trong toàn bộ chiến dịch</div>
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card style={{ borderRadius: 8, border: '1px solid #e2e8f0' }}>
            <Text type="secondary" style={{ fontSize: 13 }}>Đang phỏng vấn</Text>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#2563eb', marginTop: 4 }}>
              {submissions.filter((s) => s.status === 'INTERVIEW').length}
            </div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>Cơ hội chốt thưởng cao</div>
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card style={{ borderRadius: 8, border: '1px solid #e2e8f0' }}>
            <Text type="secondary" style={{ fontSize: 13 }}>Đã nhận việc / Thử việc</Text>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#16a34a', marginTop: 4 }}>
              {submissions.filter((s) => s.status === 'HIRED' || s.status === 'PROBATION').length}
            </div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>Đang tích lũy hoa hồng</div>
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card style={{ borderRadius: 8, border: '1px solid #e2e8f0' }}>
            <Text type="secondary" style={{ fontSize: 13 }}>Hồ sơ trùng lặp (Cần xử lý)</Text>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#dc2626', marginTop: 4 }}>
              {submissions.filter((s) => s.isDuplicate).length}
            </div>
            <div style={{ fontSize: 12, color: '#dc2626', marginTop: 2 }}>Có thể khiếu nại Timestamp</div>
          </Card>
        </Col>
      </Row>

      {/* ─── POLICY EXPLANATION ───────────────────────────────────────────────── */}
      <Alert
        message="Chính sách Bảo vệ Bản quyền Giới thiệu (First-Submission Policy - Mục 4)"
        description="Khi hồ sơ bị báo trùng lặp với Headhunter khác, quyền sở hữu Attribution được ưu tiên tuyệt đối cho người có Timestamp nộp hồ sơ sớm hơn kèm xác nhận của ứng viên. Hãy bấm [Khiếu nại Attribution] nếu bạn sở hữu bằng chứng nộp trước."
        type="info"
        showIcon
        icon={<CheckCircleOutlined style={{ color: '#2563eb' }} />}
        style={{ marginBottom: 20, borderRadius: 8 }}
      />

      {/* ─── FILTER CONTROLS ─────────────────────────────────────────────────── */}
      <Card style={{ marginBottom: 20, borderRadius: 8, border: '1px solid #e2e8f0' }}>
        <Row gutter={[16, 16]} align="middle">
          <Col xs={24} md={12}>
            <Input
              placeholder="Tìm theo tên ứng viên, vị trí tuyển dụng, email..."
              prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              allowClear
            />
          </Col>
          <Col xs={24} md={12} style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
            <Select
              value={selectedStatus}
              onChange={setSelectedStatus}
              style={{ width: 260 }}
              options={[
                { value: 'ALL', label: 'Tất cả trạng thái hồ sơ' },
                { value: 'SUBMITTED', label: 'Chờ HR duyệt' },
                { value: 'INTERVIEW', label: 'Đã vào phỏng vấn' },
                { value: 'PROBATION', label: 'Đã nhận việc / Thử việc' },
                { value: 'DUPLICATE', label: 'Bị báo trùng lặp (Duplicate)' },
                { value: 'REJECTED', label: 'Bị từ chối' },
              ]}
            />
          </Col>
        </Row>
      </Card>

      {/* ─── SUBMISSIONS TABLE ────────────────────────────────────────────────── */}
      <Card
        style={{ borderRadius: 8, border: '1px solid #e2e8f0' }}
        styles={{ body: { padding: 0 } }}
      >
        <Table<AffiliateSubmissionDTO>
          columns={columns}
          dataSource={filteredSubmissions}
          rowKey="id"
          pagination={{ pageSize: 10, showTotal: (total) => `Tổng cộng ${total} hồ sơ đã giới thiệu` }}
          scroll={{ x: 1080 }}
          locale={{ emptyText: 'Chưa có hồ sơ giới thiệu nào phù hợp.' }}
        />
      </Card>

      {/* ─── MODAL: KHIẾU NẠI TRANH CHẤP ATTRIBUTION ─────────────────────────── */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#dc2626' }}>
            <WarningOutlined />
            <span>Khiếu nại Tranh chấp Bản quyền Giới thiệu (Raise Dispute)</span>
          </div>
        }
        open={disputeModalOpen}
        onCancel={() => setDisputeModalOpen(false)}
        onOk={handleDisputeSubmit}
        confirmLoading={submittingDispute}
        okText="Gửi Khiếu nại lên OPR Hub"
        okButtonProps={{ danger: true }}
        cancelText="Hủy"
        destroyOnClose
        width={580}
      >
        <div style={{ margin: '12px 0' }}>
          <Text type="secondary">
            Theo điều khoản trọng tài OPR Hub, bạn có quyền yêu cầu xét duyệt lại nếu bạn có Timestamp gửi hồ sơ sớm hơn hoặc có thỏa thuận độc quyền từ ứng viên.
          </Text>
        </div>

        <Form form={disputeForm} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="Ứng viên tranh chấp" name="candidateName">
                <Input disabled />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Vị trí tuyển dụng" name="jobTitle">
                <Input disabled />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="Thời gian nộp của bạn" name="submittedAt">
                <Input disabled style={{ color: '#059669', fontWeight: 600 }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Thời gian nộp của bên khác" name="competitorTimestamp">
                <Input disabled style={{ color: '#dc2626' }} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            label="Căn cứ khiếu nại"
            name="reason"
            rules={[{ required: true, message: 'Vui lòng chọn căn cứ khiếu nại' }]}
          >
            <Select
              options={[
                { value: 'FIRST_SUBMISSION_PRIORITY', label: 'Timestamp nộp hồ sơ của tôi sớm hơn (Ưu tiên nộp trước)' },
                { value: 'EXCLUSIVE_REPRESENTATION', label: 'Ứng viên ký văn bản cam kết đại diện độc quyền với tôi' },
                { value: 'CANDIDATE_CONFIRMED', label: 'Ứng viên xác nhận chỉ trao đổi với David Tran' },
              ]}
            />
          </Form.Item>

          <Form.Item
            label="Đường dẫn hoặc mô tả bằng chứng lưu vết"
            name="evidenceUrl"
          >
            <Input placeholder="Link ảnh chụp email/Zalo xác nhận hoặc mã file Drive bằng chứng..." />
          </Form.Item>

          <Form.Item
            label="Nội dung giải trình chi tiết gửi Ban trọng tài"
            name="notes"
            rules={[{ required: true, message: 'Vui lòng nhập giải trình chi tiết' }]}
          >
            <TextArea
              rows={3}
              placeholder="Mô tả cụ thể diễn biến và dẫn chứng để ban trọng tài đối soát..."
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default AffiliateSubmissionsPage;
