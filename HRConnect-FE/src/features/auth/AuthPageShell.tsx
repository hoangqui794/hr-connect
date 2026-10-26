import React from 'react';
import { ArrowLeftOutlined, CheckCircleFilled } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { BrandMark } from '@/components/common/BrandMark';

export interface BenefitItem {
  icon?: React.ReactNode;
  title: string;
  desc?: string;
}

export interface TestimonialInfo {
  quote: string;
  author: string;
  role: string;
  company: string;
  metrics?: string;
}

interface AuthPageShellProps {
  eyebrow: string;
  title: string;
  description: string;
  sideTitle: string;
  sideDescription?: string;
  benefits?: (string | BenefitItem)[];
  children: React.ReactNode;
  wide?: boolean;
  fitScreen?: boolean;
  /** Optional block under the benefits, rendered on the side panel. */
  extraVisual?: React.ReactNode;
  testimonial?: TestimonialInfo;
}

/**
 * Modern SaaS Auth layout:
 * - Left half: Flat luxury navy (bg-slate-950) with sharp brand mark, enterprise value prop, and social proof testimonial.
 * - Right half: Clean, focused form panel with lightweight border-slate-200 inputs and blue-600 CTA.
 */
export const AuthPageShell: React.FC<AuthPageShellProps> = ({
  eyebrow,
  title,
  description,
  sideTitle,
  sideDescription,
  benefits,
  children,
  wide = false,
  fitScreen = false,
  extraVisual,
  testimonial,
}) => {
  const navigate = useNavigate();

  return (
    <main className={`flex w-full bg-white text-slate-900 ${fitScreen ? 'min-h-[100dvh] lg:h-[100dvh]' : 'min-h-screen'}`}>
      <section className="grid w-full lg:grid-cols-2">
        {/* Left Column: Premium Flat Navy bg-slate-950 with Testimonial / Social Proof */}
        <aside className="relative hidden overflow-hidden bg-slate-950 border-r border-slate-900 lg:flex lg:flex-col lg:justify-between p-10 xl:p-14 text-white">
          {/* Top: Flat Sharp Brand Logo */}
          <div>
            <button
              type="button"
              onClick={() => navigate('/')}
              className="flex w-fit cursor-pointer items-center gap-3 rounded-lg border-0 bg-transparent p-1 text-left text-white transition-opacity duration-150 hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              aria-label="Về trang chủ HR Connect"
            >
              <BrandMark size={40} tone="light" />
              <span>
                <strong className="block text-lg font-bold leading-none tracking-tight text-white">HR Connect</strong>
                <span className="mt-1 block text-xs font-medium text-slate-400">Nền tảng Tuyển dụng & Headhunt</span>
              </span>
            </button>
          </div>

          {/* Center: Slogan + Testimonial / Social Proof */}
          <div className="max-w-lg my-auto py-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-400 mb-6">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />
              <span>Hệ sinh thái Tuyển dụng Thông minh</span>
            </div>

            <h2 className="m-0 text-3xl font-extrabold leading-[1.2] tracking-tight text-white xl:text-4xl">
              {sideTitle}
            </h2>
            {sideDescription && (
              <p className="mb-0 mt-3 text-base leading-relaxed text-slate-400">
                {sideDescription}
              </p>
            )}

            {/* Testimonial / Social Proof Card */}
            <div className="mt-8 rounded-2xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur-sm">
              <div className="flex items-center gap-1 text-amber-400 text-xs mb-3">
                ★★★★★
              </div>
              <p className="m-0 text-sm sm:text-base italic leading-relaxed text-slate-200">
                "{testimonial?.quote || 'HR Connect giúp chúng tôi chuẩn hóa toàn bộ pipeline tuyển dụng và rút ngắn hơn 60% thời gian từ lúc lọc CV đến vòng phỏng vấn cuối cùng.'}"
              </p>
              <div className="mt-4 flex items-center justify-between border-t border-slate-800/80 pt-4">
                <div>
                  <strong className="block text-sm font-semibold text-white">
                    {testimonial?.author || 'Trần Minh Hoàng'}
                  </strong>
                  <span className="text-xs text-slate-400">
                    {testimonial?.role || 'Head of Talent Acquisition'} · {testimonial?.company || 'V-Tech Group'}
                  </span>
                </div>
                <div className="rounded border border-slate-700/60 bg-slate-800/80 px-2.5 py-1 text-[11px] font-mono font-medium text-slate-300">
                  {testimonial?.metrics || '500+ Hires/năm'}
                </div>
              </div>
            </div>

            {/* Short Proof points */}
            {benefits && benefits.length > 0 && (
              <div className="mt-6 flex flex-wrap gap-2">
                {benefits.map((item, idx) => {
                  const isObject = typeof item !== 'string';
                  const itemTitle = isObject ? item.title : item;
                  return (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-800/80 bg-slate-900/50 px-3 py-1.5 text-xs text-slate-300 font-medium"
                    >
                      <CheckCircleFilled className="text-blue-500 text-xs" />
                      <span>{itemTitle}</span>
                    </span>
                  );
                })}
              </div>
            )}

            {extraVisual && <div className="mt-6">{extraVisual}</div>}
          </div>

          {/* Bottom: Flat brand trust & copyright */}
          <div className="flex items-center justify-between border-t border-slate-900 pt-6 text-xs text-slate-500">
            <span>© HR Connect · Enterprise Talent Network</span>
            <span className="font-medium text-slate-400">500+ Doanh nghiệp tin dùng</span>
          </div>
        </aside>

        {/* Right Column: Form panel */}
        <div className={`flex flex-col ${fitScreen ? 'lg:h-[100dvh] lg:overflow-y-auto' : ''}`}>
          <div className={`mx-auto flex w-full flex-1 flex-col px-5 py-6 sm:px-10 sm:py-10 ${wide ? 'max-w-[600px]' : 'max-w-[440px]'}`}>
            <button
              type="button"
              onClick={() => navigate('/')}
              className="mb-6 inline-flex min-h-[44px] w-fit cursor-pointer items-center gap-2 rounded-lg border-0 bg-transparent px-0 text-sm font-medium text-slate-600 transition-colors duration-150 hover:text-blue-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              <ArrowLeftOutlined aria-hidden="true" />
              <span>Về trang chủ</span>
            </button>

            <div className="my-auto">
              <div className="mb-7">
                <div className="mb-5 flex items-center gap-2.5 lg:hidden">
                  <BrandMark size={36} />
                  <strong className="text-base text-slate-900">HR Connect</strong>
                </div>
                <p className="mb-1 text-xs font-bold uppercase tracking-[0.12em] text-blue-600">{eyebrow}</p>
                <h1 className="m-0 text-[28px] font-extrabold tracking-tight text-slate-900">{title}</h1>
                <p className="mb-0 mt-2 text-sm leading-relaxed text-slate-600">{description}</p>
              </div>

              {children}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
};

export const AUTH_INPUT_CLASS =
  'h-11 rounded-xl !border !border-slate-200 !bg-white text-slate-900 placeholder:text-slate-400 hover:!border-slate-300 focus:!border-blue-600 focus:!ring-4 focus:!ring-blue-50 focus-within:!border-blue-600 focus-within:!ring-4 focus-within:!ring-blue-50 transition-all duration-150';

export const AUTH_LABEL_CLASS = 'text-xs font-semibold text-slate-700';

/** Primary submit button: solid brand blue, 48px tall, visible keyboard focus. */
export const AUTH_PRIMARY_BUTTON_CLASS =
  'flex !h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border-0 !bg-blue-600 text-[15px] font-semibold !text-white shadow-sm transition-all duration-150 hover:!bg-blue-700 active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:!bg-slate-300';

export const AUTH_LINK_CLASS =
  'font-semibold text-blue-600 underline-offset-2 hover:text-blue-700 hover:underline';

