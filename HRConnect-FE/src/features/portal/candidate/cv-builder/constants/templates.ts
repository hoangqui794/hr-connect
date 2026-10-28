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
      accentColor: '#2563EB',
      density: 'normal',
      fontFamily: 'Inter',
    },
  },
  {
    cvTemplateId: 'tpl-modern-two-col',
    code: 'MODERN_TWO_COL',
    name: 'Mẫu Hai Cột Hiện Đại',
    description: 'Header ngang nổi bật, phân tách 2 cột (35/65) trực quan với trục timeline kinh nghiệm và cột kỹ năng chuyên sâu.',
    templateConfig: {
      accentColor: '#2563EB',
      density: 'normal',
      fontFamily: 'Inter',
    },
  },
];

export const DEFAULT_CV_TEMPLATE = STATIC_CV_TEMPLATES[0];
