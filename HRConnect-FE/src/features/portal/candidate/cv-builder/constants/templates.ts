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
    name: 'Mẫu Tiêu Chuẩn',
    description: '1 Cột tuần tự, thanh lịch, chuẩn quét ATS (đạt 98% ATS match). Phù hợp cho mọi ngành nghề và cấp bậc.',
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
    name: 'Mẫu Hai Cột Hiện Đại',
    description: 'Header ngang nổi bật, phân tách 2 cột (35/65) trực quan với trục timeline kinh nghiệm và cột kỹ năng chuyên sâu.',
    templateConfig: {
      accentColor: '#0284C7',
      density: 'normal',
      fontFamily: 'INTER',
      layout: 'modern',
    },
  },
  {
    cvTemplateId: 'tpl-classic',
    code: 'CLASSIC',
    name: 'Mẫu Cổ Điển',
    description: 'Bố cục trang trọng, đường nét thanh mảnh, cân xứng hoàn hảo cho các vị trí hành chính và quản lý.',
    templateConfig: {
      accentColor: '#0284C7',
      density: 'normal',
      fontFamily: 'BE_VIETNAM_PRO',
      layout: 'classic',
    },
  },
  {
    cvTemplateId: 'tpl-compact',
    code: 'COMPACT',
    name: 'Mẫu Gọn Một Trang',
    description: 'Tối ưu mật độ hiển thị để toàn bộ kinh nghiệm phong phú nằm gọn trong đúng 1 trang A4.',
    templateConfig: {
      accentColor: '#0284C7',
      density: 'compact',
      fontFamily: 'ROBOTO',
      layout: 'compact',
    },
  },
  {
    cvTemplateId: 'tpl-left-band',
    code: 'EXECUTIVE',
    name: 'Mẫu Chuyên Nghiệp',
    description: 'Tiêu đề cân giữa, dải phân cách nổi bật tạo phong thái đĩnh đạc và uy tín cao.',
    templateConfig: {
      accentColor: '#0284C7',
      density: 'normal',
      fontFamily: 'BE_VIETNAM_PRO',
      layout: 'executive',
    },
  },
  {
    cvTemplateId: 'tpl-fresh-grad',
    code: 'MINIMAL',
    name: 'Mẫu Sinh Viên & Tối Giản',
    description: 'Tập trung vào học vấn, hoạt động ngoại khóa và kỹ năng tiềm năng cho ứng viên mới tốt nghiệp.',
    templateConfig: {
      accentColor: '#0284C7',
      density: 'normal',
      fontFamily: 'INTER',
      layout: 'minimal',
    },
  },
];

export const DEFAULT_CV_TEMPLATE = STATIC_CV_TEMPLATES[0];
