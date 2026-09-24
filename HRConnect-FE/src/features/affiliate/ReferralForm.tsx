/**
 * @file ReferralForm.tsx
 * @description Screen 2 — Affiliate Candidate Referral Submission (MF-03).
 *
 * Upgraded features:
 *  1. Two candidate source selection tabs:
 *     - Tab 1: [Chọn từ Kho ứng viên hệ thống] (Talent Pool)
 *       * Loads registered candidates from localStorage 'hrconnect_users' (role CANDIDATE) + Talent Pool.
 *       * Includes preseeded Nguyễn Văn B - ungvien5@gmail.com.
 *       * Searchable dropdown by Name, Email, Phone, Title, Skills.
 *       * Autofills Name, Email, Phone, Current Title, and links candidate's profile/CV.
 *       * Affiliate only needs to choose target Job and submit.
 *     - Tab 2: [Thêm ứng viên bên ngoài] (Upload CV ngoài)
 *       * Manual inputs + CV drag & drop upload.
 *  2. Real-time duplicate check with First-Submission Policy enforcement.
 *  3. Records to localStorage 'hrconnect_candidate_applications' (via useApplicationStore) with:
 *     - source: 'AFFILIATE'
 *     - affiliateEmail & affiliateName
 *     - firstSubmissionTimestamp
 *     - status: 'PENDING_HR_REVIEW'
 *  4. Pre-selects job from URL query parameter ?jobId=... or initialJobId prop.
 */
import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  Form, Input, Button, Select, Upload, Alert, Card, Row, Col,
  Typography, Space, Tag, Divider, message, Modal, Spin, Result, Tooltip,
  Tabs, Avatar,
} from 'antd';
import {
  UserOutlined, MailOutlined, PhoneOutlined, LinkedinOutlined,
  UploadOutlined, ClockCircleOutlined, ExclamationCircleOutlined,
  CheckCircleOutlined, WarningOutlined, InfoCircleOutlined,
  LoadingOutlined, LockOutlined, SendOutlined,
  TeamOutlined, FilePdfOutlined, CheckCircleFilled, ApartmentOutlined,
} from '@ant-design/icons';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useJobs } from '@/services/queries/useJobs';
import { useDuplicateCheck } from '@/services/queries/useCandidates';
import { useAuthStore } from '@/stores/authStore';
import { useApplicationStore } from '@/stores/applicationStore';
import { getHRConnectUsers } from '@/services/localStorageService';
import { MOCK_CANDIDATES } from '@/services/mockData';
import type { UploadFile } from 'antd';

const { Title, Text, Paragraph } = Typography;
const { Dragger } = Upload;
const { TextArea } = Input;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalizeEmail(raw: string): string {
  return raw.toLowerCase().trim();
}

function normalizePhone(raw: string): string {
  const stripped = raw.replace(/[\s\-().]/g, '');
  if (/^0\d{9}$/.test(stripped)) return `+84${stripped.slice(1)}`;
  return stripped.startsWith('+') ? stripped : `+${stripped}`;
}

export interface TalentPoolCandidate {
  id: string;
  name: string;
  email: string;
  phone: string;
  currentTitle?: string;
  currentCompany?: string;
  expectedSalary?: number;
  skills?: string[];
  cvUrl?: string;
  yearsOfExp?: number;
  source: 'PLATFORM_USER' | 'TALENT_POOL';
}

function loadTalentPoolCandidates(): TalentPoolCandidate[] {
  const users = getHRConnectUsers();
  const registeredCandidates: TalentPoolCandidate[] = users
    .filter((u) => String(u.role).toUpperCase() === 'CANDIDATE')
    .map((u) => {
      const isCandidate5 = u.email.toLowerCase() === 'ungvien5@gmail.com';
      return {
        id: u.id,
        name: u.fullName || (isCandidate5 ? 'Nguyễn Văn B' : u.email.split('@')[0]),
        email: u.email,
        phone: u.phone || (isCandidate5 ? '0905555666' : '0923456789'),
        currentTitle: isCandidate5 ? 'Kỹ sư Backend Java cấp cao (Senior Java)' : 'Chuyên viên Phát triển Phần mềm',
        currentCompany: isCandidate5 ? 'Fintech Solutions JSC' : 'Doanh nghiệp Công nghệ',
        expectedSalary: isCandidate5 ? 38000000 : 25000000,
        skills: isCandidate5
          ? ['Java', 'Spring Boot', 'Microservices', 'PostgreSQL', 'Docker']
          : ['JavaScript', 'React', 'TypeScript', 'Node.js'],
        cvUrl: isCandidate5 ? '/files/CV_NguyenVanB_Java.pdf' : `/files/CV_${(u.fullName || 'Candidate').replace(/\s+/g, '')}.pdf`,
        yearsOfExp: isCandidate5 ? 5 : 3,
        source: 'PLATFORM_USER',
      };
    });

  // Guarantee ungvien5@gmail.com exists even if localStorage was blank
  if (!registeredCandidates.some((c) => c.email.toLowerCase() === 'ungvien5@gmail.com')) {
    registeredCandidates.unshift({
      id: 'usr-candidate-005',
      name: 'Nguyễn Văn B',
      email: 'ungvien5@gmail.com',
      phone: '0905555666',
      currentTitle: 'Kỹ sư Backend Java cấp cao (Senior Java)',
      currentCompany: 'Fintech Solutions JSC',
      expectedSalary: 38000000,
      skills: ['Java', 'Spring Boot', 'Microservices', 'PostgreSQL', 'Docker'],
      cvUrl: '/files/CV_NguyenVanB_Java.pdf',
      yearsOfExp: 5,
      source: 'PLATFORM_USER',
    });
  }

  // Talent Pool candidates from MOCK_CANDIDATES
  const poolCandidates: TalentPoolCandidate[] = MOCK_CANDIDATES.slice(0, 10).map((c) => ({
    id: c.id,
    name: c.name,
    email: c.email,
    phone: c.phone || '0901234567',
    currentTitle: c.currentTitle,
    currentCompany: c.currentCompany,
    expectedSalary: c.highlightCard?.expectedSalary,
    skills: c.skills,
    cvUrl: `/files/CV_${c.name.replace(/\s+/g, '')}.pdf`,
    yearsOfExp: c.highlightCard?.yearsOfExperience,
    source: 'TALENT_POOL',
  }));

  const map = new Map<string, TalentPoolCandidate>();
  [...registeredCandidates, ...poolCandidates].forEach((cand) => {
    const key = cand.email.toLowerCase();
    if (!map.has(key)) map.set(key, cand);
  });

  return Array.from(map.values());
}

// ─── Field-level duplicate check state ────────────────────────────────────────

type FieldCheckState = 'idle' | 'checking' | 'clear' | 'blocked';

function fieldBorderColor(state: FieldCheckState): string | undefined {
  if (state === 'clear') return '#10b981';
  if (state === 'blocked') return '#ef4444';
  return undefined;
}

function FieldSuffix({ state }: { state: FieldCheckState }) {
  if (state === 'checking')
    return <Spin indicator={<LoadingOutlined style={{ color: '#0284c7' }} spin />} size="small" />;
  if (state === 'blocked')
    return <ExclamationCircleOutlined style={{ color: '#ef4444' }} />;
  if (state === 'clear')
    return <CheckCircleOutlined style={{ color: '#10b981' }} />;
  return null;
}

// ─── Commission journey sidebar ────────────────────────────────────────────────

const JOURNEY_STEPS = [
  { label: 'Ứng viên được giới thiệu (Khóa dấu thời gian)', color: '#0284c7' },
  { label: 'Bộ phận HR sàng lọc & duyệt phỏng vấn qua AI', color: '#8b5cf6' },
  { label: 'Phỏng vấn thành công & nhận lời mời làm việc (Offer)', color: '#f59e0b' },
  { label: 'Ngày làm việc đầu tiên — Bắt đầu bảo hành thử việc 60 ngày', color: '#10b981' },
  { label: 'Ngày 60 — Hết hạn bảo hành → Hoa hồng ĐỦ ĐIỀU KIỆN NHẬN', color: '#10b981' },
];

const CommissionJourney: React.FC = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
    {JOURNEY_STEPS.map(({ label, color }, i) => (
      <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div
            style={{
              width: 22,
              height: 22,
              borderRadius: '50%',
              background: '#f1f5f9',
              border: `2px solid ${color}`,
              color: color,
              fontSize: 10,
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            {i + 1}
          </div>
          {i < JOURNEY_STEPS.length - 1 && (
            <div style={{ width: 2, height: 14, background: '#e2e8f0', margin: '2px 0' }} />
          )}
        </div>
        <Text style={{ fontSize: 11, color: '#475569', paddingTop: 4, lineHeight: 1.4 }}>
          {label}
        </Text>
      </div>
    ))}
  </div>
);

// ─── Dispute reasons ──────────────────────────────────────────────────────────

const DISPUTE_REASONS = [
  'Tôi đã liên hệ và làm việc với ứng viên này trước thời điểm đối tác khác gửi hồ sơ.',
  'Tôi đã độc lập giới thiệu ứng viên này cho khách hàng kèm tài liệu/bằng chứng rõ ràng.',
  'Dữ liệu dấu thời gian có sự sai lệch — tôi đã nộp trước qua kênh khác.',
  'Ứng viên này do tôi tìm kiếm và kết nối từ trước trên nền tảng khác.',
  'Lý do khác — Tôi có bằng chứng xác thực cần bộ phận kiểm toán đối soát.',
];

// ─── ReferralForm Component ───────────────────────────────────────────────────

export interface ReferralFormProps {
  initialJobId?: string;
  onSuccess?: () => void;
  isModal?: boolean;
}

export const ReferralForm: React.FC<ReferralFormProps> = ({
  initialJobId,
  onSuccess,
  isModal = false,
}) => {
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { data: jobs, isLoading: jobsLoading } = useJobs();
  const { user } = useAuthStore();
  const { addApplication } = useApplicationStore();

  // Tab State: 'TALENT_POOL' | 'EXTERNAL_UPLOAD'
  const [activeTab, setActiveTab] = useState<'TALENT_POOL' | 'EXTERNAL_UPLOAD'>('TALENT_POOL');

  // Talent Pool Candidates
  const talentPoolList = useMemo(() => loadTalentPoolCandidates(), []);
  const [selectedTalentCandidate, setSelectedTalentCandidate] = useState<TalentPoolCandidate | null>(null);

  // Core check state
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [selectedJobId, setSelectedJobId] = useState(initialJobId || searchParams.get('jobId') || '');
  const [checkEnabled, setCheckEnabled] = useState(false);

  // Per-field visual states
  const [emailState, setEmailState] = useState<FieldCheckState>('idle');
  const [phoneState, setPhoneState] = useState<FieldCheckState>('idle');

  // Form lifecycle
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const submissionTimestampRef = useRef(new Date().toISOString());

  // Dispute modal
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [disputeReason, setDisputeReason] = useState('');
  const [disputeDetails, setDisputeDetails] = useState('');
  const [disputeSubmitting, setDisputeSubmitting] = useState(false);

  // Prepopulate jobId if available
  useEffect(() => {
    const paramJobId = initialJobId || searchParams.get('jobId');
    if (paramJobId) {
      setSelectedJobId(paramJobId);
      form.setFieldValue('jobId', paramJobId);
    }
  }, [initialJobId, searchParams, form]);

  const {
    data: duplicateResult,
    isLoading: checkingDuplicate,
    isFetching,
  } = useDuplicateCheck(email, phone, selectedJobId, checkEnabled);

  const isDuplicate = !!duplicateResult;
  const isChecking = checkingDuplicate || isFetching;

  // Sync per-field visual states with query lifecycle
  useEffect(() => {
    if (!checkEnabled) return;
    if (isChecking) {
      if (email) setEmailState('checking');
      if (phone) setPhoneState('checking');
    } else {
      if (email) setEmailState(isDuplicate ? 'blocked' : 'clear');
      if (phone) setPhoneState(isDuplicate ? 'blocked' : 'clear');
    }
  }, [isChecking, isDuplicate, checkEnabled, email, phone]);

  const triggerCheck = useCallback(
    (e: string, p: string, j: string) => {
      if (e && p && j) {
        setCheckEnabled(false);
        setTimeout(() => setCheckEnabled(true), 0);
      }
    },
    []
  );

  const handleEmailBlur = useCallback(() => {
    const raw = String(form.getFieldValue('email') ?? '');
    if (!raw) return;
    const normalized = normalizeEmail(raw);
    form.setFieldValue('email', normalized);
    setEmail(normalized);
    setEmailState('checking');
    triggerCheck(normalized, phone, selectedJobId);
  }, [form, phone, selectedJobId, triggerCheck]);

  const handlePhoneBlur = useCallback(() => {
    const raw = String(form.getFieldValue('phone') ?? '');
    if (!raw) return;
    const normalized = normalizePhone(raw);
    form.setFieldValue('phone', normalized);
    setPhone(normalized);
    setPhoneState('checking');
    triggerCheck(email, normalized, selectedJobId);
  }, [form, email, selectedJobId, triggerCheck]);

  const handleJobChange = useCallback(
    (jobId: string) => {
      setSelectedJobId(jobId);
      if (email && phone) triggerCheck(email, phone, jobId);
    },
    [email, phone, triggerCheck]
  );

  // Handle selecting candidate from Talent Pool
  const handleSelectTalentCandidate = useCallback(
    (candidateId: string) => {
      const cand = talentPoolList.find((c) => c.id === candidateId);
      if (!cand) return;
      setSelectedTalentCandidate(cand);

      const normalizedE = normalizeEmail(cand.email);
      const normalizedP = normalizePhone(cand.phone);

      form.setFieldsValue({
        name: cand.name,
        email: normalizedE,
        phone: normalizedP,
        currentTitle: cand.currentTitle || '',
        currentCompany: cand.currentCompany || '',
        expectedSalary: cand.expectedSalary || '',
      });

      setEmail(normalizedE);
      setPhone(normalizedP);
      setEmailState('checking');
      setPhoneState('checking');

      if (selectedJobId) {
        triggerCheck(normalizedE, normalizedP, selectedJobId);
      }
    },
    [talentPoolList, form, selectedJobId, triggerCheck]
  );

  const handleTabChange = (key: string) => {
    const newTab = key as 'TALENT_POOL' | 'EXTERNAL_UPLOAD';
    setActiveTab(newTab);
    if (newTab === 'EXTERNAL_UPLOAD') {
      setSelectedTalentCandidate(null);
      form.resetFields(['talentCandidateId', 'name', 'email', 'phone', 'currentTitle', 'currentCompany', 'expectedSalary', 'linkedIn', 'noticePeriod', 'cv']);
      setEmail('');
      setPhone('');
      setEmailState('idle');
      setPhoneState('idle');
      setFileList([]);
    }
  };

  const handleSubmit = async () => {
    if (isDuplicate || isChecking) return;
    try {
      await form.validateFields();
      setSubmitting(true);
      submissionTimestampRef.current = new Date().toISOString();
      await new Promise((r) => setTimeout(r, 350));

      const values = form.getFieldsValue();
      const selectedJob = jobs?.find((j) => j.id === selectedJobId);
      const candidateEmail = normalizeEmail(values.email);

      if (selectedJob && candidateEmail) {
        const candidateName = values.name || selectedTalentCandidate?.name || 'Ứng viên giới thiệu';
        const cvPath = activeTab === 'TALENT_POOL'
          ? (selectedTalentCandidate?.cvUrl || `/files/CV_${candidateName.replace(/\s+/g, '')}.pdf`)
          : (fileList[0]?.name ? `/files/${fileList[0].name}` : `/files/CV_${candidateName.replace(/\s+/g, '')}.pdf`);
        const cvFileName = activeTab === 'TALENT_POOL'
          ? (selectedTalentCandidate?.cvUrl ? selectedTalentCandidate.cvUrl.split('/').pop() : `CV_${candidateName}.pdf`)
          : (fileList[0]?.name || `CV_${candidateName}.pdf`);

        // Write directly to shared application store (localStorage: 'hrconnect_candidate_applications')
        addApplication({
          fullName: candidateName,
          email: candidateEmail,
          phone: values.phone,
          jobId: selectedJob.id,
          jobTitle: selectedJob.title,
          company: selectedJob.company,
          source: 'AFFILIATE',
          affiliateName: user?.name || user?.email || 'David Tran (CTV)',
          affiliateEmail: user?.email || 'affiliate@demo.com',
          firstSubmissionTimestamp: submissionTimestampRef.current,
          status: 'PENDING_HR_REVIEW',
          aiScore: Math.floor(Math.random() * 6) + 85,
          candidateId: selectedTalentCandidate?.id,
          cvUrl: cvPath,
          cvFileName: cvFileName,
          currentTitle: values.currentTitle,
          salaryExpectation: values.expectedSalary ? Number(values.expectedSalary) : undefined,
          notes: values.notes,
          candidateSourceType: activeTab,
        });

        message.success(`Đã gửi hồ sơ giới thiệu ứng viên "${candidateName}" thành công!`);
      }

      setSubmitting(false);
      setSubmitted(true);
      if (onSuccess) onSuccess();
    } catch {
      // inline validation errors shown
    }
  };

  const handleRaiseDispute = async () => {
    if (!disputeReason.trim()) {
      message.warning('Vui lòng chọn lý do trước khi gửi khiếu nại.');
      return;
    }
    setDisputeSubmitting(true);
    await new Promise((r) => setTimeout(r, 300));
    setDisputeSubmitting(false);
    setDisputeOpen(false);
    message.success({
      content: 'Khiếu nại đã được ghi nhận. Bộ phận kiểm toán OPR Hub sẽ phản hồi trong vòng 48 giờ làm việc.',
      duration: 5,
    });
  };

  const handleReset = () => {
    form.resetFields();
    setEmail('');
    setPhone('');
    setSelectedJobId(initialJobId || '');
    setCheckEnabled(false);
    setEmailState('idle');
    setPhoneState('idle');
    setSelectedTalentCandidate(null);
    setSubmitted(false);
    setFileList([]);
  };

  // ── Success screen ────────────────────────────────────────────────────────────
  if (submitted) {
    const job = jobs?.find((j) => j.id === selectedJobId);
    return (
      <div style={{ maxWidth: 640, margin: isModal ? '20px auto' : '40px auto' }}>
        <Result
          status="success"
          title="Gửi hồ sơ giới thiệu thành công! 🎉"
          subTitle={
            <div>
              <p style={{ fontSize: 14 }}>
                Hồ sơ ứng viên đã được hệ thống tiếp nhận và khóa <strong>Dấu thời gian nộp đầu tiên (First-Submission Timestamp)</strong> để bảo vệ bản quyền giới thiệu của bạn.
              </p>
              <Space direction="vertical" size={8} style={{ width: '100%', marginTop: 8 }}>
                <Tag icon={<ClockCircleOutlined />} color="blue" style={{ borderRadius: 6, padding: '4px 12px', fontSize: 13 }}>
                  Timestamp nộp: {new Date(submissionTimestampRef.current).toLocaleString('vi-VN')}
                </Tag>
                {job && (
                  <Tag color="geekblue" style={{ borderRadius: 6, padding: '4px 12px', fontSize: 13 }}>
                    Vị trí: <strong>{job.title}</strong> @ {job.company} — Hoa hồng <strong>{job.engagementTerms.commissionRate}%</strong>
                  </Tag>
                )}
                <Tag color="orange" style={{ borderRadius: 6, padding: '4px 12px', fontSize: 13 }}>
                  Trạng thái hiện tại: <strong>Chờ HR xem xét (PENDING_HR_REVIEW)</strong>
                </Tag>
              </Space>
            </div>
          }
          extra={[
            <Button
              type="primary"
              key="another"
              onClick={handleReset}
              size="large"
              style={{ borderRadius: 8, fontWeight: 600, background: '#0284c7' }}
            >
              Tiếp tục giới thiệu ứng viên khác
            </Button>,
            <Button
              key="submissions"
              onClick={() => navigate('/affiliate/submissions')}
              size="large"
              style={{ borderRadius: 8, fontWeight: 600 }}
            >
              Hồ sơ đã giới thiệu & Tiến độ
            </Button>,
            <Button
              key="commissions"
              onClick={() => navigate('/affiliate/commissions')}
              size="large"
              style={{ borderRadius: 8 }}
            >
              Sổ cái hoa hồng
            </Button>,
          ]}
        />
      </div>
    );
  }

  // ── Main layout ───────────────────────────────────────────────────────────────
  const submitDisabled = isDuplicate || isChecking || !selectedJobId || !email || !phone;

  return (
    <div>
      {!isModal && (
        <div style={{ marginBottom: 24 }}>
          <Title level={3} style={{ margin: 0, color: '#0f172a' }}>Gửi hồ sơ ứng viên giới thiệu</Title>
          <Text type="secondary" style={{ fontSize: 13 }}>
            Giới thiệu ứng viên tiềm năng cho vị trí đang tuyển dụng. Bạn có thể chọn ứng viên sẵn có trong Kho dữ liệu hệ thống (Talent Pool) hoặc tải lên CV ứng viên bên ngoài.
          </Text>
        </div>
      )}

      <Row gutter={[24, 24]}>
        {/* Main Form */}
        <Col xs={24} lg={isModal ? 24 : 16}>
          <Card
            style={{
              borderRadius: 16,
              border: isDuplicate ? '2px solid #fecaca' : '1px solid #e2e8f0',
              transition: 'border-color 0.3s ease',
            }}
          >
            <Form form={form} layout="vertical" requiredMark="optional">
              {/* Job Selector */}
              <Form.Item
                label={<span style={{ fontWeight: 700 }}>Vị trí tuyển dụng ứng tuyển <span style={{ color: '#ef4444' }}>*</span></span>}
                name="jobId"
                rules={[{ required: true, message: 'Vui lòng chọn vị trí tuyển dụng.' }]}
              >
                <Select
                  showSearch
                  loading={jobsLoading}
                  placeholder="Chọn vị trí tuyển dụng để giới thiệu ứng viên này..."
                  onChange={handleJobChange}
                  size="large"
                  filterOption={(input, option) =>
                    String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                  }
                  options={jobs
                    ?.filter((j) => j.serviceType !== 'CV_APPLICATION')
                    .map((j) => ({
                      value: j.id,
                      label: `${j.title} — ${j.company}`,
                      description: `${j.serviceType} | Hoa hồng ${j.engagementTerms.commissionRate}%`,
                    }))}
                  optionRender={(opt) => (
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{String(opt.label)}</div>
                      <div style={{ fontSize: 11, color: '#64748b' }}>{String(opt.data.description)}</div>
                    </div>
                  )}
                />
              </Form.Item>

              <Divider style={{ margin: '8px 0 16px' }} />

              {/* ─── 2 TABS NGUỒN ỨNG VIÊN (REQUIREMENT 1) ─────────────────────────── */}
              <div style={{ marginBottom: 16 }}>
                <Text strong style={{ fontSize: 14, color: '#0f172a', display: 'block', marginBottom: 8 }}>
                  Nguồn hồ sơ ứng viên <span style={{ color: '#ef4444' }}>*</span>
                </Text>
                <Tabs
                  activeKey={activeTab}
                  onChange={handleTabChange}
                  type="card"
                  items={[
                    {
                      key: 'TALENT_POOL',
                      label: (
                        <Space>
                          <TeamOutlined style={{ color: '#0284c7' }} />
                          <span style={{ fontWeight: 600 }}>1. Chọn từ Kho ứng viên hệ thống (Talent Pool)</span>
                        </Space>
                      ),
                    },
                    {
                      key: 'EXTERNAL_UPLOAD',
                      label: (
                        <Space>
                          <UploadOutlined style={{ color: '#10b981' }} />
                          <span style={{ fontWeight: 600 }}>2. Thêm ứng viên bên ngoài (Upload CV ngoài)</span>
                        </Space>
                      ),
                    },
                  ]}
                />
              </div>

              {/* ─── TAB 1: TALENT POOL DROPDOWN & AUTOFILL ──────────────────────── */}
              {activeTab === 'TALENT_POOL' && (
                <div style={{ background: '#f8fafc', padding: 16, borderRadius: 12, border: '1px solid #e2e8f0', marginBottom: 20 }}>
                  <Alert
                    type="info"
                    showIcon
                    message="Kho ứng viên hệ thống (Talent Pool)"
                    description="Chọn một ứng viên đã đăng ký trong hệ thống (từ hrconnect_users hoặc kho ứng viên). Hệ thống sẽ tự động điền Họ tên, Email, Số điện thoại và liên kết CV đã có."
                    style={{ marginBottom: 16, borderRadius: 8 }}
                  />

                  <Form.Item
                    label={<span style={{ fontWeight: 600 }}>Chọn ứng viên từ danh sách đăng ký <span style={{ color: '#ef4444' }}>*</span></span>}
                    name="talentCandidateId"
                    rules={[{ required: activeTab === 'TALENT_POOL', message: 'Vui lòng chọn một ứng viên.' }]}
                  >
                    <Select
                      showSearch
                      size="large"
                      placeholder="Tìm kiếm ứng viên theo Tên, Email, SĐT, Kỹ năng (VD: Nguyễn Văn B, ungvien5@gmail.com)..."
                      onChange={handleSelectTalentCandidate}
                      filterOption={(input, option) => {
                        const target = String(option?.filterStr ?? '').toLowerCase();
                        return target.includes(input.toLowerCase());
                      }}
                      options={talentPoolList.map((c) => ({
                        value: c.id,
                        filterStr: `${c.name} ${c.email} ${c.phone} ${c.currentTitle} ${(c.skills || []).join(' ')}`,
                        label: `${c.name} — ${c.email}`,
                        candidate: c,
                      }))}
                      optionRender={(opt) => {
                        const c = (opt.data as any).candidate as TalentPoolCandidate;
                        return (
                          <div style={{ padding: '4px 0' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontWeight: 600, fontSize: 13, color: '#0f172a' }}>{c.name}</span>
                              <Tag color={c.source === 'PLATFORM_USER' ? 'blue' : 'cyan'} style={{ fontSize: 10 }}>
                                {c.source === 'PLATFORM_USER' ? 'Đã đăng ký tài khoản' : 'Kho chung'}
                              </Tag>
                            </div>
                            <div style={{ fontSize: 12, color: '#0284c7' }}>{c.email} • {c.phone}</div>
                            <div style={{ fontSize: 11, color: '#64748b' }}>{c.currentTitle} @ {c.currentCompany}</div>
                            {c.skills && (
                              <div style={{ marginTop: 3 }}>
                                {c.skills.slice(0, 3).map((s) => (
                                  <Tag key={s} style={{ fontSize: 10, marginRight: 4 }}>{s}</Tag>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      }}
                    />
                  </Form.Item>

                  {/* Selected Candidate Preview Card */}
                  {selectedTalentCandidate && (
                    <Card
                      size="small"
                      style={{
                        borderRadius: 10,
                        border: '1px solid #bfdbfe',
                        background: '#eff6ff',
                        marginTop: 12,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                        <Avatar size={48} style={{ background: '#0284c7', fontWeight: 700, fontSize: 18 }}>
                          {selectedTalentCandidate.name.charAt(0)}
                        </Avatar>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontWeight: 700, fontSize: 15, color: '#0f172a' }}>
                              {selectedTalentCandidate.name}
                            </span>
                            <Tag color="success" icon={<CheckCircleFilled />}>
                              Hồ sơ đã đồng bộ
                            </Tag>
                          </div>
                          <div style={{ fontSize: 12, color: '#334155', marginTop: 2 }}>
                            <MailOutlined style={{ marginRight: 4 }} /> {selectedTalentCandidate.email}
                            <Divider type="vertical" />
                            <PhoneOutlined style={{ marginRight: 4 }} /> {selectedTalentCandidate.phone}
                          </div>
                          <div style={{ fontSize: 12, color: '#475569', marginTop: 4 }}>
                            <ApartmentOutlined style={{ marginRight: 4 }} />
                            Chức danh: <strong>{selectedTalentCandidate.currentTitle}</strong> ({selectedTalentCandidate.currentCompany})
                          </div>
                          <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <Tag icon={<FilePdfOutlined style={{ color: '#ef4444' }} />} color="default" style={{ padding: '3px 8px', borderRadius: 6, fontWeight: 500 }}>
                              {selectedTalentCandidate.cvUrl?.split('/').pop() || 'CV_NguyenVanB_Java.pdf'} (CV liên kết sẵn)
                            </Tag>
                            {selectedTalentCandidate.skills?.map((s) => (
                              <Tag key={s} color="blue" style={{ borderRadius: 6 }}>{s}</Tag>
                            ))}
                          </div>
                        </div>
                      </div>
                    </Card>
                  )}
                </div>
              )}

              {/* ─── CANDIDATE INFORMATION FIELDS ─────────────────────────────────── */}
              <div style={{ marginTop: 8 }}>
                <Title level={5} style={{ color: '#0f172a', marginBottom: 16 }}>
                  {activeTab === 'TALENT_POOL' ? 'Thông tin ứng viên (Tự động điền)' : 'Thông tin ứng viên ngoài'}
                </Title>

                <Row gutter={[16, 0]}>
                  <Col xs={24} sm={12}>
                    <Form.Item
                      label="Họ và tên ứng viên"
                      name="name"
                      rules={[{ required: true, message: 'Vui lòng nhập họ và tên ứng viên.' }, { min: 2 }]}
                    >
                      <Input
                        prefix={<UserOutlined style={{ color: '#94a3b8' }} />}
                        placeholder="Nguyễn Văn B"
                        size="large"
                        readOnly={activeTab === 'TALENT_POOL' && !!selectedTalentCandidate}
                      />
                    </Form.Item>
                  </Col>

                  <Col xs={24} sm={12}>
                    <Form.Item label="Chức danh hiện tại" name="currentTitle" rules={[{ required: true, message: 'Bắt buộc nhập.' }]}>
                      <Input
                        placeholder="Ví dụ: Kỹ sư Backend Java cấp cao"
                        size="large"
                        readOnly={activeTab === 'TALENT_POOL' && !!selectedTalentCandidate}
                      />
                    </Form.Item>
                  </Col>

                  {/* Email — onBlur duplicate check */}
                  <Col xs={24} sm={12}>
                    <Form.Item
                      label={
                        <Space size={4}>
                          <span>Địa chỉ Email</span>
                          <Tooltip title="Tự động chuẩn hóa chữ thường. Kiểm tra trùng lặp kích hoạt tức thì khi rời trường nhập.">
                            <InfoCircleOutlined style={{ color: '#94a3b8', fontSize: 12 }} />
                          </Tooltip>
                        </Space>
                      }
                      name="email"
                      rules={[
                        { required: true, message: 'Vui lòng nhập email.' },
                        { type: 'email', message: 'Email không đúng định dạng.' },
                      ]}
                    >
                      <Input
                        prefix={<MailOutlined style={{ color: '#94a3b8' }} />}
                        placeholder="ungvien5@gmail.com"
                        size="large"
                        onBlur={handleEmailBlur}
                        suffix={<FieldSuffix state={emailState} />}
                        style={{ borderColor: fieldBorderColor(emailState), transition: 'border-color 0.3s' }}
                        readOnly={activeTab === 'TALENT_POOL' && !!selectedTalentCandidate}
                      />
                    </Form.Item>
                  </Col>

                  {/* Phone — onBlur duplicate check */}
                  <Col xs={24} sm={12}>
                    <Form.Item
                      label={
                        <Space size={4}>
                          <span>Số điện thoại</span>
                          <Tooltip title="Tự động chuẩn hóa sang định dạng E.164 (+84...) khi rời trường nhập.">
                            <InfoCircleOutlined style={{ color: '#94a3b8', fontSize: 12 }} />
                          </Tooltip>
                        </Space>
                      }
                      name="phone"
                      rules={[{ required: true, message: 'Vui lòng nhập số điện thoại.' }]}
                    >
                      <Input
                        prefix={<PhoneOutlined style={{ color: '#94a3b8' }} />}
                        placeholder="0905 555 666"
                        size="large"
                        onBlur={handlePhoneBlur}
                        suffix={<FieldSuffix state={phoneState} />}
                        style={{ borderColor: fieldBorderColor(phoneState), transition: 'border-color 0.3s' }}
                        readOnly={activeTab === 'TALENT_POOL' && !!selectedTalentCandidate}
                      />
                    </Form.Item>
                  </Col>

                  <Col xs={24} sm={12}>
                    <Form.Item label="Công ty hiện tại" name="currentCompany">
                      <Input
                        placeholder="Ví dụ: Tập đoàn VNG"
                        size="large"
                        readOnly={activeTab === 'TALENT_POOL' && !!selectedTalentCandidate}
                      />
                    </Form.Item>
                  </Col>

                  <Col xs={24} sm={12}>
                    <Form.Item label="Mức lương kỳ vọng (VNĐ/tháng)" name="expectedSalary">
                      <Input prefix={<span style={{ color: '#94a3b8' }}>₫</span>} placeholder="Ví dụ: 38000000" size="large" type="number" />
                    </Form.Item>
                  </Col>

                  {activeTab === 'EXTERNAL_UPLOAD' && (
                    <>
                      <Col xs={24} sm={12}>
                        <Form.Item label="Hồ sơ LinkedIn" name="linkedIn">
                          <Input prefix={<LinkedinOutlined style={{ color: '#0a66c2' }} />} placeholder="https://linkedin.com/in/..." size="large" />
                        </Form.Item>
                      </Col>
                      <Col xs={24} sm={12}>
                        <Form.Item label="Thời gian có thể đi làm / Báo trước" name="noticePeriod">
                          <Select
                            placeholder="Chọn thời gian báo trước"
                            size="large"
                            options={[
                              { value: 'immediate', label: 'Có thể đi làm ngay' },
                              { value: '7d', label: 'Báo trước 7 ngày' },
                              { value: '14d', label: 'Báo trước 14 ngày' },
                              { value: '30d', label: 'Báo trước 30 ngày' },
                              { value: '45d', label: 'Báo trước 45 ngày' },
                              { value: '60d', label: 'Báo trước 60 ngày' },
                            ]}
                          />
                        </Form.Item>
                      </Col>
                    </>
                  )}
                </Row>
              </div>

              {/* Checking indicator */}
              {isChecking && (
                <Alert
                  type="info"
                  showIcon
                  icon={<LoadingOutlined spin />}
                  message={<span style={{ fontWeight: 600 }}>Đang kiểm tra trùng lặp hồ sơ trong hệ thống…</span>}
                  description="Đối soát email và số điện thoại với kho dữ liệu Dấu thời gian nộp đầu tiên."
                  style={{ marginBottom: 16, borderRadius: 10 }}
                />
              )}

              {/* BLOCKED banner */}
              {isDuplicate && duplicateResult && !isChecking && (
                <Alert
                  type="error"
                  showIcon
                  icon={<LockOutlined />}
                  message={<span style={{ fontWeight: 800, fontSize: 14, color: '#991b1b' }}>🚫 Hồ sơ đã tồn tại cho công việc này (Bị chặn trùng lặp)</span>}
                  description={
                    <div>
                      <Paragraph style={{ marginBottom: 8, color: '#7f1d1d', fontSize: 13 }}>
                        Ứng viên này <strong>đã được nộp trước đó</strong> bởi đối tác{' '}
                        <strong>{duplicateResult.originalAffiliateName}</strong> cho vị trí này vào lúc{' '}
                        <strong>{new Date(duplicateResult.originalTimestamp).toLocaleString('vi-VN')}</strong>.
                      </Paragraph>
                      <Paragraph style={{ marginBottom: 12, fontSize: 12, color: '#9f1239' }}>
                        Theo <strong>Chính sách Nộp hồ sơ đầu tiên (First-Submission Policy)</strong>, đối tác nộp trước giữ
                        trọn quyền nhận hoa hồng. Hồ sơ của bạn không thể tiếp nhận lại.
                      </Paragraph>
                      <Space wrap>
                        <Tag icon={<ClockCircleOutlined />} color="error" style={{ borderRadius: 6, padding: '3px 10px', fontSize: 11 }}>
                          Thời điểm nộp đầu: {new Date(duplicateResult.originalTimestamp).toLocaleString('vi-VN')}
                        </Tag>
                        <Tag color="default" style={{ borderRadius: 6, padding: '3px 10px', fontSize: 11 }}>
                          Trạng thái: {duplicateResult.status}
                        </Tag>
                        <Button danger size="small" icon={<WarningOutlined />} onClick={() => setDisputeOpen(true)} style={{ borderRadius: 6, fontWeight: 600 }}>
                          Tạo khiếu nại tranh chấp
                        </Button>
                      </Space>
                    </div>
                  }
                  style={{ marginBottom: 20, borderRadius: 12, border: '2px solid #fecaca' }}
                />
              )}

              {/* CLEAR banner */}
              {!isDuplicate && !isChecking && email && phone && selectedJobId && (
                <Alert
                  type="success"
                  showIcon
                  icon={<CheckCircleOutlined />}
                  message={<span style={{ fontWeight: 600 }}>✓ Không phát hiện trùng lặp — Hồ sơ hợp lệ, sẵn sàng gửi giới thiệu</span>}
                  style={{ marginBottom: 16, borderRadius: 10, border: '1px solid #bbf7d0' }}
                />
              )}

              {/* CV Upload for External Tab */}
              {activeTab === 'EXTERNAL_UPLOAD' && (
                <Form.Item label="Hồ sơ đính kèm (CV / Resume)" name="cv" style={{ marginTop: 4 }}>
                  <Dragger
                    fileList={fileList}
                    onChange={({ fileList: fl }) => setFileList(fl)}
                    beforeUpload={() => false}
                    accept=".pdf,.doc,.docx"
                    maxCount={1}
                    style={{ borderRadius: 10 }}
                  >
                    <p className="ant-upload-drag-icon">
                      <UploadOutlined style={{ color: '#0284c7', fontSize: 32 }} />
                    </p>
                    <p style={{ fontWeight: 600, color: '#0f172a', marginBottom: 4 }}>Kéo thả CV vào đây hoặc bấm để chọn tệp tải lên</p>
                    <p style={{ color: '#94a3b8', fontSize: 12 }}>Hỗ trợ PDF, DOC, DOCX · Tối đa 10 MB</p>
                  </Dragger>
                </Form.Item>
              )}

              {/* Recruiter Notes */}
              <Form.Item label="Ghi chú của người giới thiệu (Affiliate Notes)" name="notes">
                <TextArea
                  placeholder="Thông tin bổ sung: lý do ứng viên này phù hợp, điểm mạnh nổi bật hoặc lưu ý dành cho bộ phận tuyển dụng..."
                  rows={3}
                  style={{ borderRadius: 8 }}
                  maxLength={1000}
                  showCount
                />
              </Form.Item>

              {/* Submit Button */}
              <Form.Item style={{ marginBottom: 0 }}>
                <Button
                  type="primary"
                  size="large"
                  onClick={handleSubmit}
                  loading={submitting}
                  disabled={submitDisabled}
                  block
                  icon={isDuplicate ? <LockOutlined /> : isChecking ? <LoadingOutlined /> : <SendOutlined />}
                  style={{
                    height: 48,
                    borderRadius: 10,
                    fontWeight: 700,
                    fontSize: 15,
                    background: submitDisabled ? '#94a3b8' : 'linear-gradient(135deg, #0284c7, #0369a1)',
                    border: 'none',
                    transition: 'all 0.3s',
                  }}
                >
                  {isDuplicate
                    ? '🚫 Không thể gửi — Hồ sơ đã tồn tại cho công việc này (Bị chặn trùng lặp)'
                    : isChecking
                    ? 'Đang đối soát — vui lòng chờ trong giây lát…'
                    : '✓ Gửi hồ sơ giới thiệu ứng viên'}
                </Button>
                {!isDuplicate && !isChecking && email && (
                  <div style={{ textAlign: 'center', marginTop: 10 }}>
                    <Tag icon={<ClockCircleOutlined />} color="blue" style={{ fontSize: 11, borderRadius: 6 }}>
                      Dấu thời gian nộp hồ sơ đầu tiên sẽ được ghi nhận: {new Date().toLocaleString('vi-VN')}
                    </Tag>
                  </div>
                )}
              </Form.Item>
            </Form>
          </Card>
        </Col>

        {/* Sidebar Info (when not in modal) */}
        {!isModal && (
          <Col xs={24} lg={8}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, position: 'sticky', top: 80 }}>
              <Card size="small" style={{ borderRadius: 12, borderColor: '#bae6fd' }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: '#0f172a', marginBottom: 8 }}>
                  <InfoCircleOutlined style={{ color: '#0284c7', marginRight: 6 }} />
                  Chính sách nộp hồ sơ đầu tiên
                </div>
                <Text type="secondary" style={{ fontSize: 12, lineHeight: 1.6 }}>
                  HR Connect áp dụng cơ chế lưu vết kiểm toán <strong>Dấu thời gian nộp đầu tiên (First-Submission Timestamp)</strong>.
                  Đối tác tuyển dụng đầu tiên nộp hồ sơ cho một vị trí cụ thể sẽ giữ trọn
                  quyền thụ hưởng hoa hồng, bất kể hồ sơ được nộp lại sau đó.
                </Text>
              </Card>

              <Card size="small" style={{ borderRadius: 12, borderColor: '#d1fae5' }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: '#0f172a', marginBottom: 10 }}>
                  ⚡ Kiểm tra trùng lặp thời gian thực
                </div>
                <Text type="secondary" style={{ fontSize: 12, lineHeight: 1.6, display: 'block', marginBottom: 10 }}>
                  Hệ thống tự động đối soát email và số điện thoại của ứng viên với toàn bộ kho nộp trước đó trong vòng 500ms.
                </Text>
                {([
                  { label: 'Chưa kiểm tra', color: '#94a3b8' },
                  { label: 'Đang đối soát hệ thống…', color: '#0284c7' },
                  { label: 'HỢP LỆ — Sẵn sàng gửi hồ sơ', color: '#10b981' },
                  { label: 'TRÙNG LẶP — Hồ sơ bị chặn', color: '#ef4444' },
                ] as const).map(({ label, color }) => (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
                    <Text style={{ fontSize: 11, color: '#475569' }}>{label}</Text>
                  </div>
                ))}
              </Card>

              <Card size="small" style={{ borderRadius: 12 }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: '#0f172a', marginBottom: 12 }}>
                  💰 Lộ trình nhận hoa hồng Tuyển dụng trọn gói (COD)
                </div>
                <CommissionJourney />
              </Card>
            </div>
          </Col>
        )}
      </Row>

      {/* Dispute Modal */}
      <Modal
        open={disputeOpen}
        onCancel={() => { setDisputeOpen(false); setDisputeReason(''); setDisputeDetails(''); }}
        title={
          <Space>
            <WarningOutlined style={{ color: '#f59e0b' }} />
            <span style={{ fontWeight: 700 }}>Tạo khiếu nại tranh chấp Attribution</span>
          </Space>
        }
        onOk={handleRaiseDispute}
        okText="Gửi khiếu nại"
        cancelText="Hủy bỏ"
        okButtonProps={{ danger: true, loading: disputeSubmitting, size: 'large' }}
        cancelButtonProps={{ size: 'large' }}
        width={520}
      >
        <Alert
          type="warning"
          showIcon
          message="Quy trình xem xét khiếu nại"
          description={
            <span style={{ fontSize: 12 }}>
              Các khiếu nại được xử lý trong vòng <strong>48 giờ làm việc</strong>. Bộ phận kiểm toán
              sẽ đối soát dấu thời gian, thư xác nhận từ ứng viên và lịch sử hệ thống. Các khiếu nại không căn cứ
              có thể làm giảm <strong>Điểm tin cậy (Trust Rating)</strong> của bạn.
            </span>
          }
          style={{ marginBottom: 16, borderRadius: 8 }}
        />
        <Form layout="vertical">
          <Form.Item
            label={
              <span style={{ fontWeight: 600, fontSize: 13 }}>
                Lý do chính khiếu nại <span style={{ color: '#ef4444' }}>*</span>
              </span>
            }
          >
            <Select
              style={{ width: '100%' }}
              placeholder="Chọn lý do chính cho khiếu nại này..."
              size="large"
              value={disputeReason || undefined}
              onChange={(v: string) => setDisputeReason(v)}
              options={DISPUTE_REASONS.map((r) => ({ value: r, label: r }))}
              optionRender={(opt) => (
                <div style={{ whiteSpace: 'normal', lineHeight: 1.45, fontSize: 12, padding: '2px 0' }}>
                  {String(opt.label)}
                </div>
              )}
            />
          </Form.Item>
          <Form.Item
            label={
              <span style={{ fontWeight: 600, fontSize: 13 }}>
                Tài liệu / Bằng chứng đối soát
                <span style={{ color: '#94a3b8', fontWeight: 400, fontSize: 11, marginLeft: 6 }}>(không bắt buộc nhưng khuyến nghị)</span>
              </span>
            }
          >
            <TextArea
              value={disputeDetails}
              onChange={(e) => setDisputeDetails(e.target.value)}
              placeholder="Ghi rõ ngày liên hệ ứng viên, đường dẫn mạng xã hội/portfolio, bản sao thỏa thuận hoặc bất kỳ chứng cứ hợp lệ nào khác..."
              rows={5}
              style={{ borderRadius: 8 }}
              maxLength={2000}
              showCount
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ReferralForm;

