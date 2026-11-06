/**
 * @file ServicesPage.tsx
 * @description Recruitment Services page (mockup 03/11, Page 26: "Dịch vụ tuyển dụng của HR Connect").
 */
import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { Navbar } from '@/features/landing/components/Navbar';
import { apiClient } from '@/services/apiClient';

interface ServiceTypeApiDto {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  isActive: boolean;
}

const FONT = "font-['Be_Vietnam_Pro',system-ui,sans-serif]";
const CARD = 'rounded-lg border border-solid border-[#E5E7EB] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)] transition-all duration-200';
const LINK = 'text-[#0369A1] no-underline transition-colors duration-200 hover:text-[#075985] hover:underline';
const PRIMARY_BTN = `${FONT} inline-flex h-[42px] w-full cursor-pointer items-center justify-center rounded-md border-0 bg-[#0C4A6E] px-4 text-[14px] font-semibold text-white no-underline transition-all duration-200 hover:bg-[#075985] active:scale-[0.98]`;
const OUTLINE_BTN = `${FONT} inline-flex h-[42px] w-full cursor-pointer items-center justify-center rounded-md border border-solid border-[#0C4A6E] bg-white px-4 text-[14px] font-semibold text-[#0C4A6E] no-underline transition-all duration-200 hover:bg-[#F0F9FF] active:scale-[0.98]`;

interface ServiceModelCard {
  id: string;
  title: string;
  description: string;
  featured?: boolean;
  specs: { label: string; value: string }[];
  ctaLabel: string;
  ctaHref: string;
}

const SERVICE_MODELS: ServiceModelCard[] = [
  {
    id: 'CV_APPLICATION',
    title: 'Đăng tin tuyển dụng',
    description:
      'Bạn đăng tin, ứng viên tự ứng tuyển, bạn tự sàng lọc với điểm phù hợp do hệ thống chấm.',
    specs: [
      { label: 'Trả phí', value: 'Theo gói đăng tin, trả trước khi tin được công khai' },
      { label: 'Ai sàng lọc', value: 'Doanh nghiệp' },
      { label: 'Phù hợp khi', value: 'Vị trí phổ thông, nhiều người ứng tuyển' },
    ],
    ctaLabel: 'Bắt đầu đăng tin',
    ctaHref: '/register?role=CLIENT',
  },
  {
    id: 'HEADHUNT_COD',
    title: 'Tuyển qua Affiliate – trả phí khi tuyển được',
    description:
      'Mạng lưới Affiliate giới thiệu ứng viên, đội HR của chúng tôi sàng lọc trước khi gửi bạn.',
    featured: true,
    specs: [
      { label: 'Trả phí', value: 'Chỉ khi ứng viên đi làm: hệ số phí × lương gross tháng' },
      { label: 'Bảo hành', value: 'Ứng viên nghỉ trong thời gian bảo hành được tuyển thay miễn phí' },
      { label: 'Phù hợp khi', value: 'Vị trí khó tuyển, cần người có kinh nghiệm' },
    ],
    ctaLabel: 'Nhận tư vấn',
    ctaHref: '/contact?service=HEADHUNT_COD',
  },
  {
    id: 'CV_SOURCING',
    title: 'Mua CV theo số lượng',
    description:
      'Bạn đặt số CV cần, HR Connect giao CV đã sàng lọc. CV không đạt có lý do hợp lệ được thay CV khác.',
    specs: [
      { label: 'Trả phí', value: 'Đặt cọc trước, quyết toán theo số CV bạn nhận' },
      { label: 'Xem xét', value: 'Có hạn xem xét cho mỗi CV được giao' },
      { label: 'Phù hợp khi', value: 'Cần nguồn hồ sơ nhanh để tự phỏng vấn' },
    ],
    ctaLabel: 'Nhận tư vấn',
    ctaHref: '/contact?service=CV_SOURCING',
  },
];

const WORKFLOW_STEPS = [
  '1. Đăng ký tài khoản doanh nghiệp và chờ xác minh công ty.',
  '2. Tạo tin tuyển dụng, chọn dịch vụ và đề xuất điều khoản.',
  '3. HR Connect duyệt tin; với Tuyển qua Affiliate và Mua CV, hai bên ký hợp đồng dịch vụ.',
  '4. Thanh toán phí đăng tin hoặc tiền cọc qua VNPay hoặc chuyển khoản.',
  '5. Nhận hồ sơ kèm điểm phù hợp, phỏng vấn và gửi offer ngay trên hệ thống.',
  '6. Xác nhận ứng viên đi làm; phí Tuyển qua Affiliate tính sau khi đối soát.',
] as const;

export const ServicesPage: React.FC = () => {
  const navigate = useNavigate();

  const { data: activeServiceTypes } = useQuery({
    queryKey: ['public-service-types'],
    queryFn: async () => {
      const res = await apiClient.get<{ data?: { items?: ServiceTypeApiDto[] } }>('/service-types', {
        params: { isActive: true, page: 1, pageSize: 20 },
      });
      return res.data?.data?.items ?? [];
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const serviceModels = useMemo(() => {
    if (!activeServiceTypes || activeServiceTypes.length === 0) return SERVICE_MODELS;
    const byCode = new Map(
      activeServiceTypes.map((item) => [item.code.trim().toUpperCase(), item])
    );
    return SERVICE_MODELS.filter((model) => {
      const matched = byCode.get(model.id);
      return matched ? matched.isActive !== false : true;
    });
  }, [activeServiceTypes]);

  return (
    <div className={`${FONT} min-h-screen bg-[#F7F8FA] text-[14px] text-[#1F2937] [line-height:normal]`}>
      <Navbar />

      {/* Hero Banner (PDF Page 26) */}
      <section className="bg-[#0C4A6E] text-white">
        <div className="mx-auto max-w-[1248px] px-4 py-8 sm:px-6 lg:py-10">
          <h1 className="m-0 text-[24px] font-bold leading-8 text-white sm:text-[28px]">
            Dịch vụ tuyển dụng của HR Connect
          </h1>
          <p className="m-0 mt-2 max-w-[680px] text-[14px] leading-6 text-[#E0F2FE]">
            Doanh nghiệp chọn cách tuyển phù hợp với từng vị trí: tự đăng tin, tuyển qua mạng lưới Affiliate và chỉ trả phí khi tuyển được, hoặc mua CV đã sàng lọc theo số lượng.
          </p>
        </div>
      </section>

      <main className="mx-auto max-w-[1248px] space-y-5 px-4 pb-16 pt-6 sm:px-6 animate-[admin-page-in_220ms_cubic-bezier(0.2,0.8,0.2,1)_both]">
        {/* 3 Service Model Cards */}
        <section id="service-models" className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {serviceModels.map((model) => (
            <article
              key={model.id}
              className={`flex flex-col justify-between rounded-lg bg-white p-6 transition-all duration-200 ${
                model.featured
                  ? 'border-2 border-solid border-[#0C4A6E] shadow-[0_4px_14px_rgba(12,74,110,0.08)]'
                  : 'border border-solid border-[#E5E7EB] shadow-[0_1px_2px_rgba(15,23,42,0.03)]'
              }`}
            >
              <div>
                <h2 className="m-0 text-[16px] font-bold leading-6 text-[#1F2937]">{model.title}</h2>
                <p className="m-0 mt-2 text-[13.5px] leading-5 text-[#4B5563]">{model.description}</p>

                <dl className="m-0 mt-4 space-y-3">
                  {model.specs.map((spec) => (
                    <div key={spec.label}>
                      <dt className="text-[12px] text-[#6B7280]">{spec.label}</dt>
                      <dd className="m-0 mt-0.5 text-[13px] font-bold text-[#1F2937]">{spec.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>

              <div className="mt-6">
                <button
                  type="button"
                  onClick={() => navigate(model.ctaHref)}
                  className={model.featured ? PRIMARY_BTN : OUTLINE_BTN}
                >
                  {model.ctaLabel}
                </button>
              </div>
            </article>
          ))}
        </section>

        {/* Quy trình làm việc với doanh nghiệp */}
        <section aria-labelledby="workflow-title" className={`${CARD} p-6`}>
          <h2 id="workflow-title" className="m-0 text-[16px] font-bold text-[#1F2937]">
            Quy trình làm việc với doanh nghiệp
          </h2>
          <ol className="m-0 mt-3.5 grid list-none grid-cols-1 gap-x-8 gap-y-2.5 p-0 text-[13.5px] leading-5 text-[#374151] md:grid-cols-2">
            {WORKFLOW_STEPS.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </section>

        {/* Bottom 2 Cards: Dành cho Affiliate & Dành cho người tìm việc */}
        <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <article className={`${CARD} p-6`}>
            <h2 className="m-0 text-[16px] font-bold text-[#1F2937]">Dành cho Affiliate</h2>
            <p className="m-0 mt-1.5 text-[13.5px] leading-5 text-[#4B5563]">
              Giới thiệu ứng viên vào các vị trí Tuyển qua Affiliate và Mua CV. Hoa hồng được ghi nhận theo nguồn giới thiệu hợp lệ đầu tiên và chi trả sau khi đủ điều kiện.
            </p>
            <div className="mt-3">
              <Link to="/register/affiliate" className={`text-[13.5px] font-semibold ${LINK}`}>
                Đăng ký làm Affiliate
              </Link>
            </div>
          </article>

          <article className={`${CARD} p-6`}>
            <h2 className="m-0 text-[16px] font-bold text-[#1F2937]">Dành cho người tìm việc</h2>
            <p className="m-0 mt-1.5 text-[13.5px] leading-5 text-[#4B5563]">
              Tìm việc, ứng tuyển, tạo CV và theo dõi kết quả hoàn toàn miễn phí.
            </p>
            <div className="mt-3">
              <Link to="/jobs" className={`text-[13.5px] font-semibold ${LINK}`}>
                Tìm việc ngay
              </Link>
            </div>
          </article>
        </section>
      </main>
    </div>
  );
};

export default ServicesPage;
