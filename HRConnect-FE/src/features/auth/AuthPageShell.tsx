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

/** Team photo (Unsplash, hotlinked per Unsplash guidelines). The panel keeps a solid brand color if it fails. */
const AUTH_PHOTO_URL =
  'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=1600&q=75';

/**
 * Modern SaaS Auth layout:
 * - Left half: Real team photo under brand-blue gradient overlay (#082F49 via #0C4A6E/80 to #0369A1/45)
 *              with brand mark, large slogan, pills and trust footer.
 * - Right half: Clean, focused form panel with lightweight border inputs and CTA.
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
  testimonial: _testimonial,
}) => {
  const navigate = useNavigate();

  return (
    <main className={`flex w-full bg-white text-slate-900 ${fitScreen ? 'min-h-[100dvh] lg:h-[100dvh]' : 'min-h-screen'}`}>
      <section className="grid w-full lg:grid-cols-2">
        {/* Photo panel */}
        <aside className="relative hidden overflow-hidden bg-[#0C4A6E] lg:block">
          <img
            src={AUTH_PHOTO_URL}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 h-full w-full object-cover"
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#082F49] via-[#0C4A6E]/80 to-[#0369A1]/45" aria-hidden="true" />

          <div className="relative z-10 flex h-full flex-col justify-between p-10 text-white xl:p-14">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="flex w-fit cursor-pointer items-center gap-3 rounded-lg border-0 bg-transparent p-1 text-left text-white transition-opacity duration-150 hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              aria-label="Về trang chủ HR Connect"
            >
              <BrandMark size={44} tone="light" />
              <span>
                <strong className="block text-lg font-extrabold leading-none">HR Connect</strong>
                <span className="mt-1 block text-sm text-sky-100">Nền tảng tuyển dụng & headhunt</span>
              </span>
            </button>

            <div className="max-w-xl">
              <h2 className="m-0 text-4xl font-extrabold leading-[1.15] tracking-[-0.02em] text-white xl:text-5xl">{sideTitle}</h2>
              {sideDescription && <p className="mb-0 mt-4 max-w-lg text-lg leading-relaxed text-sky-50">{sideDescription}</p>}

              <ul className="m-0 mt-8 flex list-none flex-wrap gap-2.5 p-0">
                {benefits?.map((item, idx) => {
                  const isObject = typeof item !== 'string';
                  const itemTitle = isObject ? item.title : item;
                  const icon = isObject && item.icon ? item.icon : <CheckCircleFilled />;
                  return (
                    <li
                      key={idx}
                      className="flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-sm font-semibold text-white ring-1 ring-white/25 backdrop-blur-sm [&_.anticon]:!text-sky-200"
                    >
                      <span aria-hidden="true">{icon}</span>
                      {itemTitle}
                    </li>
                  );
                })}
              </ul>

              {extraVisual && <div className="mt-6">{extraVisual}</div>}
            </div>

            <p className="m-0 text-sm text-sky-100">© HR Connect · Kết nối đúng người, đúng cơ hội</p>
          </div>
        </aside>

        {/* Right Column: Form panel */}
        <div className={`flex flex-col ${fitScreen ? 'lg:h-[100dvh] lg:overflow-y-auto' : ''}`}>
          <div className={`mx-auto flex w-full flex-1 flex-col px-5 py-6 sm:px-10 sm:py-10 ${wide ? 'max-w-[600px]' : 'max-w-[440px]'}`}>
            <button
              type="button"
              onClick={() => navigate('/')}
              className="mb-6 inline-flex min-h-[44px] w-fit cursor-pointer items-center gap-2 rounded-lg border-0 bg-transparent px-0 text-sm font-medium text-slate-600 transition-colors duration-150 hover:text-[#0369A1] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0369A1]"
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
                <p className="mb-1 text-xs font-bold uppercase tracking-[0.12em] text-[#0369A1]">{eyebrow}</p>
                <h1 className="m-0 text-[28px] font-extrabold tracking-[-0.02em] text-slate-900">{title}</h1>
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
  'h-11 rounded-xl !border !border-slate-200 !bg-white text-slate-900 placeholder:text-slate-400 hover:!border-[#0EA5E9] focus:!border-[#0369A1] focus:!ring-4 focus:!ring-[#0369A1]/10 focus-within:!border-[#0369A1] focus-within:!ring-4 focus-within:!ring-[#0369A1]/10 transition-all duration-150';

export const AUTH_LABEL_CLASS = 'text-xs font-semibold text-slate-700';

/** Primary submit button: solid brand blue, 48px tall, visible keyboard focus. */
export const AUTH_PRIMARY_BUTTON_CLASS =
  'flex !h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border-0 !bg-[#0369A1] text-[15px] font-semibold !text-white shadow-none transition-all duration-150 hover:!bg-[#075985] active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0369A1] disabled:!bg-slate-300';

export const AUTH_LINK_CLASS =
  'font-semibold text-[#0369A1] underline-offset-2 hover:text-[#075985] hover:underline';

