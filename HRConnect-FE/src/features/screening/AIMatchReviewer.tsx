/**
 * @file AIMatchReviewer.tsx
 * @description Màn hình chia đôi Sàng lọc AI (Split-Screen AI CV-JD Screening Reviewer)
 * Layout 2 cột cân đối:
 *  - Cột trái (55%): Khung xem CV PDF giả lập (CV Viewer) sắc nét chuẩn A4 Paper.
 *  - Cột phải (45%): AI Match Score Dashboard (89% Ruby Heart Tier), Phân tích từ khóa Must-have/Should-have, Candidate Highlights & Cụm Action Button cố định.
 */
import React, { useState } from 'react';
import {
  Card,
  Progress,
  Tag,
  Button,
  Modal,
  Select,
  Input,
  Row,
  Col,
  Typography,
  Space,
  Avatar,
  Divider,
  Alert,
  Tooltip,
  Badge,
  message,
} from 'antd';
import {
  CheckCircleFilled,
  CloseCircleFilled,
  FilePdfOutlined,
  DownloadOutlined,
  ZoomInOutlined,
  ZoomOutOutlined,
  PrinterOutlined,
  SafetyCertificateFilled,
  RobotOutlined,
  HeartFilled,
  CalendarOutlined,
  DollarCircleOutlined,
  ThunderboltOutlined,
  UserOutlined,
  MailOutlined,
  PhoneOutlined,
  EnvironmentOutlined,
  LinkedinOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  CheckOutlined,
  CloseOutlined,
} from '@ant-design/icons';
import { ColorTier } from '@/types/domain';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

// ─── Interfaces ─────────────────────────────────────────────────────────────

export interface AIMatchReviewerCandidate {
  id: string;
  name: string;
  currentTitle: string;
  email: string;
  phone: string;
  location: string;
  linkedInUrl?: string;
  yearsOfExperience: number;
  expectedSalary: string;
  noticePeriod: string;
  englishLevel: string;
  summary: string;
  skills: string[];
  workExperience: Array<{
    role: string;
    company: string;
    period: string;
    highlights: string[];
  }>;
  education: Array<{
    degree: string;
    school: string;
    year: string;
  }>;
}

export interface AIMatchReviewerJob {
  id: string;
  title: string;
  department: string;
  mustHaveSkills: string[];
  shouldHaveSkills: string[];
  salaryBudget: string;
}

export interface AIMatchReviewerProps {
  score?: number; // Mặc định 89% theo yêu cầu proposal
  candidate?: AIMatchReviewerCandidate;
  job?: AIMatchReviewerJob;
  onApproveInterview?: (candidateId: string) => void;
  onReject?: (candidateId: string, reason: string, note?: string) => void;
  className?: string;
}

// ─── Mock Default Data ──────────────────────────────────────────────────────

const DEFAULT_CANDIDATE: AIMatchReviewerCandidate = {
  id: 'cand-089',
  name: 'Nguyễn Đăng Quang',
  currentTitle: 'Kỹ sư Frontend Web / ReactJS Developer',
  email: 'dangquang.frontend@techcorp.vn',
  phone: '+84 912 345 678',
  location: 'Hà Nội, Việt Nam (Hybrid)',
  linkedInUrl: 'https://linkedin.com/in/quang-frontend-dev',
  yearsOfExperience: 5.5,
  expectedSalary: '45.000.000 đ',
  noticePeriod: '15 ngày (Sẵn sàng nhận việc)',
  englishLevel: 'IELTS 7.0 (Fluent Professional)',
  summary:
    'Kỹ sư Frontend Web 5+ năm kinh nghiệm thực chiến phát triển các ứng dụng SaaS B2B quy mô lớn và hệ thống Web App Fintech hiệu năng cao. Thành thạo React 18, TypeScript, Tailwind CSS, Ant Design v5, Quản lý State với Zustand/Redux Toolkit và Tối ưu hóa Web Vitals (LCP < 1.2s).',
  skills: [
    'React',
    'TypeScript',
    'Tailwind CSS',
    'Ant Design',
    'Next.js',
    'Zustand',
    'TanStack Query',
    'RESTful API',
    'CI/CD Pipeline',
    'Micro-frontends',
    'Vite',
    'Jest / Testing',
  ],
  workExperience: [
    {
      role: 'Senior React Developer & Tech Lead',
      company: 'VinTech Solutions Global',
      period: '03/2023 — Hiện tại',
      highlights: [
        'Chủ trì tái cấu trúc kiến trúc Frontend Web Portal phục vụ 250.000 người dùng hàng ngày.',
        'Đồng bộ hệ thống Ant Design v5 với Tailwind CSS, giảm 45% thời gian phát triển UI cho đội ngũ 12 kỹ sư.',
        'Tối ưu hóa bundle Vite và Core Web Vitals, nâng điểm Google Lighthouse từ 62 lên 94 điểm.',
      ],
    },
    {
      role: 'Frontend Web Engineer',
      company: 'FPT Software & Cloud Lab',
      period: '08/2020 — 02/2023',
      highlights: [
        'Phát triển ứng dụng tuyển dụng & phân hệ Dashboard quản trị cho đối tác Ngân hàng Nhật Bản.',
        'Triển khai TanStack Query caching đa tầng và Realtime WebSockets cho thông báo trạng thái hồ sơ.',
      ],
    },
  ],
  education: [
    {
      degree: 'Cử nhân Kỹ thuật Phần mềm (Bằng Giỏi)',
      school: 'Đại học Bách Khoa Hà Nội',
      year: '2016 — 2020',
    },
  ],
};

const DEFAULT_JOB: AIMatchReviewerJob = {
  id: 'job-fe-01',
  title: 'Kỹ sư Frontend Web / ReactJS Developer (Lead Level)',
  department: 'Khối Công nghệ & Sản phẩm (Core Platform)',
  salaryBudget: '40.000.000 - 55.000.000 đ',
  mustHaveSkills: ['React', 'TypeScript', 'Ant Design', 'Tailwind CSS', 'Next.js'],
  shouldHaveSkills: ['Zustand', 'Micro-frontends', 'CI/CD Pipeline', 'GraphQL', 'Docker'],
};

const REJECT_REASONS = [
  { value: 'skills_gap', label: 'Thiếu kỹ năng chuyên môn bắt buộc theo JD' },
  { value: 'insufficient_exp', label: 'Chưa đủ số năm kinh nghiệm yêu cầu' },
  { value: 'salary_mismatch', label: 'Mức lương kỳ vọng vượt ngân sách đã duyệt' },
  { value: 'notice_too_long', label: 'Thời gian gia nhập trễ hơn kế hoạch dự án' },
  { value: 'candidate_withdrew', label: 'Ứng viên xin rút hồ sơ ứng tuyển' },
  { value: 'other', label: 'Lý do khác (Ghi rõ trong báo cáo kiểm toán)' },
];

export const AIMatchReviewer: React.FC<AIMatchReviewerProps> = ({
  score = 89, // Mặc định 89% theo đúng proposal
  candidate = DEFAULT_CANDIDATE,
  job = DEFAULT_JOB,
  onApproveInterview,
  onReject,
  className = '',
}) => {
  const [zoomScale, setZoomScale] = useState<number>(1);
  const [rejectModalOpen, setRejectModalOpen] = useState<boolean>(false);
  const [rejectReason, setRejectReason] = useState<string>('');
  const [rejectNote, setRejectNote] = useState<string>('');
  const [decisionState, setDecisionState] = useState<'pending' | 'approved' | 'rejected'>('pending');

  // Xác định tier dựa trên điểm số khớp 100% proposal
  const getTierInfo = (s: number) => {
    if (s >= 80) {
      return {
        tier: ColorTier.RED,
        name: 'Red Heart Tier',
        color: '#e11d48',
        bg: '#fff1f2',
        border: '#fecdd3',
        label: 'Phù hợp xuất sắc (Top Fit)',
        badge: 'RED ≥80%',
      };
    }
    if (s >= 70) {
      return {
        tier: ColorTier.TEAL,
        name: 'Teal Tier',
        color: '#0d9488',
        bg: '#f0fdfa',
        border: '#99f6e4',
        label: 'Phù hợp cao (Strong Fit)',
        badge: 'TEAL 70-79%',
      };
    }
    if (s >= 60) {
      return {
        tier: ColorTier.GREEN,
        name: 'Light Green Tier',
        color: '#16a34a',
        bg: '#f0fdf4',
        border: '#bbf7d0',
        label: 'Đạt chuẩn (Moderate Fit)',
        badge: 'GREEN 60-69%',
      };
    }
    return {
      tier: ColorTier.GRAY,
      name: 'Gray Tier',
      color: '#64748b',
      bg: '#f8fafc',
      border: '#e2e8f0',
      label: 'Chưa phù hợp (Weak Fit)',
      badge: 'GRAY <60%',
    };
  };

  const tier = getTierInfo(score);

  // Xử lý Duyệt phỏng vấn
  const handleApprove = () => {
    setDecisionState('approved');
    if (onApproveInterview) {
      onApproveInterview(candidate.id);
    } else {
      message.success(`Đã duyệt hồ sơ của ${candidate.name} vào vòng Lịch Phỏng Vấn.`);
    }
  };

  // Xử lý Từ chối hồ sơ kèm lưu vết kiểm toán bắt buộc
  const handleConfirmReject = () => {
    if (!rejectReason) {
      message.error('Vui lòng chọn lý do từ chối để hệ thống lưu hồ sơ kiểm toán.');
      return;
    }
    setDecisionState('rejected');
    setRejectModalOpen(false);
    if (onReject) {
      onReject(candidate.id, rejectReason, rejectNote);
    } else {
      message.warning(`Đã từ chối hồ sơ ứng viên ${candidate.name}. Lý do đã lưu vào Nhật ký kiểm toán.`);
    }
  };

  return (
    <div className={`w-full font-sans ${className}`}>
      {/* ─── Breadcrumb & Quick Info Bar ─────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 mb-4 border-b border-slate-200/90 gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Mô đun Sàng lọc Hồ sơ AI · Mã hồ sơ:
            </span>
            <Tag color="cyan" className="font-mono text-xs font-bold rounded-md">
              {candidate.id}
            </Tag>
          </div>
          <h1 className="text-xl lg:text-2xl font-extrabold text-slate-900 tracking-tight mt-0.5 mb-0">
            {job.title}
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <Tag className="py-1 px-3 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border-slate-300">
            Ngân sách: <span className="text-emerald-700 font-extrabold tabular-nums">{job.salaryBudget}</span>
          </Tag>
          {decisionState === 'approved' && (
            <Tag color="success" className="py-1 px-3 rounded-full text-xs font-bold">
              ✓ Đã duyệt phỏng vấn
            </Tag>
          )}
          {decisionState === 'rejected' && (
            <Tag color="error" className="py-1 px-3 rounded-full text-xs font-bold">
              ✗ Đã từ chối hồ sơ
            </Tag>
          )}
        </div>
      </div>

      {/* ─── SPLIT SCREEN LAYOUT (55% LEFT / 45% RIGHT) ─────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ============================================================== */}
        {/* CỘT TRÁI (55% ~ 7/12 Grid): KHUNG XEM CV PDF GIẢ LẬP SẮC NÉT  */}
        {/* ============================================================== */}
        <div className="lg:col-span-7 flex flex-col">
          {/* Thanh công cụ PDF Viewer */}
          <div className="flex items-center justify-between bg-slate-900 text-white px-4 py-2.5 rounded-t-xl text-xs font-medium border-x border-t border-slate-800">
            <div className="flex items-center gap-2">
              <FilePdfOutlined className="text-rose-400 text-base" />
              <span className="font-semibold text-slate-200 truncate max-w-[240px]">
                CV_{candidate.name.replace(/\s+/g, '_')}_2026.pdf
              </span>
              <span className="text-slate-400 text-[11px] hidden sm:inline">(Trang 1 / 1)</span>
            </div>

            <div className="flex items-center gap-1.5">
              <Tooltip title="Thu nhỏ">
                <Button
                  size="small"
                  type="text"
                  icon={<ZoomOutOutlined className="text-slate-300" />}
                  onClick={() => setZoomScale((prev) => Math.max(0.85, prev - 0.05))}
                  className="hover:bg-slate-800"
                />
              </Tooltip>
              <span className="text-slate-300 font-mono text-[11px] px-1">
                {Math.round(zoomScale * 100)}%
              </span>
              <Tooltip title="Phóng to">
                <Button
                  size="small"
                  type="text"
                  icon={<ZoomInOutlined className="text-slate-300" />}
                  onClick={() => setZoomScale((prev) => Math.min(1.2, prev + 0.05))}
                  className="hover:bg-slate-800"
                />
              </Tooltip>
              <div className="w-[1px] h-3.5 bg-slate-700 mx-1" />
              <Tooltip title="Tải xuống CV gốc">
                <Button
                  size="small"
                  type="text"
                  icon={<DownloadOutlined className="text-slate-300" />}
                  onClick={() => message.info('Đang tải bản CV PDF gốc có chữ ký số...')}
                  className="hover:bg-slate-800"
                />
              </Tooltip>
              <Tooltip title="In tài liệu">
                <Button
                  size="small"
                  type="text"
                  icon={<PrinterOutlined className="text-slate-300" />}
                  onClick={() => window.print()}
                  className="hover:bg-slate-800"
                />
              </Tooltip>
            </div>
          </div>

          {/* Giả lập khung giấy A4 PDF Canvas */}
          <div
            className="border-x border-b border-slate-200/90 rounded-b-xl bg-slate-100/90 p-3 sm:p-5 overflow-y-auto max-h-[calc(100vh-220px)] shadow-inner"
            style={{ minHeight: '680px' }}
          >
            <div
              className="bg-white rounded-lg shadow-sm border border-slate-200/80 p-6 sm:p-8 transition-transform origin-top text-slate-800"
              style={{
                transform: `scale(${zoomScale})`,
                fontFamily: "'Be Vietnam Pro', 'Inter', sans-serif",
              }}
            >
              {/* Header CV */}
              <div className="border-b border-slate-200 pb-5 mb-5 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                  <Avatar
                    size={64}
                    className="bg-gradient-to-br from-emerald-600 to-teal-700 text-white font-black text-2xl flex-shrink-0 border-2 border-emerald-200"
                  >
                    {candidate.name.charAt(0)}
                  </Avatar>
                  <div>
                    <h2 className="text-2xl font-black text-slate-900 tracking-tight m-0">
                      {candidate.name}
                    </h2>
                    <div className="text-sm font-bold text-emerald-700 mt-0.5">
                      {candidate.currentTitle}
                    </div>
                    <div className="flex flex-wrap items-center gap-y-1 gap-x-3 text-xs text-slate-500 mt-2">
                      <span className="flex items-center gap-1">
                        <MailOutlined className="text-slate-400" /> {candidate.email}
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <PhoneOutlined className="text-slate-400" /> {candidate.phone}
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <EnvironmentOutlined className="text-slate-400" /> {candidate.location}
                      </span>
                    </div>
                  </div>
                </div>

                {candidate.linkedInUrl && (
                  <a
                    href={candidate.linkedInUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-blue-600 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-md hover:bg-blue-100 self-start"
                  >
                    <LinkedinOutlined /> Profile ↗
                  </a>
                )}
              </div>

              {/* Tóm tắt nghề nghiệp */}
              <div className="mb-5">
                <div className="text-xs font-extrabold uppercase tracking-wider text-slate-700 pb-1 mb-2 border-b border-slate-100">
                  Tóm Tắt Năng Lực & Mục Tiêu Nghề Nghiệp
                </div>
                <Paragraph className="text-xs leading-relaxed text-slate-700 m-0">
                  {candidate.summary}
                </Paragraph>
              </div>

              {/* Kỹ năng chuyên môn */}
              <div className="mb-5">
                <div className="text-xs font-extrabold uppercase tracking-wider text-slate-700 pb-1 mb-2 border-b border-slate-100">
                  Kỹ Năng Kỹ Thuật (Tech Stack & Tools)
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {candidate.skills.map((skill) => (
                    <span
                      key={skill}
                      className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[11px] font-semibold border border-slate-200"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>

              {/* Kinh nghiệm làm việc */}
              <div className="mb-5">
                <div className="text-xs font-extrabold uppercase tracking-wider text-slate-700 pb-1 mb-3 border-b border-slate-100">
                  Kinh Nghiệm Làm Việc Thực Chiến
                </div>
                <div className="space-y-4">
                  {candidate.workExperience.map((exp, idx) => (
                    <div key={idx} className="relative pl-3 border-l-2 border-emerald-500">
                      <div className="flex justify-between items-baseline gap-2">
                        <span className="font-bold text-xs text-slate-900">{exp.role}</span>
                        <span className="text-[11px] text-slate-500 font-mono">{exp.period}</span>
                      </div>
                      <div className="text-[11px] font-semibold text-slate-600 mb-1.5">
                        🏢 {exp.company}
                      </div>
                      <ul className="list-disc list-inside text-xs text-slate-600 space-y-1 m-0">
                        {exp.highlights.map((h, i) => (
                          <li key={i} className="leading-snug">
                            {h}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>

              {/* Học vấn & Chứng chỉ */}
              <div>
                <div className="text-xs font-extrabold uppercase tracking-wider text-slate-700 pb-1 mb-2 border-b border-slate-100">
                  Học Vấn & Đào Tạo
                </div>
                {candidate.education.map((edu, idx) => (
                  <div key={idx} className="flex justify-between items-center text-xs">
                    <div>
                      <strong className="text-slate-800">{edu.degree}</strong>
                      <span className="text-slate-500 block text-[11px]">{edu.school}</span>
                    </div>
                    <span className="text-slate-400 font-mono text-[11px]">{edu.year}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ============================================================== */}
        {/* CỘT PHẢI (45% ~ 5/12 Grid): AI ANALYSIS PANEL & ACTION BUTTONS */}
        {/* ============================================================== */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          {/* Card 1: AI Match Score Dashboard & Proposal Tier Signal */}
          <Card
            className="border border-slate-200/90 shadow-sm rounded-xl overflow-hidden bg-white"
            bodyStyle={{ padding: '24px 20px' }}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <RobotOutlined className="text-lg text-emerald-600" />
                <span className="text-sm font-extrabold text-slate-900 tracking-tight">
                  Điểm Phù Hợp Ngữ Nghĩa AI
                </span>
              </div>
              <span
                className="text-[11px] font-extrabold px-2.5 py-0.5 rounded-full border"
                style={{ background: tier.bg, color: tier.color, borderColor: tier.border }}
              >
                {tier.badge}
              </span>
            </div>

            {/* Vòng tròn Antd Progress type="dashboard" 89% */}
            <div className="flex flex-col items-center justify-center my-2">
              <Progress
                type="dashboard"
                percent={score}
                size={168}
                strokeColor={tier.color}
                strokeWidth={9}
                format={(percent) => (
                  <div className="flex flex-col items-center">
                    <span className="text-3xl font-black text-slate-900 tracking-tighter tabular-nums font-mono">
                      {percent}%
                    </span>
                    <span className="text-[11px] font-bold text-rose-600 flex items-center gap-1 mt-0.5">
                      <HeartFilled /> Top Fit
                    </span>
                  </div>
                )}
              />

              <div className="text-center mt-2">
                <div className="text-sm font-extrabold" style={{ color: tier.color }}>
                  {tier.label}
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  Mô hình BERT Embedding so khớp tiêu chuẩn JD và năng lực ứng viên
                </div>
              </div>
            </div>

            {/* DẢI MỐC PHÂN HẠNG THEO ĐÚNG TÀI LIỆU PROPOSAL */}
            <div className="mt-4 pt-3 border-t border-slate-100">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 text-center mb-2">
                Dải mốc phân loại chuẩn Proposal
              </div>
              <div className="grid grid-cols-4 gap-1.5 text-center text-[10px] font-bold">
                <div
                  className={`py-1.5 px-1 rounded border transition-all ${
                    tier.tier === ColorTier.RED
                      ? 'bg-rose-50 border-rose-300 text-rose-700 ring-2 ring-rose-400/30'
                      : 'bg-slate-50 border-slate-200 text-slate-600'
                  }`}
                >
                  <div className="text-rose-600 font-extrabold">RED</div>
                  <div>≥ 80%</div>
                </div>
                <div
                  className={`py-1.5 px-1 rounded border transition-all ${
                    tier.tier === ColorTier.TEAL
                      ? 'bg-teal-50 border-teal-300 text-teal-700 ring-2 ring-teal-400/30'
                      : 'bg-slate-50 border-slate-200 text-slate-600'
                  }`}
                >
                  <div className="text-teal-600 font-extrabold">TEAL</div>
                  <div>70-79%</div>
                </div>
                <div
                  className={`py-1.5 px-1 rounded border transition-all ${
                    tier.tier === ColorTier.GREEN
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-700 ring-2 ring-emerald-400/30'
                      : 'bg-slate-50 border-slate-200 text-slate-600'
                  }`}
                >
                  <div className="text-emerald-600 font-extrabold">GREEN</div>
                  <div>60-69%</div>
                </div>
                <div
                  className={`py-1.5 px-1 rounded border transition-all ${
                    tier.tier === ColorTier.GRAY
                      ? 'bg-slate-100 border-slate-300 text-slate-700 ring-2 ring-slate-400/30'
                      : 'bg-slate-50 border-slate-200 text-slate-600'
                  }`}
                >
                  <div className="text-slate-500 font-extrabold">GRAY</div>
                  <div>&lt; 60%</div>
                </div>
              </div>
            </div>
          </Card>

          {/* Card 2: Phân tích từ khóa (Must-have & Should-have) */}
          <Card
            className="border border-slate-200/90 shadow-sm rounded-xl bg-white"
            bodyStyle={{ padding: '20px' }}
          >
            <div className="text-xs font-extrabold uppercase tracking-wider text-slate-700 mb-3 flex items-center justify-between">
              <span>Đối soát từ khóa kỹ năng (JD Match)</span>
              <span className="text-emerald-600 font-bold">100% Tiêu chí bắt buộc</span>
            </div>

            {/* Must-have tags */}
            <div className="mb-3.5">
              <div className="text-xs font-bold text-slate-800 mb-2 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                <span>Bắt buộc có (Must-have):</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {job.mustHaveSkills.map((skill) => {
                  const isMatched = candidate.skills.some(
                    (s) => s.toLowerCase() === skill.toLowerCase()
                  );
                  return isMatched ? (
                    <Tag
                      key={skill}
                      icon={<CheckCircleFilled className="text-emerald-600 mr-1" />}
                      className="rounded-md font-semibold text-xs py-1 px-2.5 bg-emerald-50 text-emerald-800 border-emerald-300 inline-flex items-center"
                    >
                      {skill}
                    </Tag>
                  ) : (
                    <Tag
                      key={skill}
                      icon={<CloseCircleFilled className="text-rose-600 mr-1" />}
                      className="rounded-md font-semibold text-xs py-1 px-2.5 bg-rose-50 text-rose-800 border-rose-300 inline-flex items-center"
                    >
                      {skill} (Thiếu)
                    </Tag>
                  );
                })}
              </div>
            </div>

            {/* Should-have tags */}
            <div>
              <div className="text-xs font-bold text-slate-800 mb-2 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-indigo-500" />
                <span>Ưu tiên có (Should-have):</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {job.shouldHaveSkills.map((skill) => {
                  const isMatched = candidate.skills.some(
                    (s) => s.toLowerCase() === skill.toLowerCase()
                  );
                  return (
                    <Tag
                      key={skill}
                      className={`rounded-md font-medium text-xs py-0.5 px-2.5 border ${
                        isMatched
                          ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                          : 'bg-slate-50 text-slate-500 border-slate-200'
                      }`}
                    >
                      {isMatched ? `✓ ${skill}` : skill}
                    </Tag>
                  );
                })}
              </div>
            </div>
          </Card>

          {/* Card 3: Candidate Highlight KPIs */}
          <Card
            className="border border-slate-200/90 shadow-sm rounded-xl bg-white"
            bodyStyle={{ padding: '18px 20px' }}
          >
            <div className="text-xs font-extrabold uppercase tracking-wider text-slate-700 mb-3">
              Thông số tuyển dụng trọng điểm
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                <div className="text-slate-500 text-[11px] mb-0.5 flex items-center gap-1">
                  <DollarCircleOutlined /> Lương kỳ vọng
                </div>
                <div className="font-extrabold text-slate-900 text-sm tabular-nums currency-kpi">
                  {candidate.expectedSalary}
                </div>
              </div>

              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                <div className="text-slate-500 text-[11px] mb-0.5 flex items-center gap-1">
                  <ClockCircleOutlined /> Báo trước nghỉ việc
                </div>
                <div className="font-extrabold text-slate-900 text-xs truncate">
                  {candidate.noticePeriod}
                </div>
              </div>

              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                <div className="text-slate-500 text-[11px] mb-0.5 flex items-center gap-1">
                  <ThunderboltOutlined /> Số năm kinh nghiệm
                </div>
                <div className="font-extrabold text-slate-900 text-sm tabular-nums">
                  {candidate.yearsOfExperience} năm thực chiến
                </div>
              </div>

              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                <div className="text-slate-500 text-[11px] mb-0.5 flex items-center gap-1">
                  <SafetyCertificateFilled className="text-blue-500" /> Ngoại ngữ
                </div>
                <div className="font-extrabold text-slate-900 text-xs">
                  {candidate.englishLevel}
                </div>
              </div>
            </div>
          </Card>

          {/* CỤM ACTION BUTTON CỐ ĐỊNH BÊN DƯỚI */}
          <div className="sticky bottom-4 z-20 bg-white/95 backdrop-blur-md p-4 rounded-xl border border-slate-200/90 shadow-lg flex items-center gap-3">
            <Button
              danger
              onClick={() => setRejectModalOpen(true)}
              disabled={decisionState !== 'pending'}
              className="flex-1 rounded-lg font-bold h-11 border-rose-300 text-rose-600 hover:bg-rose-50"
            >
              Từ chối hồ sơ
            </Button>

            <Button
              type="primary"
              icon={<CheckCircleFilled />}
              onClick={handleApprove}
              disabled={decisionState !== 'pending'}
              className="flex-1 rounded-lg font-bold h-11 bg-emerald-600 hover:bg-emerald-700 text-white border-none shadow-sm flex items-center justify-center gap-1.5"
            >
              Duyệt phỏng vấn
            </Button>
          </div>
        </div>
      </div>

      {/* ─── Modal Từ chối hồ sơ (Lưu vết kiểm toán bắt buộc) ─────────── */}
      <Modal
        title={
          <div className="flex items-center gap-2 text-rose-600">
            <ExclamationCircleOutlined className="text-lg" />
            <span className="font-bold text-base">Từ chối hồ sơ — Lưu vết kiểm toán</span>
          </div>
        }
        open={rejectModalOpen}
        onCancel={() => setRejectModalOpen(false)}
        width={540}
        footer={[
          <Button
            key="cancel"
            onClick={() => setRejectModalOpen(false)}
            className="rounded-lg font-semibold"
          >
            Hủy bỏ
          </Button>,
          <Button
            key="submit"
            danger
            type="primary"
            onClick={handleConfirmReject}
            className="rounded-lg font-bold bg-rose-600 hover:bg-rose-700 border-none"
          >
            Xác nhận lưu kiểm toán & Từ chối
          </Button>,
        ]}
      >
        <div className="py-2">
          <Alert
            type="warning"
            showIcon
            message="Yêu cầu kiểm toán bắt buộc"
            description="Mọi quyết định từ chối ứng viên đều được gắn mã kiểm toán bất biến và gửi thông báo phản hồi lý do cụ thể đến CTV/Headhunter giới thiệu."
            className="mb-4 rounded-lg"
          />

          <div className="mb-3">
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Lý do chính từ chối hồ sơ <span className="text-rose-500">*</span>:
            </label>
            <Select
              placeholder="Chọn lý do chính..."
              className="w-full"
              value={rejectReason || undefined}
              onChange={(val) => setRejectReason(val)}
              options={REJECT_REASONS}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Ghi chú bổ sung phục vụ đối soát kiểm toán (Tùy chọn):
            </label>
            <TextArea
              rows={3}
              placeholder="Nhập phản hồi chi tiết của HR để hỗ trợ CTV nâng cao chất lượng sourcing đợt sau..."
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
              className="rounded-lg text-xs"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default AIMatchReviewer;
