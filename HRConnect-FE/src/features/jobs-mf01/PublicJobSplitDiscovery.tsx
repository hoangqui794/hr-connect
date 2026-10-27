/**
 * @file PublicJobSplitDiscovery.tsx
 * @description Trải nghiệm Split-View chuẩn TopCV / VietnamWorks cho Trang Tìm Việc Làm Công Khai (/jobs).
 * Cho phép ứng viên công khai duyệt tin không cần đăng nhập, lọc đa tiêu chí cố định (sticky),
 * xem nhanh chi tiết JD ở cột phải và mở modal ứng tuyển / đăng nhập nhanh mà không bị mất ngữ cảnh.
 */
import React, { useMemo, useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Search,
  MapPin,
  DollarSign,
  Briefcase,
  Award,
  Filter,
  RotateCcw,
  Clock,
  Heart,
  Zap,
  CheckCircle2,
  Building2,
  Globe,
  Users,
  Calendar,
  Share2,
  ShieldCheck,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { message, Modal, Tooltip } from 'antd';
import { useAuthStore } from '@/stores/authStore';
import { Navbar } from '@/features/landing/components/Navbar';
import { CompanyLogo } from '@/features/landing/components/CompanyLogo';
import { usePublicJobSearch } from './useJobQueries';
import { JobApplyActions } from '@/features/portal/JobApplyActions';
import type { Job } from '@/types/api/jobs';

// ── Dropdown Options ────────────────────────────────────────────────────────
export const LOCATION_FILTER_OPTIONS = [
  { value: 'ALL', label: 'Tất cả địa điểm' },
  { value: 'HN', label: 'Hà Nội' },
  { value: 'HCM', label: 'TP. HCM' },
  { value: 'DN', label: 'Đà Nẵng' },
  { value: 'REMOTE', label: 'Toàn quốc' },
];

export const SALARY_FILTER_OPTIONS = [
  { value: 'ALL', label: 'Tất cả mức lương' },
  { value: 'UNDER_10', label: 'Dưới 10tr' },
  { value: '10_20', label: '10-20tr' },
  { value: '20_35', label: '20-35tr' },
  { value: 'OVER_35', label: 'Trên 35tr' },
  { value: 'NEGOTIABLE', label: 'Thỏa thuận' },
];

export const EXPERIENCE_FILTER_OPTIONS = [
  { value: 'ALL', label: 'Tất cả kinh nghiệm' },
  { value: 'NO_EXP', label: 'Chưa có kinh nghiệm' },
  { value: 'UNDER_1', label: 'Dưới 1 năm' },
  { value: '1_3', label: '1-3 năm' },
  { value: '3_5', label: '3-5 năm' },
  { value: 'OVER_5', label: 'Trên 5 năm' },
];

export const LEVEL_FILTER_OPTIONS = [
  { value: 'ALL', label: 'Tất cả cấp bậc' },
  { value: 'INTERN', label: 'Thực tập' },
  { value: 'STAFF', label: 'Nhân viên' },
  { value: 'LEAD', label: 'Trưởng nhóm' },
  { value: 'MANAGER', label: 'Quản lý' },
];

export const CATEGORY_NAMES: Record<string, string> = {
  IT: 'Công nghệ Thông tin',
  SALES: 'Kinh doanh / Bán hàng',
  MARKETING: 'Marketing / PR / Quảng cáo',
  FINANCE: 'Tài chính / Ngân hàng',
  ACCOUNTING: 'Kế toán / Kiểm toán / Thuế',
  HR: 'Nhân sự / Hành chính',
  DESIGN: 'Thiết kế UI/UX & Sáng tạo',
  REAL_ESTATE: 'Bất động sản / Xây dựng',
  CS: 'Chăm sóc khách hàng',
};

// ── Fallback Rich Mock Data for Public Job Discovery ───────────────────────
export interface PublicJobItem {
  id: string;
  title: string;
  company: string;
  companyId: string;
  location: string;
  locationCode: 'HN' | 'HCM' | 'DN' | 'BD' | 'REMOTE';
  experience: string;
  experienceCode: 'NO_EXP' | 'UNDER_1' | '1_3' | '3_5' | 'OVER_5';
  level: string;
  levelCode: 'INTERN' | 'STAFF' | 'LEAD' | 'MANAGER';
  salaryText: string;
  salaryMin?: number;
  salaryMax?: number;
  salaryCode: 'UNDER_10' | '10_20' | '20_35' | 'OVER_35' | 'NEGOTIABLE';
  postedTime: string;
  deadline: string;
  quantity: number;
  workingTime: string;
  employmentType: string;
  industry: string;
  companySize: string;
  website: string;
  address: string;
  companyDescription: string;
  descriptionParagraphs: string[];
  responsibilities: string[];
  requirements: string[];
  benefits: string[];
  tags: string[];
  isHot?: boolean;
  isUrgent?: boolean;
}

const FALLBACK_JOBS: PublicJobItem[] = [
  {
    id: 'job-001',
    title: 'Senior Frontend Engineer (React/Next.js/TypeScript)',
    company: 'Techcombank Digital Banking Hub',
    companyId: 'techcombank',
    location: 'Cầu Giấy, Hà Nội & Quận 1, TP.HCM',
    locationCode: 'HN',
    experience: '3 - 5 năm kinh nghiệm',
    experienceCode: '3_5',
    level: 'Chuyên viên cao cấp / Senior',
    levelCode: 'STAFF',
    salaryText: '35 - 55 Triệu VND',
    salaryMin: 35000000,
    salaryMax: 55000000,
    salaryCode: 'OVER_35',
    postedTime: '2 giờ trước',
    deadline: '30/11/2026',
    quantity: 3,
    workingTime: 'Thứ 2 - Thứ 6 (8:30 - 17:30), Hybrid 2 ngày Remote/tuần',
    employmentType: 'Toàn thời gian cố định',
    industry: 'Ngân hàng số & Công nghệ Tài chính (Fintech)',
    companySize: '10,000+ nhân viên',
    website: 'https://techcombank.com',
    address: 'Số 6 Quang Trung, Trần Hưng Đạo, Hoàn Kiếm, Hà Nội',
    companyDescription:
      'Techcombank là một trong những ngân hàng thương mại cổ phần hàng đầu Việt Nam, tiên phong trong chiến lược Chuyển đổi số, Dữ liệu và Nhân tài để kiến tạo giải pháp tài chính vượt trội cho hàng chục triệu khách hàng.',
    descriptionParagraphs: [
      'Chúng tôi đang tìm kiếm Senior Frontend Engineer tài năng gia nhập Digital Banking Hub để phát triển nền tảng ngân hàng số thế hệ mới phục vụ hơn 12 triệu người dùng thường xuyên.',
      'Bạn sẽ là hạt nhân công nghệ tham gia thiết kế kiến trúc Micro-Frontend, tối ưu hiệu năng render, bảo mật giao dịch trực tuyến và xây dựng trải nghiệm ngân hàng siêu tốc độ.',
    ],
    responsibilities: [
      'Phát triển các module ứng dụng Web/PWA ngân hàng số sử dụng React 18, Next.js và TypeScript.',
      'Thiết kế và tối ưu hóa hệ thống Design System chuẩn Enterprise, đảm bảo tính nhất quán trên toàn bộ các kênh số.',
      'Phối hợp chặt chẽ với đội ngũ Backend (Golang/Java Spring Boot), Product Owner và UI/UX Designer để hiện thực hóa tính năng sản phẩm.',
      'Nâng cao hiệu năng ứng dụng (Web Vitals), tối ưu hoá bundle size và đảm bảo tính bảo mật chuẩn OWASP.',
      'Tham gia Code Review, hướng dẫn và hỗ trợ chuyên môn cho các kỹ sư Junior và Middle.',
    ],
    requirements: [
      'Tối thiểu 3 năm kinh nghiệm lập trình Frontend chuyên sâu với ReactJS, Next.js và TypeScript.',
      'Nắm vững kiến trúc State Management (Zustand, Redux Toolkit, React Query/TanStack Query).',
      'Thành thạo tối ưu hóa hiệu năng Web, kiểm thử tự động (Jest, React Testing Library, Playwright).',
      'Có kinh nghiệm làm việc trong các hệ thống tài chính, ngân hàng, thương mại điện tử quy mô lớn là lợi thế.',
      'Tư duy phân tích mạch lạc, khả năng giao tiếp và làm việc nhóm Agile/Scrum xuất sắc.',
    ],
    benefits: [
      'Mức thu nhập cạnh tranh: 35.000.000 - 55.000.000 VND + Thưởng hiệu suất cuối năm 2 - 4 tháng lương.',
      'Chế độ làm việc linh hoạt Hybrid: 2 ngày làm việc từ xa/tuần.',
      'Bảo hiểm sức khỏe cao cấp Techcombank Care cho bản thân và người thân.',
      'Cấp mới MacBook Pro M3 Pro / Dell XPS cao cấp phục vụ công việc.',
      'Lộ trình phát triển sự nghiệp rõ ràng theo cả 2 nhánh Technical Specialist hoặc Engineering Lead.',
    ],
    tags: ['ReactJS', 'Next.js', 'TypeScript', 'TailwindCSS', 'Micro-Frontend'],
    isHot: true,
  },
  {
    id: 'job-002',
    title: 'Product Growth Specialist (Fintech / E-Wallet)',
    company: 'VNG Corporation - ZaloPay Hub',
    companyId: 'vng',
    location: 'Quận 7, TP. Hồ Chí Minh',
    locationCode: 'HCM',
    experience: '2 - 3 năm kinh nghiệm',
    experienceCode: '1_3',
    level: 'Chuyên viên / Staff',
    levelCode: 'STAFF',
    salaryText: '1,800 - 2,500 USD',
    salaryMin: 45000000,
    salaryMax: 62000000,
    salaryCode: 'OVER_35',
    postedTime: '4 giờ trước',
    deadline: '15/12/2026',
    quantity: 2,
    workingTime: 'Thứ 2 - Thứ 6 (9:00 - 18:00)',
    employmentType: 'Toàn thời gian cố định',
    industry: 'Internet & Dịch vụ Số',
    companySize: '4,000+ nhân viên',
    website: 'https://vng.com.vn',
    address: 'VNG Campus, Khu chế xuất Tân Thuận, P. Tân Thuận Đông, Quận 7, TP.HCM',
    companyDescription:
      'VNG là Kỳ lân công nghệ đầu tiên của Việt Nam, xây dựng hệ sinh thái sản phẩm số đa dạng từ trò chơi trực tuyến, ứng dụng liên lạc Zalo, thanh toán điện tử ZaloPay đến nền tảng đám mây VNG Cloud.',
    descriptionParagraphs: [
      'Gia nhập đội ngũ Tăng trưởng của ZaloPay, bạn sẽ trực tiếp dẫn dắt các chiến dịch chuyển đổi người dùng, tối ưu hóa phễu onboarding và kiến tạo các tính năng tăng trưởng viral trên nền tảng 30+ triệu người dùng.',
    ],
    responsibilities: [
      'Thiết kế và thực thi các thí nghiệm A/B Testing trên toàn bộ vòng đời khách hàng từ Acquisition, Activation đến Retention.',
      'Phân tích hành vi người dùng bằng Amplitude, Mixpanel, SQL để phát hiện điểm rơi của phễu thanh toán.',
      'Phối hợp với Product Manager và Data Science team để xây dựng thuật toán gợi ý ưu đãi cá nhân hoá.',
      'Theo dõi và tối ưu hóa các chỉ số chuyển đổi, CAC, LTV và tỷ lệ duy trì người dùng.',
    ],
    requirements: [
      'Tối thiểu 2 năm kinh nghiệm trong vai trò Product Growth, Growth Marketing trong mảng Fintech hoặc E-Commerce.',
      'Khả năng truy vấn SQL thành thạo, tư duy dựa trên dữ liệu (Data-driven mindset).',
      'Kinh nghiệm thực chiến với A/B Testing, User Cohort Analysis.',
      'Tiếng Anh giao tiếp tốt trong môi trường làm việc quốc tế.',
    ],
    benefits: [
      'Mức lương $1,800 - $2,500 USD net + Thưởng cổ phiếu ESOP định kỳ hàng năm.',
      'Ăn trưa miễn phí tại nhà ăn VNG Campus, phòng tập gym, hồ bơi chuẩn 5 sao nội khu.',
      'Gói bảo hiểm toàn diện cao cấp cho nhân viên và gói chăm sóc gia đình.',
      'Tham gia các khoá đào tạo lãnh đạo và công nghệ quốc tế.',
    ],
    tags: ['Product Growth', 'Fintech', 'A/B Testing', 'SQL', 'ZaloPay'],
    isUrgent: true,
  },
  {
    id: 'job-003',
    title: 'Senior Data Analyst (E-Commerce Analytics)',
    company: 'Shopee Vietnam Headquarters',
    companyId: 'shopee',
    location: 'Quận 1, TP. Hồ Chí Minh',
    locationCode: 'HCM',
    experience: '3 - 5 năm kinh nghiệm',
    experienceCode: '3_5',
    level: 'Chuyên viên cao cấp / Senior',
    levelCode: 'STAFF',
    salaryText: '30 - 45 Triệu VND',
    salaryMin: 30000000,
    salaryMax: 45000000,
    salaryCode: '20_35',
    postedTime: '5 giờ trước',
    deadline: '20/11/2026',
    quantity: 2,
    workingTime: 'Thứ 2 - Thứ 6 (9:00 - 18:30)',
    employmentType: 'Toàn thời gian cố định',
    industry: 'Thương mại điện tử & Logistic',
    companySize: '5,000+ nhân viên',
    website: 'https://shopee.vn',
    address: 'Tòa nhà Saigon Centre, 67 Lê Lợi, Bến Nghé, Quận 1, TP.HCM',
    companyDescription:
      'Shopee là nền tảng thương mại điện tử dẫn đầu khu vực Đông Nam Á và Đài Loan, cung cấp trải nghiệm mua sắm trực tuyến liền mạch và tiện ích tối đa cho người mua và người bán.',
    descriptionParagraphs: [
      'Đội ngũ Phân tích Dữ liệu Shopee đóng vai trò ngọn hải đăng chỉ dẫn các quyết định kinh doanh nghìn tỷ đồng, từ chiến lược giá, tối ưu khuyến mại chiến dịch đến hành vi giữ chân khách hàng.',
    ],
    responsibilities: [
      'Phát triển các mô hình dự báo nhu cầu thị trường, phân khúc khách hàng và hiệu quả chi tiêu khuyến mại.',
      'Xây dựng các Dashboard thời gian thực trên Tableau/PowerBI phục vụ ban điều hành và các ngành hàng.',
      'Khai thác dữ liệu lớn (BigQuery, Spark) để tìm insight phục vụ các chiến dịch Mega Sale (11.11, 12.12).',
      'Đề xuất các giải pháp nâng cao GMV và cải thiện trải nghiệm khách hàng dựa trên bằng chứng dữ liệu.',
    ],
    requirements: [
      'Tốt nghiệp Đại học chuyên ngành Toán tin, Khoa học Máy tính, Thống kê, Kinh tế hoặc liên quan.',
      'Thành thạo nâng cao SQL, Python (Pandas, Numpy) và công cụ trực quan hóa Tableau.',
      'Tối thiểu 3 năm kinh nghiệm Data Analyst trong ngành E-commerce, Retail hoặc Tech.',
      'Kỹ năng thuyết trình và truyền tải câu chuyện dữ liệu thuyết phục.',
    ],
    benefits: [
      'Lương 30.000.000 - 45.000.000 VND + Thưởng quý theo kết quả kinh doanh.',
      'Phúc lợi voucher mua sắm hàng tháng trên Shopee.',
      'Môi trường làm việc trẻ trung, văn phòng trung tâm Quận 1 đẳng cấp quốc tế.',
      'Cơ hội luân chuyển nội bộ khu vực Đông Nam Á (Singapore, Thái Lan).',
    ],
    tags: ['Data Analyst', 'SQL', 'Python', 'Tableau', 'E-Commerce'],
    isHot: true,
  },
  {
    id: 'job-004',
    title: 'Cloud Solutions Architect (AWS/GCP Enterprise)',
    company: 'FPT Software Global',
    companyId: 'fpt',
    location: 'Cầu Giấy, Hà Nội',
    locationCode: 'HN',
    experience: 'Trên 5 năm kinh nghiệm',
    experienceCode: 'OVER_5',
    level: 'Trưởng nhóm / Kiến trúc sư giải pháp',
    levelCode: 'LEAD',
    salaryText: '50 - 75 Triệu VND',
    salaryMin: 50000000,
    salaryMax: 75000000,
    salaryCode: 'OVER_35',
    postedTime: '6 giờ trước',
    deadline: '10/12/2026',
    quantity: 1,
    workingTime: 'Thứ 2 - Thứ 6 (8:30 - 17:30)',
    employmentType: 'Toàn thời gian cố định',
    industry: 'Xuất khẩu phần mềm & Chuyển đổi số',
    companySize: '30,000+ nhân viên',
    website: 'https://fptsoftware.com',
    address: 'FPT Tower, Số 10 Phạm Văn Bạch, Dịch Vọng, Cầu Giấy, Hà Nội',
    companyDescription:
      'FPT Software là công ty dịch vụ công nghệ hàng đầu Đông Nam Á, cung cấp giải pháp chuyển đổi số và phát triển phần mềm cho hơn 1.000 khách hàng toàn cầu thuộc Fortune 500.',
    descriptionParagraphs: [
      'Chúng tôi đang tìm kiếm Kiến trúc sư giải pháp Đám mây cấp cao dẫn dắt các dự án hiện đại hóa hạ tầng và di chuyển hệ thống lên Multi-Cloud cho các khách hàng tài chính và sản xuất tại Nhật Bản, Mỹ.',
    ],
    responsibilities: [
      'Thiết kế kiến trúc hạ tầng Cloud có độ sẵn sàng cao, bảo mật và tối ưu chi phí (Well-Architected Framework).',
      'Tư vấn kỹ thuật và bảo vệ giải pháp kiến trúc với CTO/CISO của các đối tác doanh nghiệp toàn cầu.',
      'Xây dựng các quy chuẩn tự động hoá hạ tầng (Infrastructure as Code - Terraform) và CI/CD pipeline.',
      'Dẫn dắt và định hướng chuyên môn cho đội ngũ Cloud Engineers và DevOps Engineers.',
    ],
    requirements: [
      'Có chứng chỉ AWS Certified Solutions Architect Professional hoặc Google Cloud Professional Cloud Architect.',
      'Tối thiểu 5 năm kinh nghiệm thiết kế hạ tầng Cloud quy mô lớn, vi dịch vụ (Kubernetes, Docker).',
      'Kinh nghiệm chuyên sâu về bảo mật đám mây, tuân thủ tiêu chuẩn ISO 27001, SOC2, PCI-DSS.',
      'Khả năng giao tiếp tiếng Anh lưu loát với đối tác quốc tế.',
    ],
    benefits: [
      'Mức lương 50.000.000 - 75.000.000 VND + Thưởng dự án và chứng chỉ công nghệ quốc tế.',
      'Cơ hội onsite ngắn hạn và dài hạn tại Nhật Bản, Mỹ, Châu Âu.',
      'Chính sách mua nhà, xe ưu đãi độc quyền dành cho nhân tài chủ chốt của FPT.',
      'Gói bảo hiểm sức khỏe FPT Care hạn mức cao.',
    ],
    tags: ['AWS', 'GCP', 'Cloud Architect', 'Kubernetes', 'Terraform'],
    isUrgent: true,
  },
  {
    id: 'job-005',
    title: 'Trưởng Phòng Nhân Sự (HR Manager / HRBP Lead)',
    company: 'Viettel Solutions Corporate',
    companyId: 'viettel',
    location: 'Ba Đình, Hà Nội',
    locationCode: 'HN',
    experience: 'Trên 5 năm kinh nghiệm',
    experienceCode: 'OVER_5',
    level: 'Trưởng phòng / Quản lý',
    levelCode: 'MANAGER',
    salaryText: '40 - 60 Triệu VND',
    salaryMin: 40000000,
    salaryMax: 60000000,
    salaryCode: 'OVER_35',
    postedTime: '8 giờ trước',
    deadline: '28/11/2026',
    quantity: 1,
    workingTime: 'Thứ 2 - Thứ 6 (8:00 - 17:30)',
    employmentType: 'Toàn thời gian cố định',
    industry: 'Viễn thông & Giải pháp Công nghệ Thông tin',
    companySize: '50,000+ nhân viên',
    website: 'https://viettelsolutions.vn',
    address: 'Số 1 Giang Văn Minh, Kim Mã, Ba Đình, Hà Nội',
    companyDescription:
      'Tổng công ty Giải pháp Doanh nghiệp Viettel (Viettel Solutions) là thành viên của Tập đoàn Công nghiệp - Viễn thông Quân đội, đơn vị tiên phong kiến tạo xã hội số và chuyển đổi số quốc gia.',
    descriptionParagraphs: [
      'Vị trí Trưởng phòng Nhân sự sẽ đồng hành cùng Ban Tổng Giám đốc xây dựng chiến lược phát triển nhân tài, tối ưu cơ cấu tổ chức và văn hoá hiệu suất cao cho khối giải pháp công nghệ số.',
    ],
    responsibilities: [
      'Xây dựng và triển khai chiến lược nhân sự tổng thể: tuyển dụng trọng điểm, đào tạo phát triển và đãi ngộ (C&B).',
      'Tư vấn trực tiếp cho các Giám đốc khối về mô hình nhân sự, định biên và đánh giá hiệu quả KPI/OKR.',
      'Dẫn dắt các chương trình gắn kết nhân viên, xây dựng thương hiệu nhà tuyển dụng hàng đầu.',
      'Quản lý và điều phối hoạt động của phòng nhân sự với quy mô 15+ thành viên.',
    ],
    requirements: [
      'Tốt nghiệp Đại học trở lên chuyên ngành Quản trị Nhân sự, Luật, Kinh tế hoặc Quản trị Kinh doanh.',
      'Tối thiểu 5 năm kinh nghiệm quản lý nhân sự tổng hợp hoặc HRBP Lead tại các tập đoàn quy mô lớn.',
      'Am hiểu sâu sắc Luật Lao động Việt Nam và thực tiễn vận hành nhân sự hiện đại.',
      'Khả năng lãnh đạo, giải quyết mâu thuẫn và truyền cảm hứng xuất sắc.',
    ],
    benefits: [
      'Thu nhập 40.000.000 - 60.000.000 VND + Thưởng thành tích năm từ 3 - 6 tháng lương.',
      'Chính sách phúc lợi đặc thù của Tập đoàn Viettel: điện thoại, cước viễn thông miễn phí.',
      'Khám sức khỏe định kỳ tại Bệnh viện Trung ương Quân đội 108.',
      'Môi trường làm việc kỷ luật, chuyên nghiệp và có quy mô phụng sự quốc gia.',
    ],
    tags: ['HR Manager', 'HRBP', 'Tuyển dụng', 'Đãi ngộ C&B', 'Viettel'],
    isHot: true,
  },
  {
    id: 'job-006',
    title: 'Brand Marketing Manager (FMCG Dairy Products)',
    company: 'Vinamilk Vietnam Corporation',
    companyId: 'vinamilk',
    location: 'Quận 7, TP. Hồ Chí Minh',
    locationCode: 'HCM',
    experience: '3 - 5 năm kinh nghiệm',
    experienceCode: '3_5',
    level: 'Trưởng phòng / Quản lý',
    levelCode: 'MANAGER',
    salaryText: 'Thỏa thuận (Hấp dẫn)',
    salaryCode: 'NEGOTIABLE',
    postedTime: '9 giờ trước',
    deadline: '05/12/2026',
    quantity: 1,
    workingTime: 'Thứ 2 - Thứ 6 (8:00 - 17:00)',
    employmentType: 'Toàn thời gian cố định',
    industry: 'Sản xuất & Bán lẻ Hàng Tiêu dùng nhanh (FMCG)',
    companySize: '10,000+ nhân viên',
    website: 'https://vinamilk.com.vn',
    address: 'Số 10 Tân Trào, Tân Phú, Quận 7, TP.HCM',
    companyDescription:
      'Vinamilk là doanh nghiệp sữa số 1 Việt Nam và thuộc Top 40 công ty sữa lớn nhất thế giới về doanh thu, với mạng lưới trang trại sinh thái chuẩn quốc tế và sản phẩm có mặt tại 60+ quốc gia.',
    descriptionParagraphs: [
      'Tìm kiếm Brand Marketing Manager xuất sắc chịu trách nhiệm định vị và gia tăng thị phần cho dòng sản phẩm chủ lực, kết hợp các chiến dịch truyền thông đa phương tiện và phân phối điểm bán.',
    ],
    responsibilities: [
      'Lập kế hoạch chiến lược thương hiệu hàng năm, phân bổ ngân sách marketing hàng chục tỷ đồng.',
      'Chỉ đạo sáng tạo các chiến dịch quảng cáo TVC, Digital Marketing và kích hoạt thương hiệu tại điểm bán.',
      'Nghiên cứu thị trường sâu rộng về hành vi người tiêu dùng, khẩu vị dinh dưỡng và đối thủ cạnh tranh.',
      'Quản lý mối quan hệ với các Creative Agencies, Media Houses hàng đầu.',
    ],
    requirements: [
      'Tối thiểu 4 năm kinh nghiệm Brand Marketing trong ngành FMCG hoặc hàng tiêu dùng nhanh.',
      'Tư duy chiến lược thương hiệu sắc bén, khả năng phân tích P&L ngành hàng.',
      'Khả năng sáng tạo vượt trội và kinh nghiệm sản xuất các chiến dịch truyền thông quy mô toàn quốc.',
      'Kỹ năng lãnh đạo và quản lý ngân sách chặt chẽ.',
    ],
    benefits: [
      'Mức lương thoả thuận theo năng lực (rất cạnh tranh trong ngành FMCG).',
      'Thưởng cuối năm theo kết quả kinh doanh vượt trội của Tập đoàn.',
      'Cung cấp sữa và sản phẩm dinh dưỡng miễn phí cho gia đình hàng tháng.',
      'Môi trường làm việc văn minh, bền vững hàng đầu Việt Nam.',
    ],
    tags: ['Brand Manager', 'Marketing', 'FMCG', 'Vinamilk', 'Branding'],
  },
  {
    id: 'job-007',
    title: 'Chuyên viên Kế toán Thuế & Quản trị Doanh nghiệp',
    company: 'Ngân Hàng TMCP Việt Nam Thịnh Vượng (VPBank)',
    companyId: 'vpbank',
    location: 'Đống Đa, Hà Nội',
    locationCode: 'HN',
    experience: '1 - 3 năm kinh nghiệm',
    experienceCode: '1_3',
    level: 'Chuyên viên / Staff',
    levelCode: 'STAFF',
    salaryText: '20 - 32 Triệu VND',
    salaryMin: 20000000,
    salaryMax: 32000000,
    salaryCode: '20_35',
    postedTime: '10 giờ trước',
    deadline: '12/12/2026',
    quantity: 2,
    workingTime: 'Thứ 2 - Thứ 6 (8:00 - 17:15)',
    employmentType: 'Toàn thời gian cố định',
    industry: 'Ngân hàng & Dịch vụ Tài chính',
    companySize: '15,000+ nhân viên',
    website: 'https://vpbank.com.vn',
    address: '89 Láng Hạ, Đống Đa, Hà Nội',
    companyDescription:
      'VPBank là một trong những ngân hàng tư nhân lớn nhất Việt Nam, dẫn đầu về hiệu quả hoạt động, chuyển đổi số hóa và cam kết đem lại giá trị thịnh vượng bền vững cho xã hội.',
    descriptionParagraphs: [
      'Đảm nhiệm công tác hạch toán kế toán, quản trị thuế và phân tích chi phí vận hành cho các khối kinh doanh trọng điểm của hội sở chính.',
    ],
    responsibilities: [
      'Lập và nộp các báo cáo thuế định kỳ (GTGT, TNDN, TNCN) tuân thủ chặt chẽ quy định của Tổng cục Thuế.',
      'Kiểm soát tính hợp lệ của hóa đơn, chứng từ chi phí và luồng tiền thanh toán nội bộ.',
      'Lập báo cáo tài chính quản trị hàng tháng phục vụ phân tích lợi nhuận từng phân khúc.',
      'Làm việc trực tiếp với các đoàn kiểm toán độc lập và thanh tra thuế.',
    ],
    requirements: [
      'Tốt nghiệp Đại học chuyên ngành Kế toán, Kiểm toán, Tài chính Ngân hàng (ưu tiên HVTC, NEU, FTU).',
      'Tối thiểu 2 năm kinh nghiệm kế toán tổng hợp hoặc kế toán thuế, có chứng chỉ CPA/ACCA là lợi thế lớn.',
      'Cẩn trọng, trung thực, tinh thần trách nhiệm cao và khả năng chịu áp lực số liệu.',
      'Sử dụng thành thạo phần mềm kế toán và Excel nâng cao.',
    ],
    benefits: [
      'Mức thu nhập 20.000.000 - 32.000.000 VND + Thưởng lễ, tết, sinh nhật ngân hàng phong phú.',
      'Gói vay ưu đãi lãi suất đặc quyền dành riêng cho cán bộ nhân viên VPBank.',
      'Chế độ bảo hiểm sức khỏe Bảo Việt cao cấp.',
      'Cơ hội thăng tiến lên Trưởng nhóm Kế toán quản trị sau 1 - 2 năm.',
    ],
    tags: ['Kế toán thuế', 'Báo cáo tài chính', 'Kiểm toán', 'VPBank', 'Kế toán'],
  },
  {
    id: 'job-008',
    title: 'Fullstack Engineer (Node.js & React Native / Web)',
    company: 'V-Tech Solutions Global',
    companyId: 'vtech',
    location: 'Remote (Toàn quốc / Làm việc từ xa)',
    locationCode: 'REMOTE',
    experience: '3 - 5 năm kinh nghiệm',
    experienceCode: '3_5',
    level: 'Chuyên viên cao cấp / Senior',
    levelCode: 'STAFF',
    salaryText: '28 - 48 Triệu VND',
    salaryMin: 28000000,
    salaryMax: 48000000,
    salaryCode: '20_35',
    postedTime: 'Hôm nay',
    deadline: '18/12/2026',
    quantity: 3,
    workingTime: '100% Remote, Giờ làm việc linh hoạt theo múi giờ VN (GMT+7)',
    employmentType: 'Toàn thời gian (Remote)',
    industry: 'Phần mềm & Trí tuệ Nhân tạo',
    companySize: '200+ nhân viên',
    website: 'https://vtech.dev',
    address: 'Tầng 18, Toà nhà Keangnam Landmark 72, Mễ Trì, Nam Từ Liêm, Hà Nội',
    companyDescription:
      'V-Tech Solutions chuyên phát triển các nền tảng SaaS B2B và giải pháp Trí tuệ Nhân tạo AI cho các doanh nghiệp tại thị trường Singapore, Úc và Bắc Mỹ.',
    descriptionParagraphs: [
      'Cơ hội làm việc từ xa 100% với mức đãi ngộ hấp dẫn, tham gia phát triển sản phẩm công nghệ AI Agent và tự động hoá quy trình doanh nghiệp thế hệ mới.',
    ],
    responsibilities: [
      'Phát triển API Backend với Node.js (NestJS, Fastify) và cơ sở dữ liệu PostgreSQL, Redis.',
      'Xây dựng giao diện người dùng Web (React/Next) và Mobile (React Native) chuẩn thiết kế.',
      'Tích hợp các mô hình ngôn ngữ lớn (LLMs qua OpenAI, Anthropic, LangChain).',
      'Đảm bảo chất lượng mã nguồn thông qua automated tests và CI/CD deployment.',
    ],
    requirements: [
      'Tối thiểu 3 năm kinh nghiệm lập trình Fullstack với Node.js và React/React Native.',
      'Hiểu sâu về kiến trúc RESTful API, GraphQL, WebSockets và Event-driven architecture.',
      'Có kinh nghiệm làm việc remote tự giác, giao tiếp tiếng Anh tốt.',
      'Đam mê ứng dụng Generative AI và các công nghệ mới nổi.',
    ],
    benefits: [
      'Lương 28.000.000 - 48.000.000 VND, nhận lương đúng ngày qua ngân hàng.',
      '100% làm việc từ xa, hỗ trợ kinh phí thiết lập không gian làm việc tại nhà (Home Office Setup).',
      'Nghỉ phép 15 ngày/năm + 3 ngày nghỉ lễ đặc biệt của công ty.',
      'Được cấp tài khoản OpenAI Pro, Claude Pro và các công cụ AI cao cấp.',
    ],
    tags: ['Node.js', 'React', 'React Native', 'Remote', 'PostgreSQL', 'AI'],
    isHot: true,
  },
  {
    id: 'job-009',
    title: 'DevOps & AI Infrastructure Engineer (MLOps/K8s)',
    company: 'NovaTech Innovation Hub',
    companyId: 'novatech',
    location: 'Hải Châu, Đà Nẵng',
    locationCode: 'DN',
    experience: '3 - 5 năm kinh nghiệm',
    experienceCode: '3_5',
    level: 'Chuyên viên cao cấp / Senior',
    levelCode: 'STAFF',
    salaryText: '35 - 55 Triệu VND',
    salaryMin: 35000000,
    salaryMax: 55000000,
    salaryCode: 'OVER_35',
    postedTime: 'Hôm nay',
    deadline: '22/12/2026',
    quantity: 2,
    workingTime: 'Thứ 2 - Thứ 6 (8:30 - 17:30)',
    employmentType: 'Toàn thời gian cố định',
    industry: 'SaaS & Trí tuệ Nhân tạo',
    companySize: '500+ nhân viên',
    website: 'https://novatech.io',
    address: 'Công viên Phần mềm Đà Nẵng, 02 Quang Trung, Hải Châu, Đà Nẵng',
    companyDescription:
      'NovaTech Hub là trung tâm R&D công nghệ cao hàng đầu tại miền Trung, tập trung vào các giải pháp thị giác máy tính, xử lý ngôn ngữ tự nhiên và hạ tầng dữ liệu thông minh.',
    descriptionParagraphs: [
      'Bạn sẽ là kiến trúc sư vận hành các cụm máy chủ GPU hiệu năng cao, tối ưu hóa pipeline huấn luyện và suy luận mô hình AI phục vụ hàng triệu truy vấn mỗi ngày.',
    ],
    responsibilities: [
      'Triển khai và vận hành các cụm Kubernetes (EKS/GKE) với GPU acceleration phục vụ model serving.',
      'Xây dựng quy trình MLOps tự động hóa từ Data Versioning, Model Training đến Deployment.',
      'Tối ưu chi phí hạ tầng điện toán đám mây và giám sát hệ thống với Prometheus, Grafana.',
      'Đảm bảo thời gian hoạt động của dịch vụ (SLA) đạt tối thiểu 99.95%.',
    ],
    requirements: [
      'Tối thiểu 3 năm kinh nghiệm trong vai trò DevOps hoặc MLOps Engineer.',
      'Thành thạo Kubernetes, Docker, Terraform và CI/CD (GitLab CI/GitHub Actions).',
      'Có kinh nghiệm quản trị hạ tầng GPU, các framework serving (Triton, vLLM, Ray).',
      'Tư duy giải quyết sự cố nhạy bén và kỹ năng làm việc nhóm tốt.',
    ],
    benefits: [
      'Mức lương 35.000.000 - 55.000.000 VND kèm trợ cấp thu hút nhân tài Đà Nẵng.',
      'Thưởng gia nhập (Sign-on Bonus) cho ứng viên xuất sắc.',
      'Văn phòng view cầu Rồng tuyệt đẹp, trà, cà phê, đồ ăn nhẹ miễn phí cả ngày.',
      'Tài trợ 100% kinh phí thi các chứng chỉ quốc tế CKA, CKAD, AWS DevOps.',
    ],
    tags: ['DevOps', 'MLOps', 'Kubernetes', 'GPU', 'Đà Nẵng'],
  },
];

// ── Modal Thông Báo / Đăng Nhập Nhanh Cho Khách Vãng Lai ───────────────────
interface GuestApplyModalProps {
  open: boolean;
  jobTitle: string;
  companyName: string;
  onClose: () => void;
  onLogin: () => void;
  onRegister: () => void;
}

const GuestApplyNoticeModal: React.FC<GuestApplyModalProps> = ({
  open,
  jobTitle,
  companyName,
  onClose,
  onLogin,
  onRegister,
}) => {
  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      centered
      width={480}
      className="guest-apply-modal"
    >
      <div className="p-2 sm:p-4 text-center">
        {/* Icon Lock/Login Highlight */}
        <div className="mx-auto w-14 h-14 rounded-2xl bg-blue-50 border border-blue-200/60 flex items-center justify-center text-blue-600 mb-4 shadow-xs">
          <Zap className="h-7 w-7 text-blue-600 fill-blue-600" />
        </div>

        <h3 className="text-xl font-bold text-slate-900 m-0 mb-1.5">
          Đăng nhập để ứng tuyển ngay
        </h3>
        <p className="text-xs text-slate-500 m-0 mb-4">
          Bạn đang xem vị trí <strong className="text-slate-800">{jobTitle}</strong> tại{' '}
          <strong className="text-slate-800">{companyName}</strong>.
        </p>

        <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 text-left text-xs text-slate-600 mb-5 space-y-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>Nộp hồ sơ 1-chạm không mất thời gian điền lại thông tin</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>Theo dõi trạng thái xem hồ sơ và phản hồi phỏng vấn minh bạch</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>Hệ sinh thái bảo vệ danh tính và bảo mật thông tin cá nhân tuyệt đối</span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2.5">
          <button
            type="button"
            onClick={onLogin}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm py-2.5 px-4 rounded-xl shadow-sm transition-all active:scale-[0.98] cursor-pointer border-0"
          >
            Đăng nhập ngay
          </button>
          <button
            type="button"
            onClick={onRegister}
            className="flex-1 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-semibold text-sm py-2.5 px-4 rounded-xl transition-colors cursor-pointer"
          >
            Đăng ký tài khoản
          </button>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-3.5 text-xs text-slate-400 hover:text-slate-600 transition-colors bg-transparent border-0 cursor-pointer"
        >
          Để sau, tiếp tục xem tin khác
        </button>
      </div>
    </Modal>
  );
};

// ── Modal Xác Nhận Gửi CV Nhanh Bằng CV Mặc Định Cho Người Đã Đăng Nhập ──────
interface AuthenticatedApplyModalProps {
  open: boolean;
  jobTitle: string;
  companyName: string;
  onClose: () => void;
  onConfirm: () => void;
}

const AuthenticatedApplyModal: React.FC<AuthenticatedApplyModalProps> = ({
  open,
  jobTitle,
  companyName,
  onClose,
  onConfirm,
}) => {
  const [selectedCv, setSelectedCv] = useState<'default' | 'new'>('default');
  const [coverNote, setCoverNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = () => {
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      onConfirm();
      onClose();
    }, 400);
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      centered
      width={500}
      className="auth-apply-modal"
    >
      <div className="p-2 sm:p-3">
        {/* Header Modal */}
        <div className="flex items-start gap-3 pb-3 border-b border-slate-200/80 mb-4">
          <div className="w-11 h-11 rounded-xl bg-blue-50 border border-blue-200/60 flex items-center justify-center text-blue-600 shrink-0 shadow-2xs">
            <Zap className="h-6 w-6 text-blue-600 fill-blue-600" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900 m-0">
              Xác nhận ứng tuyển nhanh
            </h3>
            <p className="text-xs text-slate-500 m-0 mt-0.5">
              Vị trí <strong className="text-slate-800">{jobTitle}</strong> tại{' '}
              <strong className="text-slate-800">{companyName}</strong>
            </p>
          </div>
        </div>

        {/* Lựa chọn CV */}
        <div className="space-y-2.5 mb-4">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
            Hồ sơ gửi tới nhà tuyển dụng
          </span>

          {/* Option 1: CV Mặc định */}
          <div
            onClick={() => setSelectedCv('default')}
            className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
              selectedCv === 'default'
                ? 'border-2 border-blue-600 bg-blue-50/20 shadow-xs'
                : 'border-slate-200 hover:border-slate-300 bg-white'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-red-50 text-red-600 border border-red-200/60 flex items-center justify-center shrink-0">
                <span className="text-[10px] font-black uppercase">PDF</span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-900">
                    CV_Chinh_Nguyen_Van_A_2026.pdf
                  </span>
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                    CV Mặc định
                  </span>
                </div>
                <span className="text-[11px] text-slate-500">
                  Cập nhật gần nhất · Đã lưu trong kho hồ sơ HR Connect
                </span>
              </div>
            </div>
            <div
              className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                selectedCv === 'default' ? 'border-blue-600 bg-blue-600' : 'border-slate-300'
              }`}
            >
              {selectedCv === 'default' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
            </div>
          </div>

          {/* Option 2: Tải CV mới */}
          <div
            onClick={() => setSelectedCv('new')}
            className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
              selectedCv === 'new'
                ? 'border-2 border-blue-600 bg-blue-50/20 shadow-xs'
                : 'border-slate-200 hover:border-slate-300 bg-white'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-slate-100 text-slate-500 border border-slate-200 flex items-center justify-center shrink-0 font-bold">
                +
              </div>
              <div>
                <span className="text-xs font-semibold text-slate-700">
                  Tải lên CV khác từ thiết bị
                </span>
                <span className="text-[11px] text-slate-400 block">
                  Định dạng PDF, tối đa 5MB
                </span>
              </div>
            </div>
            <div
              className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                selectedCv === 'new' ? 'border-blue-600 bg-blue-600' : 'border-slate-300'
              }`}
            >
              {selectedCv === 'new' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
            </div>
          </div>
        </div>

        {/* Lời nhắn kèm */}
        <div className="mb-4">
          <label className="text-xs font-semibold text-slate-700 block mb-1">
            Lời nhắn ngắn đến nhà tuyển dụng (Tùy chọn)
          </label>
          <textarea
            rows={2}
            value={coverNote}
            onChange={(e) => setCoverNote(e.target.value)}
            placeholder="Kính gửi quý công ty, tôi rất quan tâm và tự tin phù hợp với vị trí này..."
            className="w-full bg-[#f2f3ff]/50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 resize-none font-sans"
          />
        </div>

        {/* Footer Buttons */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors border border-slate-200 cursor-pointer bg-white"
          >
            Hủy
          </button>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={handleSubmit}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs sm:text-sm py-2 px-5 rounded-lg shadow-sm transition-all active:scale-[0.98] cursor-pointer border-0 flex items-center gap-1.5 disabled:opacity-50"
          >
            <Zap className="h-4 w-4 fill-white" />
            <span>{isSubmitting ? 'Đang gửi hồ sơ...' : 'Xác nhận gửi hồ sơ'}</span>
          </button>
        </div>
      </div>
    </Modal>
  );
};

// ── Main PublicJobSplitDiscovery Component ──────────────────────────────────
export const PublicJobSplitDiscovery: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();

  // Đọc params từ URL (từ Trang chủ chuyển sang hoặc user reload)
  const queryKeyword = searchParams.get('keyword') || searchParams.get('q') || '';
  const queryLocation = searchParams.get('location') || 'ALL';
  const querySalary = searchParams.get('salary') || 'ALL';
  const queryExperience = searchParams.get('experience') || 'ALL';
  const queryLevel = searchParams.get('level') || 'ALL';
  const queryCategory = searchParams.get('category') || '';
  const queryCompany = searchParams.get('company') || '';

  // Local state cho bộ lọc
  const [keyword, setKeyword] = useState(queryKeyword);
  const [location, setLocation] = useState(queryLocation);
  const [salary, setSalary] = useState(querySalary);
  const [experience, setExperience] = useState(queryExperience);
  const [level, setLevel] = useState(queryLevel);

  // Đồng bộ khi URL thay đổi (Back/Forward hoặc từ Navbar/Banner)
  useEffect(() => {
    setKeyword(queryKeyword);
    setLocation(queryLocation);
    setSalary(querySalary);
    setExperience(queryExperience);
    setLevel(queryLevel);
  }, [queryKeyword, queryLocation, querySalary, queryExperience, queryLevel]);

  // Thực hiện tìm kiếm & cập nhật URL
  const applyFilters = (
    kw = keyword,
    loc = location,
    sal = salary,
    exp = experience,
    lvl = level
  ) => {
    const params = new URLSearchParams();
    if (kw.trim()) params.set('keyword', kw.trim());
    if (loc && loc !== 'ALL') params.set('location', loc);
    if (sal && sal !== 'ALL') params.set('salary', sal);
    if (exp && exp !== 'ALL') params.set('experience', exp);
    if (lvl && lvl !== 'ALL') params.set('level', lvl);
    if (queryCategory) params.set('category', queryCategory);
    if (queryCompany) params.set('company', queryCompany);

    setSearchParams(params);
  };

  const handleResetFilters = () => {
    setKeyword('');
    setLocation('ALL');
    setSalary('ALL');
    setExperience('ALL');
    setLevel('ALL');
    setSearchParams(new URLSearchParams());
  };

  // State bookmarks
  const [savedJobIds, setSavedJobIds] = useState<Set<string>>(new Set(['job-001']));

  const handleToggleBookmark = (e: React.MouseEvent, jobId: string, jobTitle: string) => {
    e.stopPropagation();
    setSavedJobIds((prev) => {
      const next = new Set(prev);
      if (next.has(jobId)) {
        next.delete(jobId);
        void message.info(`Đã bỏ lưu "${jobTitle}"`);
      } else {
        next.add(jobId);
        void message.success(`Đã lưu "${jobTitle}" vào danh sách yêu thích!`);
      }
      return next;
    });
  };

  // Lấy dữ liệu từ API công khai (nếu có backend đang chạy)
  const apiSearchParams = useMemo(
    () => ({
      search: queryKeyword || undefined,
      location: queryLocation !== 'ALL' ? queryLocation : undefined,
      page: 1,
      pageSize: 20,
    }),
    [queryKeyword, queryLocation]
  );
  const { data: apiData, isLoading: isApiLoading } = usePublicJobSearch(apiSearchParams, true);

  // Kết hợp API items với Fallback Rich Jobs
  const allAvailableJobs = useMemo(() => {
    // Nếu API backend trả về danh sách có dữ liệu, chuyển đổi sang format chung
    if (apiData && apiData.items && apiData.items.length > 0) {
      return apiData.items.map((job: Job): PublicJobItem => {
        return {
          id: job.jobId,
          title: job.title,
          company: job.companyName || 'Doanh nghiệp tuyển dụng',
          companyId: job.companyId || 'default',
          location: job.location || 'Toàn quốc',
          locationCode: job.location?.toLowerCase().includes('hà nội')
            ? 'HN'
            : job.location?.toLowerCase().includes('hồ chí minh') || job.location?.toLowerCase().includes('hcm')
              ? 'HCM'
              : job.location?.toLowerCase().includes('đà nẵng')
                ? 'DN'
                : 'REMOTE',
          experience: job.minExperienceYears ? `${job.minExperienceYears}+ năm kinh nghiệm` : 'Không yêu cầu kinh nghiệm',
          experienceCode: !job.minExperienceYears
            ? 'NO_EXP'
            : job.minExperienceYears < 1
              ? 'UNDER_1'
              : job.minExperienceYears <= 3
                ? '1_3'
                : job.minExperienceYears <= 5
                  ? '3_5'
                  : 'OVER_5',
          level: 'Chuyên viên / Staff',
          levelCode: 'STAFF',
          salaryText: job.salaryNegotiable
            ? 'Thỏa thuận'
            : job.salaryMin && job.salaryMax
              ? `${(job.salaryMin / 1000000).toFixed(0)} - ${(job.salaryMax / 1000000).toFixed(0)} Triệu VND`
              : 'Thỏa thuận hấp dẫn',
          salaryCode: 'OVER_35',
          postedTime: 'Gần đây',
          deadline: job.applicationDeadline || 'Đang mở',
          quantity: job.quantity || 1,
          workingTime: job.workingTime || 'Toàn thời gian cố định',
          employmentType: job.employmentType || 'Toàn thời gian',
          industry: job.company?.industry || 'Công nghệ & Dịch vụ',
          companySize: job.company?.companySize || '100 - 500 nhân viên',
          website: job.company?.website || 'https://hrconnect.vn',
          address: job.company?.address || job.location || 'Việt Nam',
          companyDescription: job.company?.description || 'Doanh nghiệp tuyển dụng uy tín đối tác của HR Connect.',
          descriptionParagraphs: [job.description || 'Chưa cập nhật mô tả chi tiết.'],
          responsibilities: job.requirements?.map((r) => r.content) || ['Thực hiện các nhiệm vụ chuyên môn theo yêu cầu.'],
          requirements: job.requirements?.map((r) => r.content) || ['Kỹ năng chuyên môn phù hợp với vị trí.'],
          benefits: job.benefits ? [job.benefits] : ['Lương thưởng cạnh tranh, bảo hiểm đầy đủ, môi trường phát triển tốt.'],
          tags: job.skills?.map((s) => s.skillName || '').filter(Boolean) || ['Việc làm mới'],
        };
      });
    }

    // Khi backend rỗng hoặc offline, dùng danh sách mock chất lượng cao
    return FALLBACK_JOBS;
  }, [apiData]);

  // Bộ lọc Client-Side tinh vi dựa trên query params
  const filteredJobs = useMemo(() => {
    return allAvailableJobs.filter((job) => {
      // 1. Lọc từ khóa
      if (queryKeyword.trim()) {
        const kw = queryKeyword.toLowerCase().trim();
        const matchTitle = job.title.toLowerCase().includes(kw);
        const matchCompany = job.company.toLowerCase().includes(kw);
        const matchTag = job.tags.some((t) => t.toLowerCase().includes(kw));
        if (!matchTitle && !matchCompany && !matchTag) return false;
      }

      // 2. Lọc địa điểm
      if (queryLocation !== 'ALL') {
        if (queryLocation === 'HN' && !job.location.toLowerCase().includes('hà nội')) return false;
        if (queryLocation === 'HCM' && !job.location.toLowerCase().includes('hồ chí minh') && !job.location.toLowerCase().includes('hcm')) return false;
        if (queryLocation === 'DN' && !job.location.toLowerCase().includes('đà nẵng')) return false;
        if (queryLocation === 'BD' && !job.location.toLowerCase().includes('bình dương')) return false;
        if (queryLocation === 'REMOTE' && !job.location.toLowerCase().includes('remote') && !job.location.toLowerCase().includes('toàn quốc')) return false;
      }

      // 3. Lọc mức lương
      if (querySalary !== 'ALL') {
        if (querySalary === 'NEGOTIABLE' && !job.salaryText.toLowerCase().includes('thỏa thuận')) return false;
        if (querySalary === 'UNDER_10' && (job.salaryMin ?? 0) >= 10000000) return false;
        if (querySalary === '10_20' && ((job.salaryMin ?? 0) > 20000000 || (job.salaryMax ?? 0) < 10000000)) return false;
        if (querySalary === '20_35' && ((job.salaryMin ?? 0) > 35000000 || (job.salaryMax ?? 0) < 20000000)) return false;
        if (querySalary === 'OVER_35' && (job.salaryMax ?? 50000000) < 35000000) return false;
      }

      // 4. Lọc kinh nghiệm
      if (queryExperience !== 'ALL') {
        if (job.experienceCode !== queryExperience) return false;
      }

      // 5. Lọc cấp bậc
      if (queryLevel !== 'ALL') {
        if (job.levelCode !== queryLevel) return false;
      }

      // 6. Lọc công ty
      if (queryCompany.trim()) {
        if (!job.company.toLowerCase().includes(queryCompany.toLowerCase().trim())) return false;
      }

      // 7. Lọc danh mục ngành nghề (từ Trang chủ / Trending Categories)
      if (queryCategory.trim()) {
        const cat = queryCategory.toUpperCase().trim();
        const fullText = (job.title + ' ' + job.industry + ' ' + (job.tags || []).join(' ')).toLowerCase();
        if (cat === 'IT' && !fullText.match(/it|công nghệ|software|frontend|backend|engineer|developer|devops|data|react|tech/i)) return false;
        if (cat === 'SALES' && !fullText.match(/sales|kinh doanh|bán hàng|account|khách hàng/i)) return false;
        if (cat === 'MARKETING' && !fullText.match(/marketing|truyền thông|pr|growth|content|quảng cáo/i)) return false;
        if (cat === 'FINANCE' && !fullText.match(/finance|tài chính|ngân hàng|banking|fintech/i)) return false;
        if (cat === 'ACCOUNTING' && !fullText.match(/kế toán|kiểm toán|accounting|thuế/i)) return false;
        if (cat === 'HR' && !fullText.match(/nhân sự|tuyển dụng|hr|talent|hành chính/i)) return false;
        if (cat === 'DESIGN' && !fullText.match(/design|ui\/ux|thiết kế|sáng tạo|art/i)) return false;
        if (cat === 'REAL_ESTATE' && !fullText.match(/bất động sản|xây dựng|địa ốc/i)) return false;
        if (cat === 'CS' && !fullText.match(/chăm sóc khách hàng|support|tư vấn|customer/i)) return false;
      }

      return true;
    });
  }, [allAvailableJobs, queryKeyword, queryLocation, querySalary, queryExperience, queryLevel, queryCompany, queryCategory]);

  // Job được chọn hiển thị ở cột phải
  const [selectedJobId, setSelectedJobId] = useState<string>('');

  // Tự động chọn job đầu tiên khi danh sách kết quả thay đổi
  useEffect(() => {
    if (filteredJobs.length > 0) {
      // Nếu job đang chọn không nằm trong danh sách mới, chuyển về job đầu tiên
      const exists = filteredJobs.some((j) => j.id === selectedJobId);
      if (!exists) {
        setSelectedJobId(filteredJobs[0].id);
      }
    } else {
      setSelectedJobId('');
    }
  }, [filteredJobs, selectedJobId]);

  const selectedJob = useMemo(() => {
    return filteredJobs.find((j) => j.id === selectedJobId) || filteredJobs[0] || null;
  }, [filteredJobs, selectedJobId]);

  // Quản lý Modal Đăng nhập nhanh cho Guest & Modal Ứng tuyển cho Authenticated User
  const [guestModalOpen, setGuestModalOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [appliedJobIds, setAppliedJobIds] = useState<Set<string>>(new Set());

  const handleApplyClick = () => {
    if (!isAuthenticated) {
      setGuestModalOpen(true);
      return;
    }

    if (selectedJob && appliedJobIds.has(selectedJob.id)) {
      void message.info(`Bạn đã nộp hồ sơ vào vị trí "${selectedJob.title}" rồi.`);
      return;
    }

    setAuthModalOpen(true);
  };

  const handleConfirmAuthApply = () => {
    if (selectedJob) {
      setAppliedJobIds((prev) => new Set([...prev, selectedJob.id]));
      void message.success(`Ứng tuyển thành công vị trí "${selectedJob.title}"! Nhà tuyển dụng sẽ xem xét hồ sơ của bạn sớm nhất.`);
    }
  };

  const handleGuestLogin = () => {
    setGuestModalOpen(false);
    navigate('/login', { state: { from: `/jobs?keyword=${encodeURIComponent(queryKeyword)}` } });
  };

  const handleGuestRegister = () => {
    setGuestModalOpen(false);
    navigate('/register?role=CANDIDATE');
  };

  const handleClearCategory = () => {
    const params = new URLSearchParams(searchParams);
    params.delete('category');
    setSearchParams(params);
  };

  const handleShareJob = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      void message.success('Đã sao chép liên kết việc làm vào bộ nhớ tạm!');
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans">
      {/* 1. TOP NAVBAR CHUẨN */}
      <Navbar />

      {/* 2. STICKY COMPREHENSIVE FILTER BAR */}
      <section className="bg-white border-b border-slate-200/80 p-4 sticky top-16 z-20 shadow-xs transition-all">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-wrap lg:flex-nowrap items-center gap-2.5">
            {/* Ô tìm kiếm từ khóa */}
            <div className="flex-1 min-w-[220px] relative flex items-center bg-[#f2f3ff] rounded-xl px-3 py-2 border border-slate-200/60 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 transition-all">
              <Search className="h-4 w-4 text-blue-600 shrink-0 mr-2" strokeWidth={2} />
              <input
                type="text"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
                placeholder="Vị trí, kỹ năng, công ty..."
                className="w-full bg-transparent border-0 focus:outline-none text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 font-medium"
              />
            </div>

            {/* Dropdown Tỉnh/Thành phố */}
            <div className="w-full sm:w-auto min-w-[130px] relative flex items-center bg-[#f2f3ff] rounded-xl px-2.5 py-2 border border-slate-200/60 focus-within:border-blue-500 transition-all">
              <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0 mr-1.5" strokeWidth={2} />
              <select
                value={location}
                onChange={(e) => {
                  setLocation(e.target.value);
                  applyFilters(keyword, e.target.value, salary, experience, level);
                }}
                aria-label="Chọn Tỉnh/Thành phố"
                className="w-full bg-transparent border-0 focus:outline-none text-xs text-slate-700 font-medium cursor-pointer"
              >
                {LOCATION_FILTER_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Dropdown Mức lương */}
            <div className="w-full sm:w-auto min-w-[130px] relative flex items-center bg-[#f2f3ff] rounded-xl px-2.5 py-2 border border-slate-200/60 focus-within:border-blue-500 transition-all">
              <DollarSign className="h-3.5 w-3.5 text-slate-400 shrink-0 mr-1.5" strokeWidth={2} />
              <select
                value={salary}
                onChange={(e) => {
                  setSalary(e.target.value);
                  applyFilters(keyword, location, e.target.value, experience, level);
                }}
                aria-label="Chọn Mức lương"
                className="w-full bg-transparent border-0 focus:outline-none text-xs text-slate-700 font-medium cursor-pointer"
              >
                {SALARY_FILTER_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Dropdown Kinh nghiệm */}
            <div className="w-full sm:w-auto min-w-[140px] relative flex items-center bg-[#f2f3ff] rounded-xl px-2.5 py-2 border border-slate-200/60 focus-within:border-blue-500 transition-all">
              <Briefcase className="h-3.5 w-3.5 text-slate-400 shrink-0 mr-1.5" strokeWidth={2} />
              <select
                value={experience}
                onChange={(e) => {
                  setExperience(e.target.value);
                  applyFilters(keyword, location, salary, e.target.value, level);
                }}
                aria-label="Chọn Kinh nghiệm"
                className="w-full bg-transparent border-0 focus:outline-none text-xs text-slate-700 font-medium cursor-pointer"
              >
                {EXPERIENCE_FILTER_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Dropdown Cấp bậc */}
            <div className="w-full sm:w-auto min-w-[130px] relative flex items-center bg-[#f2f3ff] rounded-xl px-2.5 py-2 border border-slate-200/60 focus-within:border-blue-500 transition-all">
              <Award className="h-3.5 w-3.5 text-slate-400 shrink-0 mr-1.5" strokeWidth={2} />
              <select
                value={level}
                onChange={(e) => {
                  setLevel(e.target.value);
                  applyFilters(keyword, location, salary, experience, e.target.value);
                }}
                aria-label="Chọn Cấp bậc"
                className="w-full bg-transparent border-0 focus:outline-none text-xs text-slate-700 font-medium cursor-pointer"
              >
                {LEVEL_FILTER_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Nút Action: Lọc kết quả + Xóa bộ lọc */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => applyFilters()}
                className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-5 py-2 rounded-lg text-xs sm:text-sm shadow-sm transition-all active:scale-[0.98] flex items-center justify-center gap-1.5 cursor-pointer border-0 whitespace-nowrap"
              >
                <Filter className="h-3.5 w-3.5" />
                <span>Lọc kết quả</span>
              </button>
              <button
                type="button"
                onClick={handleResetFilters}
                className="text-slate-600 hover:text-red-600 hover:bg-slate-100 font-medium px-3.5 py-2 rounded-lg border border-slate-200 transition-colors cursor-pointer text-xs whitespace-nowrap bg-white"
                title="Xóa tất cả bộ lọc"
              >
                <RotateCcw className="h-3.5 w-3.5 inline mr-1" />
                <span>Xóa bộ lọc</span>
              </button>
            </div>
          </div>

          {/* Active Category Chip / Active Filter Pill */}
          {queryCategory && (
            <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center gap-2 text-xs">
              <span className="text-slate-500 font-medium">Đang lọc theo ngành:</span>
              <span className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-700 font-semibold px-2.5 py-0.5 rounded-full border border-blue-200/60">
                <span>{CATEGORY_NAMES[queryCategory.toUpperCase()] || queryCategory}</span>
                <button
                  type="button"
                  onClick={handleClearCategory}
                  className="hover:text-red-600 font-bold ml-1 cursor-pointer bg-transparent border-0 p-0 text-blue-600"
                  title="Bỏ lọc ngành này"
                >
                  ×
                </button>
              </span>
            </div>
          )}
        </div>
      </section>

      {/* 3. BỐ CỤC CHIA ĐÔI MÀN HÌNH (SPLIT-VIEW LAYOUT 2 CỘT) */}
      <main className="max-w-7xl mx-auto px-4 py-4 grid grid-cols-1 lg:grid-cols-12 gap-5 h-[calc(100vh-140px)]">
        {/* =============================================================== */}
        {/* CỘT TRÁI (5 CỘT / ~42%): DANH SÁCH VIỆC LÀM RÚT GỌN             */}
        {/* =============================================================== */}
        <section className="lg:col-span-5 h-full flex flex-col min-h-0">
          {/* Đỉnh cột: Hiển thị tổng số lượng việc tìm thấy */}
          <div className="flex items-center justify-between pb-2.5 mb-2 border-b border-slate-200/80 shrink-0">
            <span className="text-xs sm:text-sm text-slate-600">
              Tìm thấy <strong className="text-slate-900 font-extrabold text-blue-600">{filteredJobs.length}</strong> việc làm phù hợp
            </span>
            <span className="text-xs text-slate-400 font-medium">Cập nhật liên tục</span>
          </div>

          {/* Khung cuộn mượt độc lập */}
          <div className="flex-1 overflow-y-auto pr-2 space-y-3 scrollbar-thin">
            {filteredJobs.length === 0 ? (
              <div className="bg-white rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-500 my-4">
                <Briefcase className="h-10 w-10 mx-auto text-slate-400 mb-2 opacity-50" />
                <p className="text-sm font-semibold text-slate-700 m-0">Không tìm thấy việc làm phù hợp</p>
                <p className="text-xs text-slate-400 mt-1 mb-3">Vui lòng thử bỏ bớt điều kiện lọc hoặc tìm kiếm từ khóa khác.</p>
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="bg-blue-50 text-blue-600 hover:bg-blue-100 font-medium text-xs px-3.5 py-1.5 rounded-lg transition-colors cursor-pointer border-0"
                >
                  Xóa toàn bộ bộ lọc
                </button>
              </div>
            ) : (
              filteredJobs.map((job) => {
                const isSelected = selectedJob?.id === job.id;
                const isSaved = savedJobIds.has(job.id);
                const isApplied = appliedJobIds.has(job.id);

                return (
                  <div
                    key={job.id}
                    onClick={() => setSelectedJobId(job.id)}
                    className={`rounded-xl p-3.5 transition-all duration-200 cursor-pointer flex flex-col justify-between group relative ${
                      isSelected
                        ? 'border-2 border-blue-600 bg-blue-50/20 shadow-xs'
                        : 'border border-slate-200/90 bg-white hover:border-blue-300 hover:shadow-sm'
                    }`}
                  >
                    <div>
                      {/* Top row: Logo + Tên + Bookmark */}
                      <div className="flex items-start justify-between gap-2.5 mb-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          {/* Logo vuông vắn 44x44px bo góc nhẹ */}
                          <div className="w-[44px] h-[44px] rounded-lg p-1 bg-slate-50 border border-slate-200 flex items-center justify-center shrink-0 shadow-2xs overflow-hidden">
                            <CompanyLogo id={job.companyId} name={job.company} size={36} className="w-full h-full object-contain" />
                          </div>
                          <div className="min-w-0">
                            <h4 className="font-semibold text-slate-900 text-sm line-clamp-1 m-0">
                              {job.title}
                            </h4>
                            <p className="text-xs text-slate-500 line-clamp-1 mt-0.5 m-0">
                              {job.company}
                            </p>
                          </div>
                        </div>

                        {/* Nút bookmark nhỏ trên card */}
                        <button
                          type="button"
                          aria-label="Lưu tin"
                          onClick={(e) => handleToggleBookmark(e, job.id, job.title)}
                          className={`p-1 rounded-full transition-colors shrink-0 cursor-pointer border-0 ${
                            isSaved ? 'text-rose-500 bg-rose-50' : 'text-slate-300 hover:text-rose-500 hover:bg-slate-100'
                          }`}
                        >
                          <Heart className="h-4 w-4" fill={isSaved ? 'currentColor' : 'none'} />
                        </button>
                      </div>

                      {/* Mức lương xanh lá nổi bật */}
                      <div className="mb-2 flex items-center gap-2">
                        <span className="text-emerald-700 font-bold text-xs bg-emerald-50 px-2 py-0.5 rounded">
                          {job.salaryText}
                        </span>
                        {isApplied && (
                          <span className="text-emerald-700 bg-emerald-100/70 font-semibold text-[10px] px-1.5 py-0.5 rounded">
                            Đã nộp CV
                          </span>
                        )}
                      </div>

                      {/* Dải Tag: Địa điểm, Kinh nghiệm, Thời gian đăng */}
                      <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                        <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                          {job.locationCode === 'HN' ? 'Hà Nội' : job.locationCode === 'HCM' ? 'TP. HCM' : job.locationCode === 'DN' ? 'Đà Nẵng' : 'Toàn quốc'}
                        </span>
                        <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                          {job.experience}
                        </span>
                        <span className="text-slate-400 ml-auto flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {job.postedTime}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* =============================================================== */}
        {/* CỘT PHẢI (7 CỘT / ~58%): KHUNG XEM NHANH CHI TIẾT JD            */}
        {/* =============================================================== */}
        <section className="lg:col-span-7 h-full flex flex-col min-h-0 bg-white border border-slate-200/80 rounded-2xl p-6 overflow-y-auto shadow-xs flex flex-col justify-between scrollbar-thin">
          {selectedJob ? (
            <>
              <div>
                {/* Header JD */}
                <div className="pb-5 border-b border-slate-200/80">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3.5">
                      <div className="w-14 h-14 rounded-2xl p-2 bg-slate-50 border border-slate-200 flex items-center justify-center shrink-0 shadow-2xs">
                        <CompanyLogo id={selectedJob.companyId} name={selectedJob.company} size={48} className="w-full h-full object-contain" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-slate-600">{selectedJob.company}</span>
                          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full font-medium">
                            <ShieldCheck className="h-3 w-3" /> Đã xác thực
                          </span>
                        </div>
                        <h2 className="text-xl font-bold text-slate-900 mt-1 m-0">
                          {selectedJob.title}
                        </h2>
                      </div>
                    </div>

                    {/* Nút share nhanh */}
                    <button
                      type="button"
                      onClick={handleShareJob}
                      title="Chia sẻ việc làm"
                      className="p-2 rounded-xl text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer border border-slate-200 bg-white shrink-0"
                    >
                      <Share2 className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Mức lương to & Hạn nộp & Địa điểm */}
                  <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <span className="text-xs text-slate-400 block font-medium">Mức lương</span>
                      <span className="text-emerald-700 font-extrabold text-lg">
                        {selectedJob.salaryText}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="bg-slate-100 text-slate-700 font-medium px-2.5 py-1 rounded-lg flex items-center gap-1">
                        <MapPin className="h-3 w-3 text-slate-400" />
                        {selectedJob.location}
                      </span>
                      <span className="bg-blue-50 text-blue-700 font-medium px-2.5 py-1 rounded-lg flex items-center gap-1">
                        <Calendar className="h-3 w-3 text-blue-500" />
                        Hạn nộp: {selectedJob.deadline}
                      </span>
                    </div>
                  </div>

                  {/* Cụm Nút Hành Động */}
                  <div className="mt-5 flex items-center gap-3">
                    {appliedJobIds.has(selectedJob.id) ? (
                      <div className="flex-1 bg-emerald-50 text-emerald-700 border border-emerald-300 font-medium text-sm px-6 py-2.5 rounded-xl shadow-xs flex items-center justify-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        <span>Đã nộp CV thành công</span>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={handleApplyClick}
                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-2.5 rounded-xl shadow-sm transition-all active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer border-0"
                      >
                        <Zap className="h-4 w-4 fill-white" />
                        <span>Ứng tuyển ngay</span>
                        <span className="text-[11px] bg-blue-500/50 px-2 py-0.5 rounded-full font-normal">Nộp nhanh</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={(e) => handleToggleBookmark(e, selectedJob.id, selectedJob.title)}
                      className={`w-11 h-11 rounded-xl border flex items-center justify-center transition-colors cursor-pointer shrink-0 ${
                        savedJobIds.has(selectedJob.id)
                          ? 'text-rose-500 bg-rose-50 border-rose-200'
                          : 'text-slate-400 hover:text-rose-500 hover:bg-slate-50 border-slate-200'
                      }`}
                      title="Lưu tin tuyển dụng"
                    >
                      <Heart className="h-5 w-5" fill={savedJobIds.has(selectedJob.id) ? 'currentColor' : 'none'} />
                    </button>
                  </div>
                </div>

                {/* Thân JD (Trình bày phân đoạn mạch lạc) */}
                <div className="py-5 space-y-6 text-sm text-slate-700">
                  {/* 1. Mô tả công việc */}
                  <div>
                    <h3 className="text-base font-bold text-slate-900 mb-2 flex items-center gap-2">
                      <Briefcase className="h-4 w-4 text-blue-600" />
                      <span>Mô tả công việc</span>
                    </h3>
                    {selectedJob.descriptionParagraphs.map((p, idx) => (
                      <p key={idx} className="leading-relaxed mb-2 text-slate-600">
                        {p}
                      </p>
                    ))}
                    <ul className="list-disc pl-5 space-y-1.5 mt-2 text-slate-600">
                      {selectedJob.responsibilities.map((r, idx) => (
                        <li key={idx}>{r}</li>
                      ))}
                    </ul>
                  </div>

                  {/* 2. Yêu cầu ứng viên */}
                  <div>
                    <h3 className="text-base font-bold text-slate-900 mb-2 flex items-center gap-2">
                      <Award className="h-4 w-4 text-blue-600" />
                      <span>Yêu cầu ứng viên</span>
                    </h3>
                    <ul className="list-disc pl-5 space-y-1.5 text-slate-600">
                      {selectedJob.requirements.map((req, idx) => (
                        <li key={idx}>{req}</li>
                      ))}
                    </ul>
                  </div>

                  {/* 3. Quyền lợi & Đãi ngộ */}
                  <div>
                    <h3 className="text-base font-bold text-slate-900 mb-2 flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-amber-500" />
                      <span>Quyền lợi & Đãi ngộ</span>
                    </h3>
                    <ul className="list-disc pl-5 space-y-1.5 text-slate-600">
                      {selectedJob.benefits.map((b, idx) => (
                        <li key={idx}>{b}</li>
                      ))}
                    </ul>
                  </div>

                  {/* 4. Giới thiệu về công ty tuyển dụng và quy mô nhân sự */}
                  <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4.5">
                    <div className="flex items-center gap-3 mb-2.5">
                      <Building2 className="h-5 w-5 text-blue-600 shrink-0" />
                      <div>
                        <h4 className="font-bold text-slate-900 m-0 text-sm">{selectedJob.company}</h4>
                        <span className="text-xs text-slate-500">{selectedJob.industry} · {selectedJob.companySize}</span>
                      </div>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed m-0 mb-3">
                      {selectedJob.companyDescription}
                    </p>
                    <div className="text-xs text-slate-500 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-slate-200 pt-2.5">
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5 text-slate-400" />
                        {selectedJob.address}
                      </span>
                      <a
                        href={selectedJob.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-blue-600 hover:underline"
                      >
                        <Globe className="h-3.5 w-3.5" />
                        Website công ty
                      </a>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer Bottom Action */}
              <div className="pt-4 border-t border-slate-200/80 flex items-center justify-between gap-3 bg-white">
                <div className="text-xs text-slate-500">
                  <span>Thời gian làm việc: <strong>{selectedJob.workingTime}</strong></span>
                </div>
                {appliedJobIds.has(selectedJob.id) ? (
                  <span className="text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg font-bold text-xs">
                    ✓ Đã nộp hồ sơ
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={handleApplyClick}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-5 py-2 rounded-lg text-xs shadow-sm transition-all active:scale-[0.98] cursor-pointer border-0"
                  >
                    Ứng tuyển ngay
                  </button>
                )}
              </div>
            </>
          ) : (
            <div className="h-full flex items-center justify-center p-8 text-center text-slate-400">
              <div>
                <Briefcase className="h-12 w-12 mx-auto text-slate-300 mb-2" />
                <p className="text-sm font-medium">Chọn một công việc ở cột bên trái để xem toàn bộ thông tin chi tiết</p>
              </div>
            </div>
          )}
        </section>
      </main>

      {/* 4. MODALS */}
      {/* Modal cho khách chưa đăng nhập */}
      <GuestApplyNoticeModal
        open={guestModalOpen}
        jobTitle={selectedJob?.title || ''}
        companyName={selectedJob?.company || ''}
        onClose={() => setGuestModalOpen(false)}
        onLogin={handleGuestLogin}
        onRegister={handleGuestRegister}
      />

      {/* Modal gửi CV nhanh bằng CV mặc định cho người đã đăng nhập */}
      <AuthenticatedApplyModal
        open={authModalOpen}
        jobTitle={selectedJob?.title || ''}
        companyName={selectedJob?.company || ''}
        onClose={() => setAuthModalOpen(false)}
        onConfirm={handleConfirmAuthApply}
      />
    </div>
  );
};

export default PublicJobSplitDiscovery;
