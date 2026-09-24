/**
 * @file AffiliateSubmissionsPage.tsx
 * @path src/pages/affiliate/AffiliateSubmissionsPage.tsx
 * @description Candidate Submissions & Attribution Dispute Tracker for Headhunter / Affiliate (David Tran - aff-001).
 * 
 * Spec Compliance (Mục 4 & 5 - Submissions & Attribution Dispute):
 * 1. Reads directly from 'hrconnect_candidate_applications' via useApplicationStore,
 *    filtering by the logged-in CTV's affiliateEmail.
 * 2. Displays newly submitted candidates (from both Talent Pool and External upload)
 *    immediately with Candidate Name, Target Job, First-submission timestamp, Status, and Actions.
 * 3. Preserves initial demonstration submissions for demo account David Tran.
 * 4. Actions:
 *    - View / Download CV
 *    - Raise Attribution Dispute on duplicate / disputed records
 */

import React, { useState, useMemo } from 'react';
import {
  Table, Tag, Button, Input, Select, Card, Row, Col, Typography, Space,
  Avatar, Modal, Form, Tooltip, message, Alert,
} from 'antd';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { useApplicationStore, CandidateApplicationRecord, ApplicationStatus } from '@/stores/applicationStore';
import {
  SearchOutlined, DownloadOutlined, ExclamationCircleOutlined,
  CheckCircleOutlined, ClockCircleOutlined, CloseCircleOutlined,
  WarningOutlined,
  CalendarOutlined,
  UserAddOutlined,
  TeamOutlined,
  FilePdfOutlined,
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
    duplicateSubmittedAt: '2026-03-15T14:28:45.000Z',
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

function mapAppStatusToSubmissionStatus(appStatus: ApplicationStatus): SubmissionStatus {
  switch (appStatus) {
    case 'PENDING_HR_REVIEW':
    case 'APPLIED':
      return 'SUBMITTED';
    case 'SCREENING':
      return 'HR_SCREENING';
    case 'INTERVIEW_SCHEDULED':
    case 'INTERVIEW_PASSED':
    case 'INTERVIEW_FAILED':
      return 'INTERVIEW';
    case 'OFFERED':
      return 'HIRED';
    case 'ONBOARDED':
      return 'PROBATION';
    case 'REJECTED':
      return 'REJECTED';
    default:
      return 'SUBMITTED';
  }
}

function getStageNoteForApp(app: CandidateApplicationRecord): string {
  switch (app.status) {
    case 'PENDING_HR_REVIEW':
    case 'APPLIED':
      return 'Dấu thời gian nộp đầu tiên đã được khóa. Đang chờ Internal HR xem xét hồ sơ sơ loại.';
    case 'SCREENING':
      return 'Hồ sơ đang được sàng lọc và đánh giá độ phù hợp tự động bằng công nghệ AI.';
    case 'INTERVIEW_SCHEDULED':
      return app.interviewTime
        ? `Đã lên lịch phỏng vấn: ${dayjs(app.interviewTime).format('DD/MM/YYYY HH:mm')}`
        : 'Đã lên lịch phỏng vấn với phòng kỹ thuật & khách hàng.';
    case 'INTERVIEW_PASSED':
      return 'Ứng viên đã vượt qua vòng phỏng vấn chuyên môn. Đang chuẩn bị thủ tục Offer.';
    case 'INTERVIEW_FAILED':
      return 'Ứng viên chưa vượt qua buổi phỏng vấn đánh giá kỹ năng chuyên môn.';
    case 'OFFERED':
      return 'Đã gửi Thư mời nhận việc (Offer) tới ứng viên. Chờ xác nhận thời gian Onboarding.';
    case 'ONBOARDED':
      return 'Ứng viên đã chính thức nhận việc. Đang trong chu kỳ 60 ngày bảo hành thử việc (COD).';
    case 'REJECTED':
      return 'Hồ sơ không đáp ứng tiêu chí tuyển dụng của vị trí này.';
    default:
      return app.notes || 'Hồ sơ đang được xử lý trong luồng tuyển dụng.';
  }
}

export const AffiliateSubmissionsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const rawApplications = useApplicationStore((state) => state.applications);

  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');

  // Dispute overrides in local state for demonstration
  const [disputes, setDisputes] = useState<Record<string, { reason: string; evidence: string }>>({});

  // Dispute Modal State
  const [disputeModalOpen, setDisputeModalOpen] = useState<boolean>(false);
  const [targetSubmission, setTargetSubmission] = useState<AffiliateSubmissionDTO | null>(null);
  const [disputeForm] = Form.useForm();
  const [submittingDispute, setSubmittingDispute] = useState<boolean>(false);

  // ─── UNIFIED SUBMISSIONS FROM STORE + DEMO SEED ─────────────────────────────
  const submissions = useMemo<AffiliateSubmissionDTO[]>(() => {
    const userEmail = (user?.email || '').toLowerCase().trim();
    const isDemoAffiliate = user?.id === 'aff-001' || userEmail.includes('david.tran') || userEmail.includes('affiliate');

    // 1. Filter applications belonging to current affiliate from shared application store
    const affiliateApps = rawApplications.filter((app) => {
      if (app.source !== 'AFFILIATE') return false;
      if (!userEmail) return true;
      if (app.affiliateEmail && app.affiliateEmail.toLowerCase().trim() === userEmail) return true;
      if (!app.affiliateEmail && (userEmail.includes('affiliate') || userEmail.includes('david.tran'))) return true;
      if (app.affiliateName && user?.name && app.affiliateName.toLowerCase() === user.name.toLowerCase()) return true;
      return false;
    });

    // Convert store applications into AffiliateSubmissionDTO
    const storeSubmissions: AffiliateSubmissionDTO[] = affiliateApps.map((app) => {
      const isDisputed = !!disputes[app.id];
      return {
        id: app.id,
        jobId: app.jobId,
        jobTitle: app.jobTitle,
        companyName: app.company,
        candidateName: app.fullName,
        email: app.email,
        phone: app.phone || '',
        cvUrl: app.cvUrl || `/files/CV_${app.fullName.replace(/\s+/g, '')}.pdf`,
        submittedAt: app.firstSubmissionTimestamp || app.applyDate,
        status: mapAppStatusToSubmissionStatus(app.status),
        isDuplicate: false,
        hasDispute: isDisputed,
        disputeStatus: isDisputed ? 'PENDING' : undefined,
        disputeReason: isDisputed ? disputes[app.id].reason : undefined,
        disputeEvidence: isDisputed ? disputes[app.id].evidence : undefined,
        salaryExpectation: app.salaryExpectation || 45000000,
        currentStageNote: getStageNoteForApp(app),
        avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(app.fullName)}`,
      };
    });

    // 2. If demo affiliate, merge with initial mock submissions (avoiding duplicate email + job)
    if (isDemoAffiliate) {
      const existingKeys = new Set(
        storeSubmissions.map((s) => `${s.email.toLowerCase()}__${s.jobId}`)
      );
      const uniqueInitial = INITIAL_SUBMISSIONS.filter(
        (init) => !existingKeys.has(`${init.email.toLowerCase()}__${init.jobId}`)
      );
      return [...storeSubmissions, ...uniqueInitial];
    }

    return storeSubmissions;
  }, [rawApplications, user, disputes]);

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
        setDisputes((prev) => ({
          ...prev,
          [targetSubmission.id]: {
            reason: values.notes,
            evidence: values.evidenceUrl || 'Đã đính kèm ảnh chụp màn hình xác nhận của ứng viên',
          },
        }));

        message.success(
          `Đã gửi khiếu nại tranh chấp Attribution cho hồ sơ "${targetSubmission.candidateName}" thành công! Ban trọng tài OPR Hub sẽ xử lý trong vòng 4 giờ làm việc.`
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
          <Tag color="gold" icon={<ClockCircleOutlined />}>
            Chờ HR duyệt
          </Tag>
        );
      case 'HR_SCREENING':
        return (
          <Tag color="purple" icon={<ClockCircleOutlined />}>
            Đang sơ tuyển AI
          </Tag>
        );
      case 'INTERVIEW':
        return (
          <Tag color="blue" icon={<CalendarOutlined />}>
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
            <div style={{ fontSize: 11, color: '#94a3b8' }}>{record.email} • {record.phone}</div>
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
      defaultSortOrder: 'descend',
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
      minWidth: 220,
      render: (_: any, record: AffiliateSubmissionDTO) => (
        <div>
          {renderStatusBadge(record.status, record.isDuplicate, record.hasDispute)}
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 4, maxWidth: 240, lineHeight: 1.4 }}>
            {record.currentStageNote}
          </div>
        </div>
      ),
    },
    {
      title: 'Thao tác & Hồ sơ',
      key: 'actions',
      minWidth: 200,
      render: (_: any, record: AffiliateSubmissionDTO) => (
        <Space size={8}>
          <Tooltip title={`Tải / Xem file CV: ${record.cvUrl}`}>
            <Button
              size="small"
              icon={<DownloadOutlined />}
              onClick={() => message.success(`Đang mở xem file CV: ${record.cvUrl}`)}
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <Title level={3} style={{ margin: 0, color: '#0f172a' }}>
            Hồ sơ đã giới thiệu & Tiến độ tuyển dụng
          </Title>
          <Text style={{ color: '#64748b' }}>
            Headhunter / CTV: <strong style={{ color: '#0f172a' }}>{user?.name || user?.email || 'Chuyên viên Tuyển dụng'}</strong> ({user?.company || 'Cộng tác viên Độc lập'}) • Dữ liệu đồng bộ trực tiếp từ kho hồ sơ hệ thống
          </Text>
        </div>
        <Button
          type="primary"
          icon={<UserAddOutlined />}
          size="large"
          onClick={() => navigate('/affiliate/referral')}
          style={{
            borderRadius: 8,
            fontWeight: 700,
            background: 'linear-gradient(135deg, #0284c7, #0369a1)',
            border: 'none',
          }}
        >
          Giới thiệu thêm ứng viên
        </Button>
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
        description="Khi hồ sơ bị báo trùng lặp với Headhunter khác, quyền sở hữu Attribution được ưu tiên tuyệt đối cho người có Timestamp nộp hồ sơ sớm hơn kèm xác nhận của ứng viên. Mọi hồ sơ bạn nộp đều được lưu vết thời gian bất biến trên hệ thống."
        type="info"
        showIcon
        icon={<CheckCircleOutlined style={{ color: '#2563eb' }} />}
        style={{ marginBottom: 20, borderRadius: 8 }}
      />

      {submissions.length === 0 ? (
        <Card style={{ borderRadius: 14, textAlign: 'center', padding: '60px 20px', border: '1px solid #e2e8f0' }}>
          <TeamOutlined style={{ fontSize: 48, color: '#cbd5e1', marginBottom: 16 }} />
          <Title level={4} style={{ color: '#0f172a', marginBottom: 8 }}>
            Bạn chưa giới thiệu ứng viên nào
          </Title>
          <Text type="secondary" style={{ display: 'block', maxWidth: 480, margin: '0 auto 24px', fontSize: 13.5 }}>
            Khám phá các việc làm hấp dẫn trên Sàn tuyển dụng và chọn ứng viên từ Kho Talent Pool hoặc tải lên CV để nhận hoa hồng lên tới 45.000.000 đ/deal.
          </Text>
          <Button
            type="primary"
            icon={<UserAddOutlined />}
            size="large"
            onClick={() => navigate('/affiliate/referral')}
            style={{ borderRadius: 8, fontWeight: 700, background: '#0284c7', borderColor: '#0284c7' }}
          >
            Giới thiệu ứng viên đầu tiên
          </Button>
        </Card>
      ) : (
        <>
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
                  style={{ width: 220 }}
                  options={[
                    { value: 'ALL', label: 'Tất cả trạng thái' },
                    { value: 'SUBMITTED', label: 'Chờ HR duyệt' },
                    { value: 'HR_SCREENING', label: 'Đang sơ tuyển AI' },
                    { value: 'INTERVIEW', label: 'Đã vào phỏng vấn' },
                    { value: 'PROBATION', label: 'Đã nhận việc / Thử việc' },
                    { value: 'REJECTED', label: 'Bị từ chối' },
                    { value: 'DUPLICATE', label: 'Trùng lặp (Duplicate)' },
                  ]}
                />
              </Col>
            </Row>
          </Card>

          {/* ─── TABLE ───────────────────────────────────────────────────────────── */}
          <Card style={{ borderRadius: 8, border: '1px solid #e2e8f0' }} styles={{ body: { padding: 0 } }}>
            <Table<AffiliateSubmissionDTO>
              columns={columns}
              dataSource={filteredSubmissions}
              rowKey="id"
              pagination={{ pageSize: 8, showTotal: (total) => `Tổng cộng ${total} hồ sơ đã giới thiệu` }}
              scroll={{ x: 920 }}
            />
          </Card>
        </>
      )}

      {/* ─── DISPUTE MODAL ────────────────────────────────────────────────────── */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#dc2626' }}>
            <WarningOutlined />
            <span>Tạo khiếu nại tranh chấp Attribution Dấu thời gian</span>
          </div>
        }
        open={disputeModalOpen}
        onCancel={() => setDisputeModalOpen(false)}
        footer={[
          <Button key="cancel" onClick={() => setDisputeModalOpen(false)}>
            Hủy
          </Button>,
          <Button
            key="submit"
            type="primary"
            danger
            loading={submittingDispute}
            onClick={handleDisputeSubmit}
          >
            Gửi khiếu nại tới OPR Hub
          </Button>,
        ]}
      >
        <Form form={disputeForm} layout="vertical">
          <Form.Item label="Ứng viên" name="candidateName">
            <Input disabled />
          </Form.Item>
          <Form.Item label="Vị trí tuyển dụng" name="jobTitle">
            <Input disabled />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="Thời điểm bạn nộp hồ sơ" name="submittedAt">
                <Input disabled />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Thời điểm đối thủ nộp" name="competitorTimestamp">
                <Input disabled />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item
            label="Lý do khiếu nại chính"
            name="reason"
            rules={[{ required: true, message: 'Vui lòng chọn lý do khiếu nại' }]}
          >
            <Select
              options={[
                { value: 'FIRST_SUBMISSION_PRIORITY', label: 'Quyền ưu tiên Dấu thời gian nộp trước (First-Submission Priority)' },
                { value: 'EXCLUSIVE_CANDIDATE_CONSENT', label: 'Có sự đồng ý ứng tuyển độc quyền từ ứng viên' },
                { value: 'INCORRECT_DUPLICATE_FLAG', label: 'Sai sót hệ thống trong phát hiện trùng lặp' },
              ]}
            />
          </Form.Item>
          <Form.Item
            label="Giải trình & Bằng chứng xác thực"
            name="notes"
            rules={[{ required: true, message: 'Vui lòng ghi rõ nội dung khiếu nại' }]}
          >
            <TextArea rows={4} placeholder="Mô tả chi tiết bằng chứng (ngày giờ liên hệ, email chấp thuận...)" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default AffiliateSubmissionsPage;

