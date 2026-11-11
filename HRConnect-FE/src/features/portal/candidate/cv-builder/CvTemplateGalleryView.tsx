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
    name: 'Tiêu chuẩn',
    category: 'ats',
    tags: ['ATS', 'Đơn giản', 'Mọi ngành'],
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
    code: 'MODERN',
    name: 'Hai cột hiện đại',
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
      education: 'Đại học Bách khoa Đà Nẵng · Công nghệ thông tin, 2014 – 2018',
      skills: 'Java, Spring Boot, PostgreSQL, Docker, Kubernetes, AWS',
      languages: 'Tiếng Anh – IELTS 7.0',
    },
  },
  {
    id: 'tpl-fresh-grad',
    code: 'MINIMAL',
    name: 'Sinh viên mới ra trường',
    category: 'junior',
    tags: ['Ít kinh nghiệm', 'Có ảnh'],
    layout: 'minimal',
    defaultColor: '#0284C7',
    colors: ['#0284C7', '#166534', '#9F1239', '#334155'],
    hasPhoto: true,
    sample: {
      fullName: 'Phạm Thu Hà',
      headline: 'Thực tập sinh Kế toán',
      contact: 'thuha@email.com · 0987 654 321 · Cầu Giấy, Hà Nội',
      summary: 'Sinh viên năm cuối ngành Kế toán, mong muốn làm việc trong môi trường kiểm toán chuyên nghiệp.',
      education: 'Học viện Tài chính – Kế toán doanh nghiệp, 2022 – 2026 · GPA 3.6/4',
      activity: 'CLB Kế toán trẻ – Trưởng ban Sự kiện, tổ chức 4 hội thảo nghề nghiệp.',
      skills: 'MISA, Excel, tiếng Anh TOEIC 800, làm việc nhóm',
    },
  },
  {
    id: 'tpl-classic',
    code: 'CLASSIC',
    name: 'Cổ điển',
    category: 'ats',
    tags: ['ATS', 'Không ảnh', 'Trang trọng'],
    layout: 'classic',
    defaultColor: '#0284C7',
    colors: ['#0284C7', '#166534', '#9F1239', '#334155'],
    hasPhoto: false,
    sample: {
      fullName: 'Đỗ Minh Quân',
      headline: 'Nhân viên Hành chính – Nhân sự',
      contact: 'minhquan@email.com · 0909 222 111 · Thủ Đức, Hồ Chí Minh',
      summary: 'Ba năm kinh nghiệm hành chính – nhân sự, thành thạo quy trình tuyển dụng và chấm công.',
      experiences: [
        {
          company: 'Công ty CP Đất Phương Nam · 2023 – nay',
          period: '',
          bullets: ['Quản lý hồ sơ 150 nhân viên, phối hợp tuyển dụng 40 vị trí/năm.'],
        },
      ],
      education: 'Đại học Lao động – Xã hội · Quản trị nhân lực, 2017 – 2021',
      skills: 'Tuyển dụng, C&B, Luật lao động, Excel nhân sự',
    },
  },
  {
    id: 'tpl-left-band',
    code: 'EXECUTIVE',
    name: 'Cột màu bên trái',
    category: 'modern',
    tags: ['Có ảnh', 'Nổi bật'],
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
          company: 'Trung tâm Anh ngữ Ánh Dương · 2021 – nay',
          period: '',
          bullets: ['Phụ trách 6 lớp IELTS, 85% học viên đạt mục tiêu.'],
        },
      ],
      education: 'Đại học Sư phạm TP.HCM · Sư phạm Tiếng Anh, 2015 – 2019',
      skills: 'Giảng dạy IELTS, Thiết kế giáo án, Quản lý lớp học',
      certificates: ['IELTS 8.0', 'TESOL 2024'],
    },
  },
  {
    id: 'tpl-compact',
    code: 'COMPACT',
    name: 'Gọn một trang',
    category: 'ats',
    tags: ['ATS', 'Nhiều kinh nghiệm'],
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
          company: 'Công ty Bán lẻ Hưng Thịnh · 2022 – nay',
          period: '',
          bullets: ['Xây dựng 12 dashboard doanh thu, giảm 30% thời gian báo cáo tuần.'],
        },
        {
          company: 'Công ty Phần mềm Gia Linh · 2021 – 2022',
          period: '',
          bullets: ['Làm sạch và chuẩn hóa dữ liệu khách hàng.'],
        },
      ],
      education: 'Đại học Kinh tế Quốc dân · Hệ thống thông tin, 2017 – 2021',
      skills: 'SQL, Python (pandas), Power BI, Excel, thống kê cơ bản',
    },
  },
];

const TemplateMiniPreview: React.FC<{ template: BuiltInCvTemplate; accentColor: string }> = ({
  template,
  accentColor,
}) => {
  const { sample, id } = template;

  if (id === 'tpl-modern') {
    return (
      <div className="flex h-full w-full flex-col overflow-hidden rounded-[6px] border border-solid border-[#E2E8F0] bg-white text-left shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <div className="flex items-center gap-3 px-4 py-3 text-white" style={{ backgroundColor: accentColor }}>
          <div className="h-9 w-9 shrink-0 rounded-full bg-white/90" />
          <div className="min-w-0">
            <div className="truncate text-[10px] font-bold">{sample.fullName}</div>
            <div className="truncate text-[7.5px] text-white/85">{sample.headline}</div>
          </div>
        </div>
        <div className="grid flex-1 grid-cols-[0.38fr_0.62fr] gap-2.5 p-3 text-[6.5px] leading-[1.35] text-[#334155]">
          <div className="space-y-2 border-0 border-r border-solid border-[#E2E8F0] pr-2 text-center">
            <div>
              <div className="mb-0.5 font-bold uppercase tracking-wider" style={{ color: accentColor }}>LIÊN HỆ</div>
              <div className="text-[#475569]">{sample.email}<br />{sample.phone}<br />{sample.address}</div>
            </div>
            <div>
              <div className="mb-0.5 font-bold uppercase tracking-wider" style={{ color: accentColor }}>KỸ NĂNG</div>
              <div className="text-[#475569]">Java, Spring Boot<br />PostgreSQL<br />Docker, Kubernetes<br />AWS</div>
            </div>
            <div>
              <div className="mb-0.5 font-bold uppercase tracking-wider" style={{ color: accentColor }}>NGOẠI NGỮ</div>
              <div className="text-[#475569]">{sample.languages}</div>
            </div>
          </div>
          <div className="space-y-2">
            <div>
              <div className="mb-0.5 text-center font-bold uppercase tracking-wider" style={{ color: accentColor }}>KINH NGHIỆM</div>
              {sample.experiences?.map((exp, idx) => (
                <div key={idx} className="mb-1.5">
                  <div className="text-center font-bold text-[#0F172A]">{exp.company}</div>
                  <div className="text-center text-[6px] text-[#64748B]">{exp.period}</div>
                  {exp.bullets.map((b, bIdx) => (
                    <div key={bIdx} className="text-[#334155]">• {b}</div>
                  ))}
                </div>
              ))}
            </div>
            <div>
              <div className="mb-0.5 text-center font-bold uppercase tracking-wider" style={{ color: accentColor }}>HỌC VẤN</div>
              <div className="text-center font-semibold text-[#0F172A]">{sample.education}</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (id === 'tpl-left-band') {
    return (
      <div className="grid h-full w-full grid-cols-[0.36fr_0.64fr] overflow-hidden rounded-[6px] border border-solid border-[#E2E8F0] bg-white text-left shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <div className="flex flex-col items-center px-2.5 py-3 text-center text-[6.5px] leading-[1.35] text-white" style={{ backgroundColor: accentColor }}>
          <div className="mb-2 h-10 w-10 rounded-full bg-white/85" />
          <div className="text-[8.5px] font-bold">{sample.fullName}</div>
          <div className="mb-2.5 text-[6.5px] text-white/80">{sample.headline}</div>
          <div className="mb-2 w-full">
            <div className="mb-0.5 font-bold uppercase tracking-wider text-white/90">THÔNG TIN</div>
            <div className="text-white/80">{sample.email}<br />{sample.phone}<br />{sample.address}</div>
          </div>
          <div className="w-full">
            <div className="mb-0.5 font-bold uppercase tracking-wider text-white/90">CHỨNG CHỈ</div>
            <div className="text-white/80">{sample.certificates?.join('\n')}</div>
          </div>
        </div>
        <div className="space-y-2.5 p-3 text-[6.5px] leading-[1.35] text-[#334155]">
          <div>
            <div className="mb-0.5 text-center font-bold uppercase tracking-wider" style={{ color: accentColor }}>MỤC TIÊU NGHỀ NGHIỆP</div>
            <div className="text-center text-[#475569]">{sample.summary}</div>
          </div>
          <div>
            <div className="mb-0.5 text-center font-bold uppercase tracking-wider" style={{ color: accentColor }}>KINH NGHIỆM</div>
            {sample.experiences?.map((exp, idx) => (
              <div key={idx} className="text-center">
                <div className="font-bold text-[#0F172A]">{exp.company}</div>
                {exp.bullets.map((b, bIdx) => (
                  <div key={bIdx} className="text-[#475569]">{b}</div>
                ))}
              </div>
            ))}
          </div>
          <div>
            <div className="mb-0.5 text-center font-bold uppercase tracking-wider" style={{ color: accentColor }}>HỌC VẤN</div>
            <div className="text-center font-semibold text-[#0F172A]">{sample.education}</div>
          </div>
        </div>
      </div>
    );
  }

  if (id === 'tpl-compact') {
    return (
      <div className="flex h-full w-full flex-col overflow-hidden rounded-[6px] border border-solid border-[#E2E8F0] bg-white p-3.5 text-left text-[6.5px] leading-[1.35] text-[#334155] shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
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
          <div className="grid grid-cols-[48px_1fr] gap-2">
            <div className="font-bold uppercase" style={{ color: accentColor }}>TÓM TẮT</div>
            <div>{sample.summary}</div>
          </div>
          <div className="grid grid-cols-[48px_1fr] gap-2">
            <div className="font-bold uppercase" style={{ color: accentColor }}>KINH NGHIỆM</div>
            <div className="space-y-1">
              {sample.experiences?.map((exp, idx) => (
                <div key={idx}>
                  <div className="font-bold text-[#0F172A]">{exp.company}</div>
                  {exp.bullets.map((b, bIdx) => (
                    <div key={bIdx} className="text-[#475569]">{b}</div>
                  ))}
                </div>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-[48px_1fr] gap-2">
            <div className="font-bold uppercase" style={{ color: accentColor }}>HỌC VẤN</div>
            <div className="font-semibold text-[#0F172A]">{sample.education}</div>
          </div>
          <div className="grid grid-cols-[48px_1fr] gap-2">
            <div className="font-bold uppercase" style={{ color: accentColor }}>KỸ NĂNG</div>
            <div>{sample.skills}</div>
          </div>
        </div>
      </div>
    );
  }

  if (id === 'tpl-fresh-grad') {
    return (
      <div className="flex h-full w-full flex-col overflow-hidden rounded-[6px] border border-solid border-[#E2E8F0] bg-white p-3.5 text-left text-[6.5px] leading-[1.35] text-[#334155] shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <div className="mb-2 flex items-center gap-2.5 border-0 border-b border-solid border-[#E2E8F0] pb-2">
          <div className="h-9 w-9 shrink-0 rounded-full bg-[#CBD5E1]/70" />
          <div className="min-w-0 flex-1 text-center">
            <div className="text-[10px] font-bold text-[#0F172A]">{sample.fullName}</div>
            <div className="text-[7px] font-semibold" style={{ color: accentColor }}>{sample.headline}</div>
            <div className="truncate text-[5.8px] text-[#64748B]">{sample.contact}</div>
          </div>
        </div>
        <div className="space-y-2 text-center">
          <div>
            <div className="mb-0.5 font-bold uppercase tracking-wider" style={{ color: accentColor }}>MỤC TIÊU NGHỀ NGHIỆP</div>
            <div>{sample.summary}</div>
          </div>
          <div>
            <div className="mb-0.5 font-bold uppercase tracking-wider" style={{ color: accentColor }}>HỌC VẤN</div>
            <div className="font-semibold text-[#0F172A]">{sample.education}</div>
          </div>
          {sample.activity && (
            <div>
              <div className="mb-0.5 font-bold uppercase tracking-wider" style={{ color: accentColor }}>HOẠT ĐỘNG</div>
              <div>{sample.activity}</div>
            </div>
          )}
          <div>
            <div className="mb-0.5 font-bold uppercase tracking-wider" style={{ color: accentColor }}>KỸ NĂNG</div>
            <div>{sample.skills}</div>
          </div>
        </div>
      </div>
    );
  }

  if (id === 'tpl-classic') {
    return (
      <div className="flex h-full w-full flex-col overflow-hidden rounded-[6px] border border-solid border-[#E2E8F0] bg-white p-3.5 text-center text-[6.5px] leading-[1.35] text-[#334155] shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <div className="mb-2 pb-1.5">
          <div className="text-[10px] font-bold text-[#0F172A]">{sample.fullName}</div>
          <div className="text-[7px] text-[#475569]">{sample.headline}</div>
          <div className="text-[5.8px] text-[#64748B]">{sample.contact}</div>
        </div>
        <div className="space-y-2">
          <div>
            <div className="mb-0.5 border-0 border-b border-solid border-[#CBD5E1] pb-0.5 font-bold uppercase tracking-wider text-[#0F172A]">MỤC TIÊU NGHỀ NGHIỆP</div>
            <div>{sample.summary}</div>
          </div>
          <div>
            <div className="mb-0.5 border-0 border-b border-solid border-[#CBD5E1] pb-0.5 font-bold uppercase tracking-wider text-[#0F172A]">KINH NGHIỆM LÀM VIỆC</div>
            {sample.experiences?.map((exp, idx) => (
              <div key={idx}>
                <div className="font-bold text-[#0F172A]">{exp.company}</div>
                {exp.bullets.map((b, bIdx) => (
                  <div key={bIdx}>{b}</div>
                ))}
              </div>
            ))}
          </div>
          <div>
            <div className="mb-0.5 border-0 border-b border-solid border-[#CBD5E1] pb-0.5 font-bold uppercase tracking-wider text-[#0F172A]">HỌC VẤN</div>
            <div className="font-semibold text-[#0F172A]">{sample.education}</div>
          </div>
        </div>
      </div>
    );
  }

  // Default: tpl-standard (Page 24 Card 1 & Page 25 exact layout)
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

/** Full A4 Sample Sheet matching PDF Page 25 ("Trần Bảo Ngọc") */
export const CvSampleSheetPreview: React.FC<{ template: BuiltInCvTemplate; accentColor: string }> = ({
  template,
  accentColor,
}) => {
  const { sample } = template;
  return (
    <div className="mx-auto w-full max-w-[780px] rounded-[8px] bg-white p-8 font-['Be_Vietnam_Pro',system-ui,sans-serif] text-[#0F172A] shadow-sm sm:p-12">
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

        <section>
          <h3 className="m-0 mb-1.5 text-[13px] font-bold uppercase tracking-wide" style={{ color: accentColor }}>
            KỸ NĂNG
          </h3>
          <p className="m-0">{sample.skills}</p>
        </section>
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
  const [cardColors, setCardColors] = useState<Record<string, string>>({
    'tpl-standard': selectedColor || '#0284C7',
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
    <div className="min-h-full w-full flex-1 overflow-y-auto bg-[#F7F8FA] font-['Be_Vietnam_Pro',system-ui,sans-serif] text-[#0F172A]">
      <div className="mx-auto max-w-[1248px] px-4 py-6 pb-24 sm:px-6 lg:px-8 lg:py-7">
        {/* Stepper (1 Chọn mẫu — 2 Điền nội dung — 3 Tải PDF hoặc lưu vào Kho CV) */}
        <div className="mb-5 flex flex-wrap items-center gap-2.5 text-[13px]">
          <div className="flex items-center gap-2 font-semibold text-sky-700">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-r from-sky-500 to-blue-600 text-[12px] font-bold text-white shadow-xs">
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
                    ? 'border border-solid border-sky-600 bg-gradient-to-r from-sky-500 to-blue-600 font-semibold text-white shadow-xs'
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
            const isSelected = tpl.code === selectedTemplateCode;
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
                    className="h-[38px] cursor-pointer rounded-[8px] border-0 bg-gradient-to-r from-sky-500 to-blue-600 font-['Be_Vietnam_Pro',system-ui,sans-serif] text-[13px] font-semibold text-white shadow-sm shadow-sky-500/20 transition-all duration-200 hover:from-sky-600 hover:to-blue-700 active:scale-[0.99]"
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
                className="h-9 cursor-pointer rounded-[8px] border-0 bg-gradient-to-r from-sky-500 to-blue-600 px-4 font-['Be_Vietnam_Pro',system-ui,sans-serif] text-[13px] font-semibold text-white shadow-sm hover:from-sky-600 hover:to-blue-700"
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
