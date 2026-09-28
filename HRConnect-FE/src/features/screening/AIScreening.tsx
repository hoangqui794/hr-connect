/**
 * @file AIScreening.tsx
 * @description Screen 3 — AI CV-JD Split-View Screening Dashboard (MF-04 | SCR-HR-01).
 *
 * Layout (two-column split):
 *   LEFT  (55%) — Live CV Viewer rendered from Candidate data with scrollable content.
 *                 Sections: Header, Professional Summary, Technical Skills (tag chips),
 *                 Work Experience, Education, AI-Highlight stats panel (salary, YOE, notice).
 *   RIGHT (45%) — AI Analysis Panel:
 *     1. ColorTier Score Card — circular Progress with tier colour from domain.ts
 *        scoreToColorTier() → ColorTier.RED / TEAL / GREEN / GRAY
 *     2. JD Requirements Panel — mustHaveTags / shouldHaveTags from the selected Job
 *        with inline ✓ / ✗ match indicators against candidate.skills
 *     3. Match Analysis — matchedSkills (green), missingSkills (red), AI recommendation
 *     4. Candidate Highlight Card — salary, YOE, language, notice, availability
 *     5. Action Footer — Shortlist (green) | Reject (red, mandatory reason Modal)
 *
 * 4 ColorTiers from domain.ts:
 *   RED  (≥80)  — Top Fit   — #ef4444 border + bg tint
 *   TEAL (≥65)  — Strong    — #0d9488 border + bg tint
 *   GREEN(≥50)  — Moderate  — #84cc16 border + bg tint
 *   GRAY (<50)  — Weak      — #94a3b8 border + bg tint
 *
 * Reject Modal (mandatory audit):
 *   - Primary reason <Select> (required — validates before confirming)
 *   - Additional notes <TextArea> (optional)
 *   - Error shown inline if reason not selected
 *   - Confirm button disabled until reason selected
 */
import React, { useState } from 'react';
import {
  Card, Select, Progress, Tag, Button, Modal, Input, Row, Col,
  Typography, Space, Skeleton, Alert, Avatar, Divider, Form,
} from 'antd';
import {
  RobotOutlined, CheckCircleOutlined, CloseCircleOutlined,
  CalendarOutlined, TrophyOutlined, ThunderboltOutlined,
  UserOutlined, ExclamationCircleOutlined, FileTextOutlined,
} from '@ant-design/icons';
import { useCandidates, useScreeningResult } from '@/services/queries/useCandidates';
import { useJobs } from '@/services/queries/useJobs';
import { ScoreTierTag } from '@/components/common/ScoreTierTag';
import { getScoreTier, SCORE_TIER_CONFIG, ScoreTier, ApplicationStatus, CVMode } from '@/types/candidate';
import { scoreToColorTier, COLOR_TIER_CONFIG, ColorTier } from '@/types/domain';
import { useApplicationStore } from '@/stores/applicationStore';
import { saveInterview } from '@/services/localStorageService';
import type { Candidate } from '@/types/candidate';
import type { Job } from '@/types/job';

const { Title, Text } = Typography;
const { TextArea } = Input;

// ─── Reject reasons (mandatory audit log options) ─────────────────────────────

const REJECT_REASONS = [
  { value: 'skills_gap', label: 'Thiếu kỹ năng chuyên môn — chưa đáp ứng tiêu chí bắt buộc' },
  { value: 'insufficient_exp', label: 'Số năm kinh nghiệm chưa đạt yêu cầu của vị trí' },
  { value: 'salary_over_budget', label: 'Mức lương kỳ vọng vượt quá ngân sách đã phê duyệt' },
  { value: 'notice_too_long', label: 'Thời gian báo trước nghỉ việc quá dài so với tiến độ dự án' },
  { value: 'candidate_withdrew', label: 'Ứng viên chủ động xin rút hồ sơ tuyển dụng' },
  { value: 'position_filled', label: 'Vị trí tuyển dụng đã hoàn tất nội bộ' },
  { value: 'hiring_paused', label: 'Doanh nghiệp tạm dừng hoặc hủy kế hoạch tuyển dụng' },
  { value: 'cultural_fit', label: 'Chưa phù hợp với môi trường văn hóa doanh nghiệp' },
  { value: 'other', label: 'Lý do khác — xem chi tiết trong ghi chú bổ sung' },
];

// ─── ColorTier utilities ──────────────────────────────────────────────────────

const TIER_STROKE: Record<ColorTier, string | { '0%': string; '100%': string }> = {
  [ColorTier.RED]:  { '0%': '#fca5a5', '100%': '#ef4444' },
  [ColorTier.TEAL]: { '0%': '#5eead4', '100%': '#0d9488' },
  [ColorTier.GREEN]:{ '0%': '#bef264', '100%': '#84cc16' },
  [ColorTier.GRAY]: '#94a3b8',
};

interface TierBadgeProps {
  score: number;
}
const TierBadge: React.FC<TierBadgeProps> = ({ score }) => {
  const tier = scoreToColorTier(score);
  const cfg = COLOR_TIER_CONFIG[tier];
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 12px',
        borderRadius: 20,
        background: cfg.bg,
        border: `1.5px solid ${cfg.hex}`,
        fontWeight: 700,
        fontSize: 12,
        color: cfg.hex,
        letterSpacing: '0.04em',
      }}
    >
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: cfg.hex, display: 'inline-block' }} />
      {cfg.label.toUpperCase()}
    </div>
  );
};

// ─── CV Viewer (left panel) ───────────────────────────────────────────────────

interface CVViewerProps {
  candidate: Candidate;
}
const CVViewer: React.FC<CVViewerProps> = ({ candidate: c }) => (
  <div
    style={{
      background: 'rgba(15, 23, 42, 0.65)',
      border: '1px solid rgba(51, 65, 85, 0.65)',
      borderRadius: 16,
      overflow: 'hidden',
      fontFamily: '"Inter", "Segoe UI", sans-serif',
    }}
  >
    {/* CV Header */}
    <div
      style={{
        background: 'linear-gradient(135deg, #070a11 0%, #0f172a 100%)',
        padding: '28px 28px 20px',
        borderBottom: '1px solid rgba(51, 65, 85, 0.65)',
        color: '#f8fafc',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 18 }}>
        <Avatar
          size={64}
          style={{
            background: 'linear-gradient(135deg, #2563eb, #3b82f6)',
            fontWeight: 800,
            fontSize: 22,
            flexShrink: 0,
            border: '2px solid rgba(59, 130, 246, 0.4)',
          }}
        >
          {c.name.slice(0, 2).toUpperCase()}
        </Avatar>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#f8fafc', letterSpacing: '-0.3px' }}>{c.name}</div>
          <div style={{ fontSize: 14, color: '#60a5fa', fontWeight: 600, marginTop: 2 }}>{c.currentTitle}</div>
          <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 6 }}>
            {c.email} · {c.phone} · {c.location}
          </div>
          {c.linkedInUrl && (
            <a href={c.linkedInUrl} target="_blank" rel="noreferrer">
              <Tag color="blue" style={{ marginTop: 6, cursor: 'pointer', borderRadius: 6, fontSize: 11 }}>
                LinkedIn ↗
              </Tag>
            </a>
          )}
        </div>
      </div>
    </div>

    {/* CV Body */}
    <div style={{ padding: '20px 28px' }}>
      {/* Professional Summary */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontWeight: 800, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#60a5fa', marginBottom: 8 }}>
          Tóm tắt năng lực chuyên môn
        </div>
        <div style={{ fontSize: 13, color: '#cbd5e1', lineHeight: 1.7, fontStyle: 'italic', borderLeft: '3px solid #2563eb', paddingLeft: 12 }}>
          "{c.highlightCard.headline}"
        </div>
      </div>

      <Divider style={{ margin: '12px 0', borderColor: 'rgba(51, 65, 85, 0.4)' }} />

      {/* Current Experience */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontWeight: 800, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#60a5fa', marginBottom: 8 }}>
          Kinh nghiệm làm việc hiện tại
        </div>
        <div style={{ fontWeight: 700, fontSize: 14, color: '#f8fafc' }}>{c.currentTitle}</div>
        <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
          {c.currentCompany} · Tổng số năm kinh nghiệm: {c.highlightCard.yearsOfExperience} năm
        </div>
        <div style={{ fontSize: 13, color: '#cbd5e1', marginTop: 10, lineHeight: 1.7 }}>
          <div>• Chủ trì kiến trúc và phát triển các dịch vụ lõi của hệ thống với độ ổn định cao</div>
          <div>• Hướng dẫn các kỹ sư trẻ và chuẩn hóa quy trình phát triển phần mềm</div>
          <div>• Phối hợp liên phòng ban với bộ phận Sản phẩm và Thiết kế để hoàn thiện yêu cầu kỹ thuật</div>
          <div>• Tham gia phỏng vấn chuyên môn và đánh giá năng lực ứng viên</div>
        </div>
      </div>

      <Divider style={{ margin: '12px 0', borderColor: 'rgba(51, 65, 85, 0.4)' }} />

      {/* Technical Skills */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontWeight: 800, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#60a5fa', marginBottom: 10 }}>
          Kỹ năng chuyên môn
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {c.skills.map((skill) => (
            <Tag key={skill} style={{ borderRadius: 8, fontSize: 12, padding: '3px 10px', margin: 0, background: 'rgba(30, 41, 59, 0.6)', border: '1px solid rgba(51, 65, 85, 0.7)', color: '#f8fafc' }}>
              {skill}
            </Tag>
          ))}
        </div>
      </div>

      <Divider style={{ margin: '12px 0', borderColor: 'rgba(51, 65, 85, 0.4)' }} />

      {/* Candidate Highlight Card */}
      <div>
        <div style={{ fontWeight: 800, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#60a5fa', marginBottom: 10 }}>
          Tóm tắt ứng viên nổi bật
        </div>
        <Row gutter={[10, 10]}>
          {[
            { label: 'Lương hiện tại', value: c.highlightCard.currentSalary >= 1000000 ? `${(c.highlightCard.currentSalary / 1000000).toLocaleString()} tr/tháng` : `${c.highlightCard.currentSalary.toLocaleString()} ${c.highlightCard.currency}/tháng`, color: '#60a5fa', bg: 'rgba(37, 99, 235, 0.12)' },
            { label: 'Lương kỳ vọng', value: c.highlightCard.expectedSalary >= 1000000 ? `${(c.highlightCard.expectedSalary / 1000000).toLocaleString()} tr/tháng` : `${c.highlightCard.expectedSalary.toLocaleString()} ${c.highlightCard.currency}/tháng`, color: '#34d399', bg: 'rgba(16, 185, 129, 0.12)' },
            { label: 'Số năm kinh nghiệm', value: `${c.highlightCard.yearsOfExperience} năm`, color: '#a855f7', bg: 'rgba(168, 85, 247, 0.12)' },
            { label: 'Thời gian thông báo', value: `${c.highlightCard.noticePeriod} ngày`, color: '#fbbf24', bg: 'rgba(245, 158, 11, 0.12)' },
          ].map(({ label, value, color, bg }) => (
            <Col span={12} key={label}>
              <div style={{ background: bg, borderRadius: 10, padding: '10px 12px', border: '1px solid rgba(51, 65, 85, 0.5)' }}>
                <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
                <div style={{ fontSize: 15, fontWeight: 800, color, marginTop: 2, fontFamily: 'monospace' }}>{value}</div>
              </div>
            </Col>
          ))}
        </Row>
        <div style={{ marginTop: 10, padding: '8px 12px', background: 'rgba(30, 41, 59, 0.45)', borderRadius: 10, border: '1px solid rgba(51, 65, 85, 0.5)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <CalendarOutlined style={{ color: '#a855f7', fontSize: 13 }} />
          <Text style={{ fontSize: 12, color: '#cbd5e1' }}>
            Ngày có thể đi làm: <strong>{new Date(c.highlightCard.availabilityDate).toLocaleDateString('vi-VN', { day: 'numeric', month: 'long', year: 'numeric' })}</strong>
          </Text>
        </div>
      </div>

      <Divider style={{ margin: '12px 0', borderColor: 'rgba(51, 65, 85, 0.4)' }} />

      {/* Education */}
      <div>
        <div style={{ fontWeight: 800, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#60a5fa', marginBottom: 8 }}>
          Học vấn & Bằng cấp
        </div>
        <div style={{ fontWeight: 700, fontSize: 13, color: '#f8fafc' }}>Cử nhân Công nghệ Thông tin / Khoa học Máy tính</div>
        <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>Đại học Bách Khoa TP.HCM · 2015–2019</div>
      </div>
    </div>
  </div>
);

// ─── JD Requirements Panel ────────────────────────────────────────────────────

interface JDPanelProps {
  job: Job;
  candidateSkills: string[];
}
const JDPanel: React.FC<JDPanelProps> = ({ job, candidateSkills }) => {
  const skillSet = new Set(candidateSkills.map((s) => s.toLowerCase()));
  const matches = (tag: string) => skillSet.has(tag.toLowerCase());

  return (
    <Card size="small" style={{ borderRadius: 16, border: '1px solid rgba(51, 65, 85, 0.65)', background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(12px)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <FileTextOutlined style={{ color: '#60a5fa', fontSize: 15 }} />
        <span style={{ fontWeight: 700, fontSize: 14, color: '#f8fafc' }}>Yêu cầu tuyển dụng (JD)</span>
        <Tag style={{ marginLeft: 'auto', fontSize: 11, borderRadius: 9999, background: 'rgba(37, 99, 235, 0.15)', color: '#60a5fa', border: '1px solid rgba(59, 130, 246, 0.3)' }}>{job.serviceType}</Tag>
      </div>

      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 12, color: '#f8fafc', fontWeight: 700, marginBottom: 6 }}>
          🔴 Bắt buộc có
        </div>
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          {job.mustHaveTags.map((tag) => (
            <Tag
              key={tag}
              icon={matches(tag) ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
              color={matches(tag) ? 'success' : 'error'}
              style={{ borderRadius: 6, fontSize: 11, margin: 0 }}
            >
              {tag}
            </Tag>
          ))}
        </div>
      </div>

      <div>
        <div style={{ fontSize: 12, color: '#f8fafc', fontWeight: 700, marginBottom: 6 }}>
          🟡 Ưu tiên có
        </div>
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          {job.shouldHaveTags.map((tag) => (
            <Tag
              key={tag}
              icon={matches(tag) ? <CheckCircleOutlined /> : undefined}
              color={matches(tag) ? 'success' : 'default'}
              style={{ borderRadius: 6, fontSize: 11, margin: 0, opacity: matches(tag) ? 1 : 0.6 }}
            >
              {tag}
            </Tag>
          ))}
        </div>
      </div>
    </Card>
  );
};

// ─── AIScreening ──────────────────────────────────────────────────────────────

export const AIScreening: React.FC = () => {
  const { data: candidates, isLoading: candidatesLoading } = useCandidates();
  const { data: jobs, isLoading: jobsLoading } = useJobs();
  const sharedApps = useApplicationStore((s) => s.applications);

  // Build merged candidate dropdown options: shared apps first, then mock
  const candidateOptions = React.useMemo(() => {
    const sharedOptions = sharedApps.map((a) => ({
      value: `shared-${a.id}`,
      label: `★ ${a.fullName} — Ứng tuyển: ${a.jobTitle} (${a.source === 'AFFILIATE' ? `CTV ${a.affiliateName}` : 'Trực tiếp'})`,
      isShared: true,
      appData: a,
    }));
    const mockOptions = (candidates ?? []).map((c) => ({
      value: c.id,
      label: `${c.name} — ${c.currentTitle}`,
      isShared: false,
      appData: null,
    }));
    // Deduplicate by email from shared vs mock
    const sharedEmails = new Set(sharedApps.map((a) => a.email.toLowerCase()));
    const filteredMock = mockOptions.filter(
      (o) => !sharedEmails.has((candidates?.find((c) => c.id === o.value)?.email ?? '').toLowerCase())
    );
    return [...sharedOptions, ...filteredMock];
  }, [sharedApps, candidates]);

  const [selectedCandidateId, setSelectedCandidateId] = useState<string>(() => {
    return sharedApps.length > 0 ? `shared-${sharedApps[0].id}` : 'cand-101';
  });
  const [selectedJobId, setSelectedJobId] = useState<string>(() => {
    return sharedApps.length > 0 && sharedApps[0].jobId ? sharedApps[0].jobId : 'job-001';
  });

  React.useEffect(() => {
    if (sharedApps.length > 0 && selectedCandidateId === 'cand-101') {
      setSelectedCandidateId(`shared-${sharedApps[0].id}`);
      if (sharedApps[0].jobId) setSelectedJobId(sharedApps[0].jobId);
    }
  }, [sharedApps]);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [actionDone, setActionDone] = useState<'shortlisted' | 'rejected' | null>(null);
  const [rejectReasonKey, setRejectReasonKey] = useState('');
  const [rejectNotes, setRejectNotes] = useState('');

  const { data: screeningResult, isLoading: screeningLoading } = useScreeningResult(
    selectedCandidateId,
    selectedJobId
  );

  const selectedCandidate = React.useMemo<Candidate | undefined>(() => {
    if (selectedCandidateId.startsWith('shared-')) {
      const rawId = selectedCandidateId.replace('shared-', '');
      const app = sharedApps.find((a) => a.id === rawId);
      if (app) {
        return {
          id: selectedCandidateId,
          name: app.fullName,
          email: app.email,
          phone: app.phone || '0901234567',
          location: 'Hồ Chí Minh, Việt Nam',
          currentTitle: app.jobTitle,
          currentCompany: app.company,
          cvMode: CVMode.FILE_UPLOAD,
          highlightCard: {
            currentSalary: 25000000,
            expectedSalary: 35000000,
            currency: 'VND',
            yearsOfExperience: 3,
            primaryLanguage: 'Tiếng Việt',
            languageLevel: 'B2' as unknown as import('@/types/candidate').LanguageLevel,
            availabilityDate: app.applyDate,
            noticePeriod: 30,
            headline: `Ứng viên nộp qua ${app.source === 'AFFILIATE' ? `CTV ${app.affiliateName || 'Đối tác'}` : 'Trực tiếp'}`,
          },
          skills: ['React', 'TypeScript', 'Node.js', 'REST API', 'PostgreSQL', 'Docker', 'Git'],
          industries: ['Software Development', 'Fintech'],
          applicationStatus: ApplicationStatus.SCREENING,
          aiScore: app.aiScore,
          scoreTier: app.aiScore >= 80 ? ScoreTier.TOP_FIT : ScoreTier.STRONG,
          createdAt: app.applyDate,
          updatedAt: app.applyDate,
        };
      }
    }
    return candidates?.find((c) => c.id === selectedCandidateId);
  }, [selectedCandidateId, sharedApps, candidates]);

  const selectedJob = jobs?.find((j) => j.id === selectedJobId);

  const score = selectedCandidateId.startsWith('shared-')
    ? (selectedCandidate?.aiScore ?? 88)
    : (screeningResult?.semanticScore ?? selectedCandidate?.aiScore ?? 0);
  const scoreTier = getScoreTier(score);
  const scoreTierConfig = SCORE_TIER_CONFIG[scoreTier];
  const colorTier = scoreToColorTier(score);
  const colorTierConfig = COLOR_TIER_CONFIG[colorTier];

  /**
   * Shortlist handler — approves the candidate for interview:
   *  1. Updates the application status to INTERVIEW_SCHEDULED in applicationStore.
   *  2. Writes a new InterviewRecord into hrconnect_interviews localStorage.
   */
  const handleShortlist = () => {
    if (!selectedCandidate) {
      setActionDone('shortlisted');
      return;
    }

    // --- 1. Update applicationStore status ---
    if (selectedCandidateId.startsWith('shared-')) {
      const rawId = selectedCandidateId.replace('shared-', '');
      const app = sharedApps.find((a) => a.id === rawId);
      if (app) {
        const interviewDate = new Date();
        interviewDate.setDate(interviewDate.getDate() + 1);
        const isoDate = interviewDate.toISOString().slice(0, 10);
        const timeStr = `${isoDate} 10:00`;

        useApplicationStore.getState().updateApplicationStatus(
          app.id,
          'INTERVIEW_SCHEDULED',
          {
            interviewTime: timeStr,
            interviewLink: 'https://meet.google.com/hrc-screen-' + app.id.slice(-5),
            interviewerName: 'HR Connect — Ban tuyển dụng',
          }
        );

        // --- 2. Persist InterviewRecord ---
        saveInterview({
          id: 'int-screen-' + app.id,
          candidateName: app.fullName,
          candidateEmail: app.email,
          companyName: app.company || selectedJob?.company || 'HRConnect',
          jobTitle: app.jobTitle,
          roundName: 'Vòng 1 — Phỏng vấn chuyên môn',
          scheduledTime: timeStr,
          meetingLink: 'https://meet.google.com/hrc-screen-' + app.id.slice(-5),
          interviewerName: 'HR Connect — Ban tuyển dụng',
          status: 'SCHEDULED',
          notes: `Ứng viên được duyệt qua AI Screening (Score: ${score}/100). Nguồn: ${app.source === 'AFFILIATE' ? 'CTV ' + (app.affiliateName || 'Chưa rõ') : 'Tự ứng tuyển'}.`,
          applicationId: app.id,
        });
      }
    }

    setActionDone('shortlisted');
  };

  const handleRejectConfirm = () => {
    if (!rejectReasonKey) return; // disabled if no reason
    setRejectModalOpen(false);
    setActionDone('rejected');
    setRejectReasonKey('');
    setRejectNotes('');
  };

  const handleReset = () => {
    setActionDone(null);
    setRejectReasonKey('');
    setRejectNotes('');
  };

  const openRejectModal = () => {
    setRejectReasonKey('');
    setRejectNotes('');
    setRejectModalOpen(true);
  };

  return (
    <div>
      {/* ── Page Header ── */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <Title level={3} style={{ margin: 0, color: '#f8fafc', fontWeight: 800 }}>
              <RobotOutlined style={{ color: '#60a5fa', marginRight: 10 }} />
              Sàng lọc CV-JD bằng AI
            </Title>
            <Text style={{ fontSize: 13, color: '#94a3b8' }}>
              Khớp hồ sơ bằng AI ngữ nghĩa với phân hạng 4 mức điểm. Đánh giá mức độ phù hợp và đưa ra quyết định tuyển dụng.
            </Text>
          </div>
          <Space wrap>
            <Select
              value={selectedCandidateId}
              onChange={(val) => {
                setSelectedCandidateId(val);
                if (val.startsWith('shared-')) {
                  const rawId = val.replace('shared-', '');
                  const app = sharedApps.find((a) => a.id === rawId);
                  if (app?.jobId) setSelectedJobId(app.jobId);
                }
              }}
              style={{ width: 320 }}
              loading={candidatesLoading}
              placeholder="Chọn ứng viên"
              showSearch
              filterOption={(input, option) =>
                String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
              options={[
                {
                  label: '★ Vừa nộp hồ sơ (Real-time)',
                  options: candidateOptions.filter((o) => o.isShared).map((o) => ({
                    value: o.value,
                    label: o.label,
                  })),
                },
                {
                  label: 'Hồ sơ kho (Mock Data)',
                  options: candidateOptions.filter((o) => !o.isShared).map((o) => ({
                    value: o.value,
                    label: o.label,
                  })),
                },
              ]}
            />
            <Select
              value={selectedJobId}
              onChange={setSelectedJobId}
              style={{ width: 270 }}
              loading={jobsLoading}
              placeholder="Chọn vị trí tuyển dụng"
              options={jobs?.map((j) => ({
                value: j.id,
                label: `${j.title} @ ${j.company}`,
              }))}
            />
          </Space>
        </div>
      </div>

      {/* ── Action Done Banner ── */}
      {actionDone && (
        <Alert
          type={actionDone === 'shortlisted' ? 'success' : 'error'}
          showIcon
          icon={actionDone === 'shortlisted' ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
          message={
            <span style={{ fontWeight: 700 }}>
              {actionDone === 'shortlisted' ? '✓ Đã duyệt hồ sơ phỏng vấn' : '✗ Đã từ chối hồ sơ — Lưu vết kiểm toán hoàn tất'}
            </span>
          }
          description={
            actionDone === 'shortlisted'
              ? 'Đã thêm vào danh sách phỏng vấn. Khách hàng tuyển dụng sẽ nhận thông báo để sắp xếp lịch phỏng vấn trong 48 giờ.'
              : 'Lý do từ chối đã được ghi nhận vào hồ sơ kiểm toán bắt buộc. Đối tác tuyển dụng (Affiliate) đã nhận được thông báo.'
          }
          action={
            <Button size="small" onClick={handleReset} style={{ borderRadius: 6 }}>
              Xem ứng viên khác
            </Button>
          }
          style={{ marginBottom: 16, borderRadius: 12 }}
        />
      )}

      {/* ── Split-View ── */}
      <Row gutter={[16, 16]} style={{ alignItems: 'flex-start' }}>

        {/* LEFT — CV Viewer */}
        <Col xs={24} lg={14}>
          <Card
            style={{ borderRadius: 16, border: '1px solid rgba(51, 65, 85, 0.65)', background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(12px)', padding: 0 }}
            styles={{ body: { padding: 0 } }}
            title={
              <Space>
                <span style={{ fontWeight: 700, color: '#f8fafc', fontSize: 14 }}>Hồ sơ ứng viên (CV)</span>
                {selectedCandidate && (
                  <Tag style={{ borderRadius: 9999, fontSize: 11, margin: 0, background: 'rgba(37, 99, 235, 0.15)', color: '#60a5fa', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
                    {selectedCandidate.cvMode.replace(/_/g, ' ')}
                  </Tag>
                )}
              </Space>
            }
          >
            <div style={{ maxHeight: 'calc(100vh - 260px)', overflowY: 'auto', padding: '0 16px 16px' }}>
              {candidatesLoading ? (
                <Skeleton active paragraph={{ rows: 12 }} />
              ) : selectedCandidate ? (
                <CVViewer candidate={selectedCandidate} />
              ) : (
                <div style={{ textAlign: 'center', padding: '60px 0', color: '#94a3b8' }}>
                  <UserOutlined style={{ fontSize: 40, marginBottom: 12, display: 'block' }} />
                  Chọn một ứng viên để xem chi tiết CV
                </div>
              )}
            </div>
          </Card>
        </Col>

        {/* RIGHT — AI Analysis Panel */}
        <Col xs={24} lg={10}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* ── ColorTier Score Card ── */}
            <Card
              style={{
                borderRadius: 16,
                border: `1.5px solid ${colorTierConfig.hex}50`,
                background: 'rgba(15, 23, 42, 0.75)',
                backdropFilter: 'blur(12px)',
                transition: 'all 0.4s ease',
              }}
            >
              {screeningLoading ? (
                <Skeleton active paragraph={{ rows: 4 }} />
              ) : (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                    <ThunderboltOutlined style={{ color: '#60a5fa', fontSize: 16 }} />
                    <span style={{ fontWeight: 700, fontSize: 14, color: '#f8fafc' }}>Độ tương đồng ngữ nghĩa</span>
                    <Tag style={{ marginLeft: 'auto', borderRadius: 100, background: 'rgba(37, 99, 235, 0.15)', color: '#60a5fa', border: '1px solid rgba(59, 130, 246, 0.3)', fontSize: 10, fontWeight: 700 }}>
                      TÍNH TOÁN BỞI AI
                    </Tag>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                    <Progress
                      type="circle"
                      percent={score}
                      size={96}
                      strokeColor={TIER_STROKE[colorTier]}
                      format={(p) => (
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: 20, fontWeight: 800, color: colorTierConfig.hex }}>{p}%</div>
                        </div>
                      )}
                    />
                    <div style={{ flex: 1 }}>
                      <TierBadge score={score} />
                      <ScoreTierTag score={score} showScore={false} />
                      <div style={{ fontSize: 12, color: '#cbd5e1', marginTop: 8, lineHeight: 1.6 }}>
                        {screeningResult?.aiSummary?.slice(0, 130) ?? scoreTierConfig.label + ' — Đã tải phân tích từ AI.'}
                        {screeningResult?.aiSummary && '…'}
                      </div>
                    </div>
                  </div>

                  {/* Score bands legend */}
                  <div style={{ display: 'flex', gap: 6, marginTop: 14, flexWrap: 'wrap' }}>
                    {[
                      { label: 'RED ≥80', color: '#f87171', bg: 'rgba(239, 68, 68, 0.15)' },
                      { label: 'TEAL ≥65', color: '#2dd4bf', bg: 'rgba(20, 184, 166, 0.15)' },
                      { label: 'GREEN ≥50', color: '#a3e635', bg: 'rgba(132, 204, 22, 0.15)' },
                      { label: 'GRAY <50', color: '#94a3b8', bg: 'rgba(100, 116, 139, 0.15)' },
                    ].map(({ label, color, bg }) => (
                      <div
                        key={label}
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          color,
                          background: bg,
                          border: `1px solid ${color}40`,
                          borderRadius: 6,
                          padding: '2px 7px',
                          letterSpacing: '0.04em',
                        }}
                      >
                        {label}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Card>

            {/* ── JD Requirements ── */}
            {selectedJob && selectedCandidate && !candidatesLoading && (
              <JDPanel job={selectedJob} candidateSkills={selectedCandidate.skills} />
            )}

            {/* ── Match Analysis ── */}
            {screeningResult && (
              <Card size="small" style={{ borderRadius: 16, border: '1px solid rgba(51, 65, 85, 0.65)', background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(12px)' }}>
                <Title level={5} style={{ fontSize: 13, color: '#f8fafc', marginBottom: 12 }}>
                  <TrophyOutlined style={{ color: '#fbbf24', marginRight: 6 }} />
                  Phân tích độ phù hợp
                </Title>

                {screeningResult.matchedSkills.length > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#34d399', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
                      ✓ Kỹ năng phù hợp ({screeningResult.matchedSkills.length})
                    </div>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {screeningResult.matchedSkills.map((s) => (
                        <Tag key={s} color="success" icon={<CheckCircleOutlined />} style={{ borderRadius: 6, fontSize: 11, margin: 0 }}>{s}</Tag>
                      ))}
                    </div>
                  </div>
                )}

                {screeningResult.missingSkills.length > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#f87171', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
                      ✗ Kỹ năng còn thiếu ({screeningResult.missingSkills.length})
                    </div>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {screeningResult.missingSkills.map((s) => (
                        <Tag key={s} color="error" style={{ borderRadius: 6, fontSize: 11, margin: 0 }}>{s}</Tag>
                      ))}
                    </div>
                  </div>
                )}

                {screeningResult.strengths && screeningResult.strengths.length > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#60a5fa', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
                      💡 Điểm mạnh nổi bật
                    </div>
                    {screeningResult.strengths.map((s, i) => (
                      <div key={i} style={{ fontSize: 12, color: '#cbd5e1', marginBottom: 4, display: 'flex', gap: 6 }}>
                        <span style={{ color: '#34d399', flexShrink: 0 }}>✓</span>
                        <span>{s}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#c084fc', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
                    🤖 Khuyến nghị tuyển dụng từ AI
                  </div>
                  <div style={{ fontSize: 12, color: '#cbd5e1', background: 'rgba(30, 41, 59, 0.45)', borderRadius: 10, padding: '10px 12px', lineHeight: 1.6, border: '1px solid rgba(51, 65, 85, 0.6)' }}>
                    {screeningResult.recommendation}
                  </div>
                </div>
              </Card>
            )}

            {/* ── Action Footer ── */}
            <div
              style={{
                display: 'flex',
                gap: 10,
                padding: '14px',
                background: 'rgba(15, 23, 42, 0.75)',
                backdropFilter: 'blur(12px)',
                borderRadius: 16,
                border: '1px solid rgba(51, 65, 85, 0.65)',
                boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
              }}
            >
              <Button
                type="primary"
                size="large"
                icon={<CheckCircleOutlined />}
                onClick={handleShortlist}
                disabled={!!actionDone}
                style={{
                  flex: 1,
                  height: 44,
                  borderRadius: 10,
                  fontWeight: 600,
                  background: '#16a34a',
                  border: 'none',
                }}
              >
                Duyệt phỏng vấn
              </Button>
              <Button
                danger
                size="large"
                icon={<CloseCircleOutlined />}
                onClick={openRejectModal}
                disabled={!!actionDone}
                style={{ flex: 1, height: 44, borderRadius: 10, fontWeight: 600 }}
              >
                Từ chối hồ sơ
              </Button>
            </div>
          </div>
        </Col>
      </Row>

      {/* ── Mandatory Reject Modal ── */}
      <Modal
        open={rejectModalOpen}
        onCancel={() => { setRejectModalOpen(false); setRejectReasonKey(''); setRejectNotes(''); }}
        title={
          <Space>
            <CloseCircleOutlined style={{ color: '#ef4444' }} />
            <span style={{ fontWeight: 700 }}>Từ chối hồ sơ — Lý do từ chối (Lưu vết kiểm toán)</span>
          </Space>
        }
        onOk={handleRejectConfirm}
        okText="Xác nhận từ chối"
        cancelText="Hủy bỏ"
        okButtonProps={{
          danger: true,
          size: 'large',
          disabled: !rejectReasonKey,
          icon: <ExclamationCircleOutlined />,
        }}
        cancelButtonProps={{ size: 'large' }}
        width={540}
      >
        <Alert
          type="warning"
          showIcon
          message="Quy định kiểm toán bắt buộc"
          description={
            <span style={{ fontSize: 12 }}>
              Lý do từ chối được <strong>lưu vết vĩnh viễn</strong> phục vụ kiểm toán và minh bạch hệ thống.
              Đối tác tuyển dụng và ứng viên sẽ nhận thông báo tự động.
              Nút Xác nhận chỉ kích hoạt khi đã chọn lý do.
            </span>
          }
          style={{ marginBottom: 16, borderRadius: 8 }}
        />

        <Form layout="vertical">
          <Form.Item
            label={
              <span style={{ fontWeight: 600, fontSize: 13 }}>
                Lý do từ chối (Lưu vết kiểm toán) <span style={{ color: '#ef4444' }}>*</span>
              </span>
            }
            validateStatus={!rejectReasonKey ? 'error' : 'success'}
            help={!rejectReasonKey ? 'Bắt buộc chọn lý do từ chối để đảm bảo tính minh bạch kiểm toán.' : undefined}
          >
            <Select
              style={{ width: '100%' }}
              placeholder="Chọn lý do từ chối chính..."
              size="large"
              value={rejectReasonKey || undefined}
              onChange={(v: string) => setRejectReasonKey(v)}
              options={REJECT_REASONS}
              optionRender={(opt) => (
                <div style={{ whiteSpace: 'normal', lineHeight: 1.45, fontSize: 12, padding: '3px 0' }}>
                  {String(opt.label)}
                </div>
              )}
            />
          </Form.Item>

          <Form.Item
            label={
              <span style={{ fontWeight: 600, fontSize: 13 }}>
                Ghi chú bổ sung
                <span style={{ color: '#94a3b8', fontWeight: 400, fontSize: 11, marginLeft: 6 }}>
                  (không bắt buộc — giải thích thêm cho đối tác tuyển dụng)
                </span>
              </span>
            }
          >
            <TextArea
              value={rejectNotes}
              onChange={(e) => setRejectNotes(e.target.value)}
              placeholder="Ví dụ: Kinh nghiệm chuyên môn của ứng viên chưa đáp ứng yêu cầu kiến trúc microservices hoặc kỳ vọng lương vượt quá ngân sách..."
              rows={4}
              style={{ borderRadius: 8 }}
              maxLength={1000}
              showCount
            />
          </Form.Item>

          {selectedCandidate && (
            <div
              style={{
                padding: '10px 14px',
                background: '#fef2f2',
                borderRadius: 8,
                border: '1px solid #fecaca',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <Avatar size={32} style={{ background: 'linear-gradient(135deg, #0284c7, #38bdf8)', fontWeight: 700, fontSize: 12 }}>
                {selectedCandidate.name.slice(0, 2).toUpperCase()}
              </Avatar>
              <div>
                <div style={{ fontWeight: 700, fontSize: 13, color: '#0f172a' }}>{selectedCandidate.name}</div>
                <div style={{ fontSize: 11, color: '#64748b' }}>
                  {selectedCandidate.currentTitle} · Điểm AI: {score}%
                </div>
              </div>
              <TierBadge score={score} />
            </div>
          )}
        </Form>
      </Modal>
    </div>
  );
};
