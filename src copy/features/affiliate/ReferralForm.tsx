/**
 * @file ReferralForm.tsx
 * @description Screen 2 — Affiliate Candidate Referral Submission (MF-03).
 *
 * Key behaviours:
 *  1. Job selector filtered to HEADHUNT_COD + CV_SOURCING only (no CV_APPLICATION)
 *  2. onBlur duplicate check on email AND phone independently:
 *       IDLE | CHECKING | CLEAR | BLOCKED per-field visual state
 *  3. BLOCKED state: animated error banner with original affiliate name,
 *     first-submission timestamp, First-Submission Policy, Raise Dispute CTA
 *  4. Dispute Modal: mandatory primary reason <Select> + optional evidence <TextArea>
 *  5. CLEAR state: green confirmation banner before submit
 *  6. Submit button disabled while BLOCKED or CHECKING
 *  7. Success screen: recorded timestamp + job details + CTAs
 *
 * Domain types used: DuplicateSubmission from domain.ts
 */
import React, { useState, useCallback, useRef } from 'react';
import {
  Form, Input, Button, Select, Upload, Alert, Card, Row, Col,
  Typography, Space, Tag, Divider, message, Modal, Spin, Result, Tooltip,
} from 'antd';
import {
  UserOutlined, MailOutlined, PhoneOutlined, LinkedinOutlined,
  UploadOutlined, ClockCircleOutlined, ExclamationCircleOutlined,
  CheckCircleOutlined, WarningOutlined, InfoCircleOutlined,
  LoadingOutlined, LockOutlined, SendOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useJobs } from '@/services/queries/useJobs';
import { useDuplicateCheck } from '@/services/queries/useCandidates';
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

// ─── ReferralForm ──────────────────────────────────────────────────────────────

export const ReferralForm: React.FC = () => {
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const { data: jobs, isLoading: jobsLoading } = useJobs();

  // Core check state
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [selectedJobId, setSelectedJobId] = useState('');
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

  const {
    data: duplicateResult,
    isLoading: checkingDuplicate,
    isFetching,
  } = useDuplicateCheck(email, phone, selectedJobId, checkEnabled);

  const isDuplicate = !!duplicateResult;
  const isChecking = checkingDuplicate || isFetching;

  // Sync per-field visual states with query lifecycle
  React.useEffect(() => {
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

  const handleSubmit = async () => {
    if (isDuplicate || isChecking) return;
    try {
      await form.validateFields();
      setSubmitting(true);
      submissionTimestampRef.current = new Date().toISOString();
      await new Promise((r) => setTimeout(r, 300));
      setSubmitting(false);
      setSubmitted(true);
    } catch {
      // inline errors shown
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
      content: 'Khiếu nại đã được ghi nhận. Bộ phận kiểm toán sẽ phản hồi trong vòng 48 giờ làm việc.',
      duration: 5,
    });
  };

  const handleReset = () => {
    form.resetFields();
    setEmail(''); setPhone(''); setSelectedJobId('');
    setCheckEnabled(false);
    setEmailState('idle'); setPhoneState('idle');
    setSubmitted(false); setFileList([]);
  };

  // ── Success screen ────────────────────────────────────────────────────────────
  if (submitted) {
    const job = jobs?.find((j) => j.id === selectedJobId);
    return (
      <div style={{ maxWidth: 600, margin: '60px auto' }}>
        <Result
          status="success"
          title="Gửi hồ sơ giới thiệu thành công! 🎉"
          subTitle={
            <div>
              <p>Hồ sơ ứng viên của bạn đã được đăng ký kèm Dấu thời gian nộp đầu tiên (First-Submission Timestamp) đã xác thực.</p>
              <Space direction="vertical" size={8} style={{ width: '100%', marginTop: 8 }}>
                <Tag icon={<ClockCircleOutlined />} color="blue" style={{ borderRadius: 6, padding: '4px 10px' }}>
                  Dấu thời gian: {new Date(submissionTimestampRef.current).toLocaleString('vi-VN')}
                </Tag>
                {job && (
                  <Tag color="geekblue" style={{ borderRadius: 6, padding: '4px 10px' }}>
                    {job.title} @ {job.company} — Mức hoa hồng {job.engagementTerms.commissionRate}%
                  </Tag>
                )}
              </Space>
            </div>
          }
          extra={[
            <Button type="primary" key="another" onClick={handleReset} size="large">Tiếp tục giới thiệu ứng viên</Button>,
            <Button key="ledger" onClick={() => navigate('/affiliate/ledger')} size="large">Xem bảng hoa hồng</Button>,
          ]}
        />
      </div>
    );
  }

  // ── Main layout ───────────────────────────────────────────────────────────────
  const submitDisabled = isDuplicate || isChecking;

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <Title level={3} style={{ margin: 0, color: '#0f172a' }}>Gửi hồ sơ ứng viên giới thiệu</Title>
        <Text type="secondary" style={{ fontSize: 13 }}>
          Giới thiệu ứng viên tiềm năng cho vị trí đang tuyển dụng. Cơ chế phát hiện trùng lặp thời gian thực bảo vệ tối đa quyền lợi hoa hồng của bạn.
        </Text>
      </div>

      <Row gutter={[24, 24]}>
        {/* Main Form */}
        <Col xs={24} lg={16}>
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

              <Divider style={{ margin: '4px 0 20px' }} />
              <Title level={5} style={{ color: '#0f172a', marginBottom: 16 }}>Thông tin ứng viên</Title>

              <Row gutter={[16, 0]}>
                <Col xs={24} sm={12}>
                  <Form.Item label="Họ và tên" name="name"
                    rules={[{ required: true, message: 'Vui lòng nhập họ và tên ứng viên.' }, { min: 2 }]}>
                    <Input prefix={<UserOutlined style={{ color: '#94a3b8' }} />} placeholder="Nguyễn Văn A" size="large" />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item label="Chức danh hiện tại" name="currentTitle" rules={[{ required: true, message: 'Bắt buộc nhập.' }]}>
                    <Input placeholder="Ví dụ: Kỹ sư Backend Java cấp cao" size="large" />
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
                      placeholder="ungvien@email.com"
                      size="large"
                      onBlur={handleEmailBlur}
                      suffix={<FieldSuffix state={emailState} />}
                      style={{ borderColor: fieldBorderColor(emailState), transition: 'border-color 0.3s' }}
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
                      placeholder="0901 234 567"
                      size="large"
                      onBlur={handlePhoneBlur}
                      suffix={<FieldSuffix state={phoneState} />}
                      style={{ borderColor: fieldBorderColor(phoneState), transition: 'border-color 0.3s' }}
                    />
                  </Form.Item>
                </Col>

                <Col xs={24} sm={12}>
                  <Form.Item label="Hồ sơ LinkedIn" name="linkedIn">
                    <Input prefix={<LinkedinOutlined style={{ color: '#0a66c2' }} />} placeholder="https://linkedin.com/in/..." size="large" />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item label="Công ty hiện tại" name="currentCompany">
                    <Input placeholder="Ví dụ: Tập đoàn VNG" size="large" />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item label="Mức lương kỳ vọng (VNĐ/tháng)" name="expectedSalary">
                    <Input prefix={<span style={{ color: '#94a3b8' }}>₫</span>} placeholder="Ví dụ: 45000000" size="large" type="number" />
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
              </Row>

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
                  message={<span style={{ fontWeight: 600 }}>✓ Không phát hiện trùng lặp — Hồ sơ hợp lệ, sẵn sàng gửi duyệt</span>}
                  style={{ marginBottom: 16, borderRadius: 10, border: '1px solid #bbf7d0' }}
                />
              )}

              {/* CV Upload */}
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

              {/* Recruiter Notes */}
              <Form.Item label="Ghi chú của người giới thiệu" name="notes">
                <TextArea
                  placeholder="Thông tin bổ sung: lý do ứng viên này phù hợp, lịch sử phỏng vấn trước đây hoặc lưu ý dành cho bộ phận tuyển dụng..."
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

        {/* Sidebar */}
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
                Nhập <strong>email</strong> và <strong>số điện thoại</strong> của ứng viên,
                sau đó nhấp ra ngoài. Hệ thống sẽ tự động đối soát trong vòng 500ms.
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
      </Row>

      {/* Dispute Modal */}
      <Modal
        open={disputeOpen}
        onCancel={() => { setDisputeOpen(false); setDisputeReason(''); setDisputeDetails(''); }}
        title={
          <Space>
            <WarningOutlined style={{ color: '#f59e0b' }} />
            <span style={{ fontWeight: 700 }}>Tạo khiếu nại tranh chấp</span>
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
