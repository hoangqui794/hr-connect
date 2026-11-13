/**
 * @file templates.ts
 * @description Static layout templates for Candidate CV Builder (TopCV style).
 * Replaces remote API calls to prevent 404 Not Found errors.
 */

import type { CvTemplateDto } from '@/types/api/cvBuilder';

export const STATIC_CV_TEMPLATES: CvTemplateDto[] = [
  {
    cvTemplateId: 'tpl-standard',
    code: 'STANDARD',
    name: 'Tiêu chuẩn 1 cột',
    description: 'Bố cục 1 cột tuần tự, chuẩn quét ATS (đạt 98% ATS match). Phù hợp cho mọi ngành nghề và cấp bậc.',
    templateConfig: {
      accentColor: '#0284C7',
      density: 'normal',
      fontFamily: 'INTER',
      layout: 'ats',
    },
  },
  {
    cvTemplateId: 'tpl-modern',
    code: 'MODERN_TWO_COL',
    name: 'Hiện đại 2 cột',
    description: 'Header ngang toàn chiều rộng, phân tách 2 cột (35/65) tối ưu: Kỹ năng & Ngoại ngữ bên trái, Kinh nghiệm & Học vấn bên phải.',
    templateConfig: {
      accentColor: '#0284C7',
      density: 'normal',
      fontFamily: 'INTER',
      layout: 'modern',
    },
  },
  {
    cvTemplateId: 'tpl-elegant',
    code: 'ELEGANT',
    name: 'Thanh lịch (Header Banner)',
    description: 'Header dạng banner màu nền nổi bật, avatar viền sang trọng, tạo phong cách chuyên nghiệp cho vị trí quản lý và sáng tạo.',
    templateConfig: {
      accentColor: '#0284C7',
      density: 'normal',
      fontFamily: 'BE_VIETNAM_PRO',
      layout: 'elegant',
    },
  },
  {
    cvTemplateId: 'tpl-minimal',
    code: 'MINIMAL',
    name: 'Tối giản (Minimalist)',
    description: 'Đường kẻ ngang tinh tế, khoảng cách thoáng đãng, tối giản hiện đại chuẩn quốc tế cho lập trình viên và sinh viên.',
    templateConfig: {
      accentColor: '#0284C7',
      density: 'normal',
      fontFamily: 'INTER',
      layout: 'minimal',
    },
  },
  {
    cvTemplateId: 'tpl-executive',
    code: 'EXECUTIVE',
    name: 'Chuyên nghiệp (Sidebar phải)',
    description: 'Bố cục 2 cột đảo chiều độc đáo: Cột chính lớn bên trái (65%) cho kinh nghiệm và học vấn, Sidebar bên phải (35%) cho kỹ năng.',
    templateConfig: {
      accentColor: '#0284C7',
      density: 'normal',
      fontFamily: 'BE_VIETNAM_PRO',
      layout: 'executive',
    },
  },
  {
    cvTemplateId: 'tpl-compact',
    code: 'COMPACT',
    name: 'Sáng tạo (Timeline dọc)',
    description: 'Trục timeline mốc thời gian dọc nối liền mạch kinh nghiệm làm việc và học vấn với các chấm mốc sự kiện trực quan.',
    templateConfig: {
      accentColor: '#0284C7',
      density: 'normal',
      fontFamily: 'ROBOTO',
      layout: 'compact',
    },
  },
];

export const DEFAULT_CV_TEMPLATE = STATIC_CV_TEMPLATES[0];
