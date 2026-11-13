/**
 * @file CvTemplateGalleryView.tsx
 * @description Step 1 of CV Builder ("Chọn mẫu CV") matching PDF Page 24 (100% visual fidelity)
 * and PDF Page 25 (clean A4 preview modal).
 */
import React, { useMemo, useState } from 'react';
import { Modal } from 'antd';
import type { CvLayoutStyle } from '@/types/api/cvBuilder';

export interface BuiltInCvTemplate {
  id: string;
  code: string;
  name: string;
  category: 'ats' | 'modern' | 'junior';
  tags: string[];
  layout: CvLayoutStyle;
  defaultColor: string;
  colors: string[];
  hasPhoto: boolean;
  sample: {
    fullName: string;
    headline: string;
    contact: string;
    email?: string;
    phone?: string;
    address?: string;
    summary: string;
    experiences?: Array<{
      company: string;
      period: string;
      bullets: string[];
    }>;
    education: string;
    educationPeriod?: string;
    activity?: string;
    skills: string;
    languages?: string;
    certificates?: string[];
  };
}

export const BUILTIN_CV_TEMPLATES: BuiltInCvTemplate[] = [
  {
    id: 'tpl-standard',
    code: 'STANDARD',
    name: 'Tiêu chuẩn 1 cột',
    category: 'ats',
    tags: ['ATS', '1 cột', 'Mọi ngành'],
    layout: 'ats',
    defaultColor: '#0284C7',
    colors: ['#0284C7', '#166534', '#9F1239', '#334155'],
    hasPhoto: true,
    sample: {
      fullName: 'Trần Bảo Ngọc',
      headline: 'Chuyên viên Kinh doanh',
      contact: 'baongoc@email.com · 0903 123 456 · Quận 3, Hồ Chí Minh',
      summary:
        'Hơn 4 năm kinh nghiệm phát triển khách hàng doanh nghiệp, mục tiêu trở thành Trưởng nhóm Kinh doanh trong 2 năm tới.',
      experiences: [
        {
          company: 'Công ty TNHH Minh Phát',
          period: '2022 – nay',
          bullets: [
            'Mở rộng 35 khách hàng mới, đạt 120% chỉ tiêu năm 2024.',
            'Xây dựng quy trình chăm sóc khách hàng trên CRM.',
          ],
        },
        {
          company: 'Công ty CP Thương mại An Khang',
          period: '2020 – 2022',
          bullets: ['Tư vấn sản phẩm cho khách hàng bán lẻ khu vực miền Nam.'],
        },
      ],
      education: 'Đại học Kinh tế TP.HCM – Quản trị kinh doanh',
      educationPeriod: '2016 – 2020',
      skills: 'Đàm phán, CRM (Salesforce), Excel nâng cao, tiếng Anh giao tiếp',
    },
  },
  {
    id: 'tpl-modern',
    code: 'MODERN_TWO_COL',
    name: 'Hiện đại 2 cột',
    category: 'modern',
    tags: ['Hai cột', 'Có ảnh', 'Hiện đại'],
    layout: 'modern',
    defaultColor: '#0284C7',
    colors: ['#0284C7', '#166534', '#9F1239', '#334155'],
    hasPhoto: true,
    sample: {
      fullName: 'Lê Hoàng Phúc',
      headline: 'Kỹ sư phần mềm Backend',
      contact: 'hoangphuc@email.com · 0912 888 777 · Đà Nẵng',
      email: 'hoangphuc@email.com',
      phone: '0912 888 777',
      address: 'Đà Nẵng',
      summary: 'Kỹ sư phần mềm 4 năm kinh nghiệm hệ thống thanh toán và microservices.',
      experiences: [
        {
          company: 'Senior Backend Engineer · Công ty Sao Việt',
          period: '2021 – nay',
          bullets: ['Thiết kế hệ thống thanh toán xử lý 2 triệu giao dịch/tháng.'],
        },
        {
          company: 'Backend Developer · Công ty Biển Xanh',
          period: '2018 – 2021',
          bullets: ['Phát triển API cho ứng dụng giao hàng.'],
        },
      ],
      education: 'Đại học Bách khoa Đà Nẵng · Công nghệ thông tin',
      educationPeriod: '2014 – 2018',
      skills: 'Java, Spring Boot, PostgreSQL, Docker, Kubernetes, AWS',
      languages: 'Tiếng Anh – IELTS 7.0',
    },
  },
  {
    id: 'tpl-elegant',
    code: 'ELEGANT',
    name: 'Thanh lịch (Header Banner)',
    category: 'modern',
    tags: ['Header Banner', 'Có ảnh', 'Chuyên nghiệp'],
    layout: 'elegant',
    defaultColor: '#0284C7',
    colors: ['#0284C7', '#166534', '#9F1239', '#334155'],
    hasPhoto: true,
    sample: {
      fullName: 'Đỗ Minh Quân',
      headline: 'Nhân viên Hành chính – Nhân sự',
      contact: 'minhquan@email.com · 0909 222 111 · Thủ Đức, Hồ Chí Minh',
      email: 'minhquan@email.com',
      phone: '0909 222 111',
      address: 'Thủ Đức, Hồ Chí Minh',
      summary: 'Ba năm kinh nghiệm hành chính – nhân sự, thành thạo quy trình tuyển dụng và chấm công.',
      experiences: [
        {
          company: 'Công ty CP Đất Phương Nam',
          period: '2023 – nay',
          bullets: ['Quản lý hồ sơ 150 nhân viên, phối hợp tuyển dụng 40 vị trí/năm.'],
        },
      ],
      education: 'Đại học Lao động – Xã hội · Quản trị nhân lực',
      educationPeriod: '2017 – 2021',
      skills: 'Tuyển dụng, C&B, Luật lao động, Excel nhân sự',
      languages: 'Tiếng Anh giao tiếp',
    },
  },
  {
    id: 'tpl-minimal',
    code: 'MINIMAL',
    name: 'Tối giản (Minimalist)',
    category: 'junior',
    tags: ['Tối giản', 'Đường kẻ tinh tế', 'ATS'],
    layout: 'minimal',
    defaultColor: '#0284C7',
    colors: ['#0284C7', '#166534', '#9F1239', '#334155'],
    hasPhoto: true,
    sample: {
      fullName: 'Phạm Thu Hà',
      headline: 'Thực tập sinh Kế toán',
      contact: 'thuha@email.com · 0987 654 321 · Cầu Giấy, Hà Nội',
      summary: 'Sinh viên năm cuối ngành Kế toán, mong muốn làm việc trong môi trường kiểm toán chuyên nghiệp.',
      education: 'Học viện Tài chính – Kế toán doanh nghiệp',
      educationPeriod: '2022 – 2026',
      activity: 'CLB Kế toán trẻ – Trưởng ban Sự kiện, tổ chức 4 hội thảo nghề nghiệp.',
      skills: 'MISA, Excel, tiếng Anh TOEIC 800, làm việc nhóm',
    },
  },
  {
    id: 'tpl-executive',
    code: 'EXECUTIVE',
    name: 'Chuyên nghiệp (Sidebar phải)',
    category: 'modern',
    tags: ['Sidebar phải', 'Có ảnh', 'Quản lý'],
    layout: 'executive',
    defaultColor: '#0284C7',
    colors: ['#0284C7', '#166534', '#9F1239', '#334155'],
    hasPhoto: true,
    sample: {
      fullName: 'Vũ Thanh Tâm',
      headline: 'Giáo viên Tiếng Anh',
      contact: 'thanhtam@email.com · 0938 456 789 · Bình Thạnh, Hồ Chí Minh',
      email: 'thanhtam@email.com',
      phone: '0938 456 789',
      address: 'Bình Thạnh, Hồ Chí Minh',
      summary: 'Năm năm giảng dạy luyện thi IELTS, mong muốn phát triển chương trình học cho học sinh THPT.',
      experiences: [
        {
          company: 'Trung tâm Anh ngữ Ánh Dương',
          period: '2021 – nay',
          bullets: ['Phụ trách 6 lớp IELTS, 85% học viên đạt mục tiêu.'],
        },
      ],
      education: 'Đại học Sư phạm TP.HCM · Sư phạm Tiếng Anh',
      educationPeriod: '2015 – 2019',
      skills: 'Giảng dạy IELTS, Thiết kế giáo án, Quản lý lớp học',
      languages: 'Tiếng Anh bản xứ',
      certificates: ['IELTS 8.0', 'TESOL 2024'],
    },
  },
  {
    id: 'tpl-compact',
    code: 'COMPACT',
    name: 'Sáng tạo (Timeline dọc)',
    category: 'ats',
    tags: ['Timeline', 'Sáng tạo', 'Trực quan'],
    layout: 'compact',
    defaultColor: '#0284C7',
    colors: ['#0284C7', '#166534', '#9F1239', '#334155'],
    hasPhoto: false,
    sample: {
      fullName: 'Nguyễn Gia Huy',
      headline: 'Data Analyst',
      contact: 'giahuy@email.com · 0977 111 222 · Hà Nội',
      email: 'giahuy@email.com',
      phone: '0977 111 222 · Hà Nội',
      summary: 'Ba năm phân tích dữ liệu bán lẻ bằng SQL, Python và Power BI.',
      experiences: [
        {
          company: 'Công ty Bán lẻ Hưng Thịnh',
          period: '2022 – nay',
          bullets: ['Xây dựng 12 dashboard doanh thu, giảm 30% thời gian báo cáo tuần.'],
        },
        {
          company: 'Công ty Phần mềm Gia Linh',
          period: '2021 – 2022',
          bullets: ['Làm sạch và chuẩn hóa dữ liệu khách hàng.'],
        },
      ],
      education: 'Đại học Kinh tế Quốc dân · Hệ thống thông tin',
      educationPeriod: '2017 – 2021',
      skills: 'SQL, Python (pandas), Power BI, Excel, thống kê cơ bản',
    },
  },
];

const TemplateMiniPreview: React.FC<{ template: BuiltInCvTemplate; accentColor: string }> = ({
  template,
  accentColor,
}) => {
  const { sample, layout } = template;

  // 1. MODERN: 2-column (left 36% sidebar, right 64% main)
  if (layout === 'modern') {
    return (
      <div className="flex h-full w-full flex-col overflow-hidden rounded-[6px] border border-solid border-[#E2E8F0] bg-white text-left shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        {/* Full-width header on top */}
        <div className="flex items-center gap-2.5 border-0 border-b-[1.5px] border-solid px-3 py-2 text-white" style={{ backgroundColor: accentColor, borderColor: accentColor }}>
          <div className="h-7 w-7 shrink-0 rounded-full bg-white/90" />
          <div className="min-w-0">
            <div className="truncate text-[9.5px] font-bold text-white">{sample.fullName}</div>
            <div className="truncate text-[7px] text-white/90">{sample.headline}</div>
          </div>
        </div>
        <div className="grid flex-1 grid-cols-[0.36fr_0.64fr] gap-2 p-2.5 text-[6.5px] leading-[1.35] text-[#334155]">
          {/* Left Column: Contact + Skills + Languages */}
          <div className="space-y-2 rounded-[4px] bg-[#F8FAFC] p-1.5 border border-solid border-[#E2E8F0]/70">
            <div>
              <div className="mb-0.5 font-bold uppercase tracking-wider" style={{ color: accentColor }}>LIÊN HỆ</div>
              <div className="text-[#475569]">{sample.email}<br />{sample.phone}<br />{sample.address}</div>
            </div>
            <div>
              <div className="mb-0.5 font-bold uppercase tracking-wider" style={{ color: accentColor }}>KỸ NĂNG</div>
              <div className="text-[#475569]">{sample.skills}</div>
            </div>
            {sample.languages && (
              <div>
                <div className="mb-0.5 font-bold uppercase tracking-wider" style={{ color: accentColor }}>NGOẠI NGỮ</div>
                <div className="text-[#475569]">{sample.languages}</div>
              </div>
            )}
          </div>
          {/* Right Column: Summary + Experience + Education */}
          <div className="space-y-2">
            <div>
              <div className="mb-0.5 font-bold uppercase tracking-wider" style={{ color: accentColor }}>MỤC TIÊU</div>
              <div className="text-[#475569]">{sample.summary}</div>
            </div>
            <div>
              <div className="mb-0.5 font-bold uppercase tracking-wider" style={{ color: accentColor }}>KINH NGHIỆM</div>
              {sample.experiences?.map((exp, idx) => (
                <div key={idx} className="mb-1">
                  <div className="font-bold text-[#0F172A]">{exp.company}</div>
                  <div className="text-[6px] text-[#64748B]">{exp.period}</div>
                  {exp.bullets.map((b, bIdx) => (
                    <div key={bIdx} className="text-[#334155]">• {b}</div>
                  ))}
                </div>
              ))}
            </div>
            <div>
              <div className="mb-0.5 font-bold uppercase tracking-wider" style={{ color: accentColor }}>HỌC VẤN</div>
              <div className="font-semibold text-[#0F172A]">{sample.education}</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 2. EXECUTIVE: Reversed 2-column (left 64% main, right 36% sidebar)
  if (layout === 'executive') {
    return (
      <div className="flex h-full w-full flex-col overflow-hidden rounded-[6px] border border-solid border-[#E2E8F0] bg-white text-left shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        {/* Full-width header on top */}
        <div className="flex items-center gap-2.5 border-0 border-b-[2px] border-solid bg-slate-50 px-3 py-2 text-left" style={{ borderColor: accentColor }}>
          <div className="h-7 w-7 shrink-0 rounded-full bg-slate-200" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-[9.5px] font-bold text-[#0F172A]">{sample.fullName}</div>
            <div className="truncate text-[7px] font-semibold" style={{ color: accentColor }}>{sample.headline}</div>
          </div>
        </div>
        <div className="grid flex-1 grid-cols-[0.64fr_0.36fr] gap-2 p-2.5 text-[6.5px] leading-[1.35] text-[#334155]">
          {/* Left Column: Main content */}
          <div className="space-y-2">
            <div>
              <div className="mb-0.5 font-bold uppercase tracking-wider" style={{ color: accentColor }}>MỤC TIÊU</div>
              <div className="text-[#475569]">{sample.summary}</div>
            </div>
            <div>
              <div className="mb-0.5 font-bold uppercase tracking-wider" style={{ color: accentColor }}>KINH NGHIỆM</div>
              {sample.experiences?.map((exp, idx) => (
                <div key={idx} className="mb-1">
                  <div className="font-bold text-[#0F172A]">{exp.company}</div>
                  <div className="text-[6px] text-[#64748B]">{exp.period}</div>
                  {exp.bullets.map((b, bIdx) => (
                    <div key={bIdx} className="text-[#475569]">• {b}</div>
                  ))}
                </div>
              ))}
            </div>
            <div>
              <div className="mb-0.5 font-bold uppercase tracking-wider" style={{ color: accentColor }}>HỌC VẤN</div>
              <div className="font-semibold text-[#0F172A]">{sample.education}</div>
            </div>
          </div>
          {/* Right Column: Sidebar */}
          <div className="space-y-2 rounded-[4px] border-0 border-l border-solid border-[#CBD5E1] pl-2">
            <div>
              <div className="mb-0.5 font-bold uppercase tracking-wider" style={{ color: accentColor }}>KỸ NĂNG</div>
              <div className="text-[#475569]">{sample.skills}</div>
            </div>
            {sample.languages && (
              <div>
                <div className="mb-0.5 font-bold uppercase tracking-wider" style={{ color: accentColor }}>NGOẠI NGỮ</div>
                <div className="text-[#475569]">{sample.languages}</div>
              </div>
            )}
            {sample.certificates && sample.certificates.length > 0 && (
              <div>
                <div className="mb-0.5 font-bold uppercase tracking-wider" style={{ color: accentColor }}>CHỨNG CHỈ</div>
                <div className="text-[#475569]">{sample.certificates.join(', ')}</div>
              </div>
            )}
            <div>
              <div className="mb-0.5 font-bold uppercase tracking-wider" style={{ color: accentColor }}>LIÊN HỆ</div>
              <div className="text-[#475569]">{sample.email}<br />{sample.phone}</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 3. ELEGANT: Full-width Header Banner
  if (layout === 'elegant') {
    return (
      <div className="flex h-full w-full flex-col overflow-hidden rounded-[6px] border border-solid border-[#E2E8F0] bg-white text-left shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        {/* Full-width colored banner */}
        <div className="flex items-center gap-2.5 px-3 py-3 text-white" style={{ backgroundColor: accentColor }}>
          <div className="h-8 w-8 shrink-0 rounded-full border-2 border-solid border-white/90 bg-white/20" />
          <div className="min-w-0">
            <div className="truncate text-[10px] font-bold text-white">{sample.fullName}</div>
            <div className="truncate text-[7.5px] text-white/90">{sample.headline}</div>
            <div className="truncate text-[5.8px] text-white/80">{sample.contact}</div>
          </div>
        </div>
        <div className="space-y-2 p-2.5 text-[6.5px] leading-[1.35] text-[#334155]">
          <div>
            <div className="mb-0.5 text-center font-bold uppercase tracking-wider" style={{ color: accentColor }}>MỤC TIÊU NGHỀ NGHIỆP</div>
            <div className="text-center text-[#475569]">{sample.summary}</div>
          </div>
          <div>
            <div className="mb-0.5 text-center font-bold uppercase tracking-wider" style={{ color: accentColor }}>KINH NGHIỆM LÀM VIỆC</div>
            {sample.experiences?.map((exp, idx) => (
              <div key={idx} className="mb-1">
                <div className="flex items-baseline justify-between font-bold text-[#0F172A]">
                  <span>{exp.company}</span>
                  <span className="font-normal text-[#64748B]">{exp.period}</span>
                </div>
                {exp.bullets.map((b, bIdx) => (
                  <div key={bIdx} className="text-[#334155]">• {b}</div>
                ))}
              </div>
            ))}
          </div>
          <div>
            <div className="mb-0.5 text-center font-bold uppercase tracking-wider" style={{ color: accentColor }}>HỌC VẤN</div>
            <div className="flex items-baseline justify-between font-bold text-[#0F172A]">
              <span>{sample.education}</span>
              <span className="font-normal text-[#64748B]">{sample.educationPeriod}</span>
            </div>
          </div>
          <div>
            <div className="mb-0.5 text-center font-bold uppercase tracking-wider" style={{ color: accentColor }}>KỸ NĂNG</div>
            <div className="text-center text-[#334155]">{sample.skills}</div>
          </div>
        </div>
      </div>
    );
  }

  // 4. COMPACT: Creative Timeline
  if (layout === 'compact') {
    return (
      <div className="flex h-full w-full flex-col overflow-hidden rounded-[6px] border border-solid border-[#E2E8F0] bg-white p-3 text-left text-[6.5px] leading-[1.35] text-[#334155] shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <div className="mb-2 flex items-start justify-between border-0 border-b border-solid pb-1.5" style={{ borderColor: accentColor }}>
          <div>
            <div className="text-[10px] font-bold text-[#0F172A]">{sample.fullName}</div>
            <div className="text-[7px] font-semibold" style={{ color: accentColor }}>{sample.headline}</div>
          </div>
          <div className="text-right text-[6px] text-[#64748B]">
            {sample.email}<br />{sample.phone}
          </div>
        </div>
        <div className="space-y-2">
          <div>
            <div className="mb-0.5 font-bold uppercase tracking-wider" style={{ color: accentColor }}>MỤC TIÊU NGHỀ NGHIỆP</div>
            <div className="text-[#475569]">{sample.summary}</div>
          </div>
          <div>
            <div className="mb-1 font-bold uppercase tracking-wider" style={{ color: accentColor }}>KINH NGHIỆM (TIMELINE)</div>
            <div className="relative space-y-1.5 border-0 border-l-[1.5px] border-solid pl-2.5" style={{ borderColor: accentColor }}>
              {sample.experiences?.map((exp, idx) => (
                <div key={idx} className="relative">
                  {/* Timeline dot */}
                  <span
                    className="absolute -left-[14px] top-1 h-2 w-2 rounded-full border border-solid border-white"
                    style={{ backgroundColor: accentColor }}
                  />
                  <div className="font-bold text-[#0F172A]">{exp.company}</div>
                  <div className="text-[6px] text-[#64748B]">{exp.period}</div>
                  {exp.bullets.map((b, bIdx) => (
                    <div key={bIdx} className="text-[#475569]">• {b}</div>
                  ))}
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className="mb-1 font-bold uppercase tracking-wider" style={{ color: accentColor }}>HỌC VẤN</div>
            <div className="relative border-0 border-l-[1.5px] border-solid pl-2.5" style={{ borderColor: accentColor }}>
              <span
                className="absolute -left-[14px] top-1 h-2 w-2 rounded-full border border-solid border-white"
                style={{ backgroundColor: accentColor }}
              />
              <div className="font-semibold text-[#0F172A]">{sample.education}</div>
              <div className="text-[6px] text-[#64748B]">{sample.educationPeriod}</div>
            </div>
          </div>
          <div>
            <div className="mb-0.5 font-bold uppercase tracking-wider" style={{ color: accentColor }}>KỸ NĂNG</div>
            <div>{sample.skills}</div>
          </div>
        </div>
      </div>
    );
  }

  // 5. MINIMAL: Minimalist with hairline dividers
  if (layout === 'minimal') {
    return (
      <div className="flex h-full w-full flex-col overflow-hidden rounded-[6px] border border-solid border-[#E2E8F0] bg-white p-3 text-left text-[6.5px] leading-[1.35] text-[#334155] shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <div className="mb-2 flex items-center gap-2 border-0 border-b border-solid border-[#F1F5F9] pb-2">
          <div className="h-8 w-8 shrink-0 rounded-full bg-[#E2E8F0]" />
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-bold text-[#0F172A]">{sample.fullName}</div>
            <div className="text-[7px] text-[#64748B]">{sample.headline}</div>
            <div className="truncate text-[5.8px] text-[#94A3B8]">{sample.contact}</div>
          </div>
        </div>
        <div className="space-y-1.5">
          <div className="border-0 border-b border-solid border-[#F1F5F9] pb-1.5">
            <div className="mb-0.5 font-semibold uppercase tracking-wider text-[#0F172A]">MỤC TIÊU NGHỀ NGHIỆP</div>
            <div className="text-[#475569]">{sample.summary}</div>
          </div>
          <div className="border-0 border-b border-solid border-[#F1F5F9] pb-1.5">
            <div className="mb-0.5 font-semibold uppercase tracking-wider text-[#0F172A]">HỌC VẤN</div>
            <div className="font-medium text-[#0F172A]">{sample.education}</div>
          </div>
          {sample.activity && (
            <div className="border-0 border-b border-solid border-[#F1F5F9] pb-1.5">
              <div className="mb-0.5 font-semibold uppercase tracking-wider text-[#0F172A]">HOẠT ĐỘNG</div>
              <div className="text-[#475569]">{sample.activity}</div>
            </div>
          )}
          <div>
            <div className="mb-0.5 font-semibold uppercase tracking-wider text-[#0F172A]">KỸ NĂNG</div>
            <div className="text-[#475569]">{sample.skills}</div>
          </div>
        </div>
      </div>
    );
  }

  // 6. ATS / STANDARD: Classic 1-column layout
  return (
    <div className="flex h-full w-full flex-col overflow-hidden rounded-[6px] border border-solid border-[#E2E8F0] bg-white p-3.5 text-left text-[6.5px] leading-[1.35] text-[#334155] shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="mb-2 flex items-center gap-2.5 border-0 border-b-[1.5px] border-solid pb-2" style={{ borderColor: accentColor }}>
        <div className="h-9 w-8 shrink-0 rounded-[3px] bg-[#E2E8F0]" />
        <div className="min-w-0 flex-1 text-center">
          <div className="text-[10px] font-bold text-[#0F172A]">{sample.fullName}</div>
          <div className="text-[7px] font-semibold" style={{ color: accentColor }}>{sample.headline}</div>
          <div className="truncate text-[5.8px] text-[#64748B]">{sample.contact}</div>
        </div>
      </div>
      <div className="space-y-1.5">
        <div>
          <div className="mb-0.5 text-center font-bold uppercase tracking-wider" style={{ color: accentColor }}>MỤC TIÊU NGHỀ NGHIỆP</div>
          <div className="text-center text-[#334155]">{sample.summary}</div>
        </div>
        <div>
          <div className="mb-0.5 text-center font-bold uppercase tracking-wider" style={{ color: accentColor }}>KINH NGHIỆM LÀM VIỆC</div>
          {sample.experiences?.map((exp, idx) => (
            <div key={idx} className="mb-1">
              <div className="flex items-baseline justify-between font-bold text-[#0F172A]">
                <span>{exp.company}</span>
                <span className="font-normal text-[#64748B]">{exp.period}</span>
              </div>
              {exp.bullets.map((b, bIdx) => (
                <div key={bIdx} className="pl-1 text-[#334155]">• {b}</div>
              ))}
            </div>
          ))}
        </div>
        <div>
          <div className="mb-0.5 text-center font-bold uppercase tracking-wider" style={{ color: accentColor }}>HỌC VẤN</div>
          <div className="flex items-baseline justify-between font-bold text-[#0F172A]">
            <span>{sample.education}</span>
            <span className="font-normal text-[#64748B]">{sample.educationPeriod}</span>
          </div>
        </div>
        <div>
          <div className="mb-0.5 text-center font-bold uppercase tracking-wider" style={{ color: accentColor }}>KỸ NĂNG</div>
          <div className="text-center text-[#334155]">{sample.skills}</div>
        </div>
      </div>
    </div>
  );
};

/** Full A4 Sample Sheet matching template layout */
export const CvSampleSheetPreview: React.FC<{ template: BuiltInCvTemplate; accentColor: string }> = ({
  template,
  accentColor,
}) => {
  const { sample, layout } = template;
  const isElegant = layout === 'elegant';

  return (
    <div
      className={`mx-auto w-full max-w-[780px] rounded-[8px] bg-white font-['Be_Vietnam_Pro',system-ui,sans-serif] text-[#0F172A] shadow-sm ${
        isElegant ? 'overflow-hidden p-0' : 'p-8 sm:p-12'
      }`}
    >
      {/* Header */}
      {isElegant ? (
        <div className="p-8 sm:p-10 text-white" style={{ backgroundColor: accentColor }}>
          <div className="flex items-center gap-6">
            {template.hasPhoto && (
              <div className="h-[104px] w-[90px] shrink-0 rounded-[8px] border-2 border-solid border-white/80 bg-white/20" />
            )}
            <div>
              <h2 className="m-0 text-[28px] font-bold leading-tight text-white">{sample.fullName}</h2>
              <p className="m-0 mt-1 text-[16px] font-medium text-white/90">{sample.headline}</p>
              <p className="m-0 mt-2 text-[13px] text-white/80">{sample.contact}</p>
            </div>
          </div>
        </div>
      ) : (
        <div
          className="mb-6 flex items-center gap-6 border-0 border-b-[2px] border-solid pb-6"
          style={{ borderColor: accentColor }}
        >
          {template.hasPhoto && (
            <div className="h-[104px] w-[90px] shrink-0 rounded-[6px] bg-[#E2E8F0]" />
          )}
          <div>
            <h2 className="m-0 text-[28px] font-bold leading-tight text-[#0F172A]">{sample.fullName}</h2>
            <p className="m-0 mt-1 text-[16px] font-semibold" style={{ color: accentColor }}>
              {sample.headline}
            </p>
            <p className="m-0 mt-2 text-[13px] text-[#475569]">{sample.contact}</p>
          </div>
        </div>
      )}

      {/* Body Content */}
      <div className={isElegant ? 'p-8 sm:p-10' : ''}>
        {layout === 'modern' ? (
          <div className="grid grid-cols-1 gap-8 md:grid-cols-[0.35fr_0.65fr] text-[14px] leading-[1.6]">
            {/* Left sidebar */}
            <div className="space-y-5 rounded-[8px] bg-slate-50 p-4 border border-solid border-slate-200">
              <section>
                <h3 className="m-0 mb-1.5 text-[13px] font-bold uppercase tracking-wide" style={{ color: accentColor }}>
                  KỸ NĂNG
                </h3>
                <p className="m-0 text-[13px] text-[#334155]">{sample.skills}</p>
              </section>
              {sample.languages && (
                <section>
                  <h3 className="m-0 mb-1.5 text-[13px] font-bold uppercase tracking-wide" style={{ color: accentColor }}>
                    NGOẠI NGỮ
                  </h3>
                  <p className="m-0 text-[13px] text-[#334155]">{sample.languages}</p>
                </section>
              )}
            </div>
            {/* Right main */}
            <div className="space-y-5">
              <section>
                <h3 className="m-0 mb-1.5 text-[13px] font-bold uppercase tracking-wide" style={{ color: accentColor }}>
                  MỤC TIÊU NGHỀ NGHIỆP
                </h3>
                <p className="m-0 text-[#1E293B]">{sample.summary}</p>
              </section>
              {sample.experiences && (
                <section>
                  <h3 className="m-0 mb-2 text-[13px] font-bold uppercase tracking-wide" style={{ color: accentColor }}>
                    KINH NGHIỆM LÀM VIỆC
                  </h3>
                  <div className="space-y-3.5">
                    {sample.experiences.map((exp, idx) => (
                      <div key={idx}>
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <strong className="font-bold text-[#0F172A]">{exp.company}</strong>
                          {exp.period && <span className="text-[13px] text-[#64748B]">{exp.period}</span>}
                        </div>
                        <ul className="m-0 mt-1 list-disc space-y-1 pl-5 text-[#334155]">
                          {exp.bullets.map((b, bIdx) => (
                            <li key={bIdx}>{b}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </section>
              )}
              <section>
                <h3 className="m-0 mb-1.5 text-[13px] font-bold uppercase tracking-wide" style={{ color: accentColor }}>
                  HỌC VẤN
                </h3>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <strong className="font-bold text-[#0F172A]">{sample.education}</strong>
                  {sample.educationPeriod && (
                    <span className="text-[13px] text-[#64748B]">{sample.educationPeriod}</span>
                  )}
                </div>
              </section>
            </div>
          </div>
        ) : layout === 'executive' ? (
          <div className="grid grid-cols-1 gap-8 md:grid-cols-[0.65fr_0.35fr] text-[14px] leading-[1.6]">
            {/* Left main */}
            <div className="space-y-5">
              <section>
                <h3 className="m-0 mb-1.5 text-[13px] font-bold uppercase tracking-wide" style={{ color: accentColor }}>
                  MỤC TIÊU NGHỀ NGHIỆP
                </h3>
                <p className="m-0 text-[#1E293B]">{sample.summary}</p>
              </section>
              {sample.experiences && (
                <section>
                  <h3 className="m-0 mb-2 text-[13px] font-bold uppercase tracking-wide" style={{ color: accentColor }}>
                    KINH NGHIỆM LÀM VIỆC
                  </h3>
                  <div className="space-y-3.5">
                    {sample.experiences.map((exp, idx) => (
                      <div key={idx}>
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <strong className="font-bold text-[#0F172A]">{exp.company}</strong>
                          {exp.period && <span className="text-[13px] text-[#64748B]">{exp.period}</span>}
                        </div>
                        <ul className="m-0 mt-1 list-disc space-y-1 pl-5 text-[#334155]">
                          {exp.bullets.map((b, bIdx) => (
                            <li key={bIdx}>{b}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </section>
              )}
              <section>
                <h3 className="m-0 mb-1.5 text-[13px] font-bold uppercase tracking-wide" style={{ color: accentColor }}>
                  HỌC VẤN
                </h3>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <strong className="font-bold text-[#0F172A]">{sample.education}</strong>
                  {sample.educationPeriod && (
                    <span className="text-[13px] text-[#64748B]">{sample.educationPeriod}</span>
                  )}
                </div>
              </section>
            </div>
            {/* Right sidebar */}
            <div className="space-y-5 rounded-[8px] border-0 border-l-2 border-solid border-slate-200 pl-5">
              <section>
                <h3 className="m-0 mb-1.5 text-[13px] font-bold uppercase tracking-wide" style={{ color: accentColor }}>
                  KỸ NĂNG
                </h3>
                <p className="m-0 text-[13px] text-[#334155]">{sample.skills}</p>
              </section>
              {sample.languages && (
                <section>
                  <h3 className="m-0 mb-1.5 text-[13px] font-bold uppercase tracking-wide" style={{ color: accentColor }}>
                    NGOẠI NGỮ
                  </h3>
                  <p className="m-0 text-[13px] text-[#334155]">{sample.languages}</p>
                </section>
              )}
              {sample.certificates && sample.certificates.length > 0 && (
                <section>
                  <h3 className="m-0 mb-1.5 text-[13px] font-bold uppercase tracking-wide" style={{ color: accentColor }}>
                    CHỨNG CHỈ
                  </h3>
                  <p className="m-0 text-[13px] text-[#334155]">{sample.certificates.join(', ')}</p>
                </section>
              )}
            </div>
          </div>
        ) : layout === 'compact' ? (
          <div className="space-y-5 text-[14px] leading-[1.6] text-[#1E293B]">
            <section>
              <h3 className="m-0 mb-1.5 text-[13px] font-bold uppercase tracking-wide" style={{ color: accentColor }}>
                MỤC TIÊU NGHỀ NGHIỆP
              </h3>
              <p className="m-0">{sample.summary}</p>
            </section>
            {sample.experiences && (
              <section>
                <h3 className="m-0 mb-3 text-[13px] font-bold uppercase tracking-wide" style={{ color: accentColor }}>
                  KINH NGHIỆM LÀM VIỆC (TIMELINE)
                </h3>
                <div className="relative space-y-4 border-0 border-l-2 border-solid pl-4" style={{ borderColor: accentColor }}>
                  {sample.experiences.map((exp, idx) => (
                    <div key={idx} className="relative">
                      <span
                        className="absolute -left-[23px] top-1.5 h-3.5 w-3.5 rounded-full border-2 border-solid border-white shadow-xs"
                        style={{ backgroundColor: accentColor }}
                      />
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <strong className="font-bold text-[#0F172A]">{exp.company}</strong>
                        {exp.period && <span className="text-[13px] text-[#64748B]">{exp.period}</span>}
                      </div>
                      <ul className="m-0 mt-1 list-disc space-y-1 pl-5">
                        {exp.bullets.map((b, bIdx) => (
                          <li key={bIdx}>{b}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </section>
            )}
            <section>
              <h3 className="m-0 mb-3 text-[13px] font-bold uppercase tracking-wide" style={{ color: accentColor }}>
                HỌC VẤN
              </h3>
              <div className="relative border-0 border-l-2 border-solid pl-4" style={{ borderColor: accentColor }}>
                <span
                  className="absolute -left-[23px] top-1.5 h-3.5 w-3.5 rounded-full border-2 border-solid border-white shadow-xs"
                  style={{ backgroundColor: accentColor }}
                />
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <strong className="font-bold text-[#0F172A]">{sample.education}</strong>
                  {sample.educationPeriod && (
                    <span className="text-[13px] text-[#64748B]">{sample.educationPeriod}</span>
                  )}
                </div>
              </div>
            </section>
            <section>
              <h3 className="m-0 mb-1.5 text-[13px] font-bold uppercase tracking-wide" style={{ color: accentColor }}>
                KỸ NĂNG
              </h3>
              <p className="m-0">{sample.skills}</p>
            </section>
          </div>
        ) : (
          /* Default ATS / Standard & Minimal */
          <div className="space-y-5 text-[14px] leading-[1.6] text-[#1E293B]">
            <section>
              <h3 className="m-0 mb-1.5 text-[13px] font-bold uppercase tracking-wide" style={{ color: accentColor }}>
                MỤC TIÊU NGHỀ NGHIỆP
              </h3>
              <p className="m-0">{sample.summary}</p>
            </section>

            {sample.experiences && sample.experiences.length > 0 && (
              <section>
                <h3 className="m-0 mb-2 text-[13px] font-bold uppercase tracking-wide" style={{ color: accentColor }}>
                  KINH NGHIỆM LÀM VIỆC
                </h3>
                <div className="space-y-3.5">
                  {sample.experiences.map((exp, idx) => (
                    <div key={idx}>
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <strong className="font-bold text-[#0F172A]">{exp.company}</strong>
                        {exp.period && <span className="text-[13px] text-[#64748B]">{exp.period}</span>}
                      </div>
                      <ul className="m-0 mt-1 list-disc space-y-1 pl-5">
                        {exp.bullets.map((b, bIdx) => (
                          <li key={bIdx}>{b}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section>
              <h3 className="m-0 mb-1.5 text-[13px] font-bold uppercase tracking-wide" style={{ color: accentColor }}>
                HỌC VẤN
              </h3>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <strong className="font-bold text-[#0F172A]">{sample.education}</strong>
                {sample.educationPeriod && (
                  <span className="text-[13px] text-[#64748B]">{sample.educationPeriod}</span>
                )}
              </div>
            </section>

            {sample.activity && (
              <section>
                <h3 className="m-0 mb-1.5 text-[13px] font-bold uppercase tracking-wide" style={{ color: accentColor }}>
                  HOẠT ĐỘNG
                </h3>
                <p className="m-0">{sample.activity}</p>
              </section>
            )}

            <section>
              <h3 className="m-0 mb-1.5 text-[13px] font-bold uppercase tracking-wide" style={{ color: accentColor }}>
                KỸ NĂNG
              </h3>
              <p className="m-0">{sample.skills}</p>
            </section>
          </div>
        )}
      </div>
    </div>
  );
};

export interface CvTemplateGalleryViewProps {
  selectedTemplateCode: string;
  selectedColor: string;
  onSelectTemplateAndContinue: (template: BuiltInCvTemplate, color: string) => void;
  onJumpToEditor: () => void;
}

export const CvTemplateGalleryView: React.FC<CvTemplateGalleryViewProps> = ({
  selectedTemplateCode,
  selectedColor,
  onSelectTemplateAndContinue,
  onJumpToEditor,
}) => {
  const [category, setCategory] = useState<'all' | 'ats' | 'modern' | 'junior'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [cardColors, setCardColors] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    BUILTIN_CV_TEMPLATES.forEach((t) => {
      init[t.id] = selectedColor || t.defaultColor;
    });
    return init;
  });
  const [previewTemplate, setPreviewTemplate] = useState<BuiltInCvTemplate | null>(null);

  const filteredTemplates = useMemo(() => {
    return BUILTIN_CV_TEMPLATES.filter((tpl) => {
      if (category !== 'all' && tpl.category !== category) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          tpl.name.toLowerCase().includes(q) ||
          tpl.tags.some((t) => t.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [category, searchQuery]);

  const categories: Array<{ key: 'all' | 'ats' | 'modern' | 'junior'; label: string }> = [
    { key: 'all', label: 'Tất cả' },
    { key: 'ats', label: 'Chuẩn ATS' },
    { key: 'modern', label: 'Hiện đại' },
    { key: 'junior', label: 'Ít kinh nghiệm' },
  ];

  return (
    <div className="min-h-full w-full flex-1 bg-[#F7F8FA] font-['Be_Vietnam_Pro',system-ui,sans-serif] text-[#0F172A]">
      <div className="mx-auto max-w-[1248px] px-4 py-6 pb-24 sm:px-6 lg:px-8 lg:py-7">
        {/* Stepper (1 Chọn mẫu — 2 Điền nội dung — 3 Tải PDF hoặc lưu vào Kho CV) */}
        <div className="mb-5 flex flex-wrap items-center gap-2.5 text-[13px]">
          <div className="flex items-center gap-2 font-semibold text-sky-700">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#0369A1] text-[12px] font-bold text-white shadow-xs">
              1
            </span>
            <span>Chọn mẫu</span>
          </div>
          <span className="h-px w-4 bg-[#CBD5E1]" aria-hidden="true" />
          <button
            type="button"
            onClick={onJumpToEditor}
            className="flex cursor-pointer items-center gap-2 border-0 bg-transparent p-0 text-[13px] font-normal text-[#475569] transition-colors duration-200 hover:text-sky-700"
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-full border border-solid border-[#CBD5E1] bg-white text-[12px] font-semibold text-[#475569]">
              2
            </span>
            <span>Điền nội dung</span>
          </button>
          <span className="h-px w-4 bg-[#CBD5E1]" aria-hidden="true" />
          <div className="flex items-center gap-2 text-[#475569]">
            <span className="flex h-6 w-6 items-center justify-center rounded-full border border-solid border-[#CBD5E1] bg-white text-[12px] font-semibold text-[#475569]">
              3
            </span>
            <span>Tải PDF hoặc lưu vào Kho CV</span>
          </div>
        </div>

        {/* Title & Search Bar */}
        <div className="mb-4 flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div>
            <h1 className="m-0 text-[24px] font-bold leading-[1.25] tracking-[-0.01em] text-[#0F172A]">
              Chọn mẫu CV
            </h1>
            <p className="m-0 mt-1.5 text-[14px] text-[#475569]">
              Thông tin trong hồ sơ của bạn được điền sẵn vào mẫu. Đổi mẫu bất cứ lúc nào mà không mất nội dung.
            </p>
          </div>

          <div className="relative w-full sm:w-[260px]">
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#64748B"
              strokeWidth="2"
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-3.5-3.5" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm theo tên mẫu"
              aria-label="Tìm theo tên mẫu"
              className="h-[40px] w-full rounded-[8px] border border-solid border-[#CBD5E1] bg-white pl-9 pr-3.5 font-['Be_Vietnam_Pro',system-ui,sans-serif] text-[13px] text-[#0F172A] outline-none transition-all duration-200 placeholder:text-[#94A3B8] focus:border-[#0284C7] focus:ring-2 focus:ring-[#0284C7]/15"
            />
          </div>
        </div>

        {/* Category Filter Pills */}
        <div className="mb-6 flex flex-wrap items-center gap-2">
          {categories.map((cat) => {
            const active = category === cat.key;
            return (
              <button
                key={cat.key}
                type="button"
                onClick={() => setCategory(cat.key)}
                className={`h-[36px] cursor-pointer rounded-[8px] px-4 font-['Be_Vietnam_Pro',system-ui,sans-serif] text-[13px] font-medium transition-all duration-200 focus:outline-none ${
                  active
                    ? 'border border-solid border-sky-600 bg-[#0369A1] font-semibold text-white shadow-xs'
                    : 'border border-solid border-[#CBD5E1] bg-white text-[#334155] hover:border-[#94A3B8] hover:bg-[#F8FAFC]'
                }`}
              >
                {cat.label}
              </button>
            );
          })}
        </div>

        {/* 3x2 Template Grid */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filteredTemplates.map((tpl) => {
            const isSelected =
              tpl.code === selectedTemplateCode ||
              (tpl.code.startsWith('MODERN') && selectedTemplateCode.startsWith('MODERN'));
            const currentColor = cardColors[tpl.id] || tpl.defaultColor;

            return (
              <article
                key={tpl.id}
                className={`flex flex-col rounded-[12px] bg-white p-3.5 transition-all duration-200 hover:shadow-[0_8px_24px_rgba(15,23,42,0.06)] ${
                  isSelected
                    ? 'border-2 border-solid border-[#0284C7]'
                    : 'border border-solid border-[#E2E8F0]'
                }`}
              >
                {/* Miniature A4 Container */}
                <div className="mb-3.5 h-[310px] w-full rounded-[8px] bg-[#F1F5F9] p-3">
                  <TemplateMiniPreview template={tpl} accentColor={currentColor} />
                </div>

                {/* Color Swatches */}
                <div className="mb-2.5 flex items-center gap-2">
                  {tpl.colors.map((color) => {
                    const activeColor = currentColor.toLowerCase() === color.toLowerCase();
                    return (
                      <button
                        key={color}
                        type="button"
                        aria-label={`Màu ${color}`}
                        onClick={() => setCardColors((prev) => ({ ...prev, [tpl.id]: color }))}
                        className={`h-5 w-5 cursor-pointer rounded-full border-0 p-0 transition-transform duration-150 ${
                          activeColor
                            ? 'ring-2 ring-sky-600 ring-offset-2'
                            : 'hover:scale-110'
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    );
                  })}
                </div>

                {/* Template Name */}
                <h2 className="m-0 text-[16px] font-bold text-[#0F172A]">{tpl.name}</h2>

                {/* Tags */}
                <div className="mt-2 mb-4 flex flex-wrap gap-1.5">
                  {tpl.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-[#F1F5F9] px-2.5 py-0.5 text-[11px] font-medium text-[#475569]"
                    >
                      {tag}
                    </span>
                  ))}
                </div>

                {/* Actions: Xem trước + Dùng mẫu này */}
                <div className="mt-auto grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setPreviewTemplate(tpl)}
                    className="h-[38px] cursor-pointer rounded-[8px] border border-solid border-[#CBD5E1] bg-white font-['Be_Vietnam_Pro',system-ui,sans-serif] text-[13px] font-semibold text-[#0F172A] transition-all duration-200 hover:border-[#94A3B8] hover:bg-[#F8FAFC]"
                  >
                    Xem trước
                  </button>
                  <button
                    type="button"
                    onClick={() => onSelectTemplateAndContinue(tpl, currentColor)}
                    className="h-[38px] cursor-pointer rounded-[8px] border-0 bg-[#0369A1] font-['Be_Vietnam_Pro',system-ui,sans-serif] text-[13px] font-semibold text-white shadow-sm shadow-sky-500/20 transition-all duration-200 hover:bg-[#075985] active:scale-[0.99]"
                  >
                    Dùng mẫu này
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </div>

      {/* Preview Modal (PDF Page 25) */}
      <Modal
        open={Boolean(previewTemplate)}
        onCancel={() => setPreviewTemplate(null)}
        width={860}
        centered
        title={previewTemplate ? `Xem trước mẫu: ${previewTemplate.name}` : 'Xem trước mẫu CV'}
        footer={
          previewTemplate ? (
            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setPreviewTemplate(null)}
                className="h-9 cursor-pointer rounded-[8px] border border-solid border-[#CBD5E1] bg-white px-4 font-['Be_Vietnam_Pro',system-ui,sans-serif] text-[13px] font-semibold text-[#334155] hover:bg-[#F8FAFC]"
              >
                Đóng
              </button>
              <button
                type="button"
                onClick={() => {
                  const chosen = previewTemplate;
                  const chosenColor = cardColors[chosen.id] || chosen.defaultColor;
                  setPreviewTemplate(null);
                  onSelectTemplateAndContinue(chosen, chosenColor);
                }}
                className="h-9 cursor-pointer rounded-[8px] border-0 bg-[#0369A1] px-4 font-['Be_Vietnam_Pro',system-ui,sans-serif] text-[13px] font-semibold text-white shadow-sm hover:bg-[#075985]"
              >
                Dùng mẫu này
              </button>
            </div>
          ) : null
        }
      >
        {previewTemplate && (
          <div className="max-h-[78vh] overflow-y-auto rounded-[8px] bg-[#F1F5F9] p-4 sm:p-6">
            <CvSampleSheetPreview
              template={previewTemplate}
              accentColor={cardColors[previewTemplate.id] || previewTemplate.defaultColor}
            />
          </div>
        )}
      </Modal>
    </div>
  );
};

export default CvTemplateGalleryView;
