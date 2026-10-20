import React from 'react';
import { ArrowLeftOutlined, CheckCircleFilled, SafetyCertificateOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

export interface BenefitItem {
  icon?: React.ReactNode;
  title: string;
  desc?: string;
}

interface AuthPageShellProps {
  eyebrow: string;
  title: string;
  description: string;
  sideTitle: string;
  sideDescription?: string;
  benefits: (string | BenefitItem)[];
  children: React.ReactNode;
  wide?: boolean;
  fitScreen?: boolean;
  /** Optional block under the benefits (kept for callers; rendered on the dark brand panel). */
  extraVisual?: React.ReactNode;
}

/**
 * Auth layout (ui-ux-pro-max, 20/10): flat split screen.
 * Left: solid brand panel (sky-900 → sky-700) with white text, 4.5:1 contrast, no animation.
 * Right: white form panel. Mobile shows only the form with a compact brand row.
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
}) => {
  const navigate = useNavigate();

  return (
    <main
      className={`flex w-full items-stretch bg-[#F0F9FF] text-slate-900 ${
        fitScreen ? 'min-h-screen min-h-[100dvh] lg:h-[100dvh]' : 'min-h-screen'
      }`}
    >
      <section
        className={`mx-auto grid w-full lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] ${wide ? 'max-w-none' : 'max-w-none'}`}
      >
        {/* Brand panel */}
        <aside className="relative hidden flex-col justify-between overflow-hidden bg-[#0C4A6E] p-10 text-white lg:flex xl:p-14">
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.07] [background-image:radial-gradient(#ffffff_1px,transparent_1px)] [background-size:22px_22px]"
            aria-hidden="true"
          />
          <div className="pointer-events-none absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-[#0369A1]" aria-hidden="true" />

          <button
            type="button"
            onClick={() => navigate('/')}
            className="relative z-10 flex w-fit cursor-pointer items-center gap-3 rounded-lg border-0 bg-transparent p-1 text-left text-white transition-opacity duration-150 hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            aria-label="Về trang chủ HR Connect"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-lg font-black text-[#0369A1]">H</span>
            <span>
              <strong className="block text-base font-extrabold leading-none">HR Connect</strong>
              <span className="mt-1 block text-xs text-sky-100">Kết nối đúng người, đúng cơ hội</span>
            </span>
          </button>

          <div className="relative z-10 max-w-md">
            <h2 className="m-0 text-3xl font-extrabold leading-tight tracking-[-0.02em] text-white xl:text-[34px]">{sideTitle}</h2>
            {sideDescription && <p className="mb-0 mt-3 text-base leading-relaxed text-sky-100">{sideDescription}</p>}

            <ul className="m-0 mt-8 list-none space-y-5 p-0">
              {benefits.map((item, idx) => {
                const isObject = typeof item !== 'string';
                const itemTitle = isObject ? item.title : item;
                const desc = isObject ? item.desc : null;
                const icon = isObject && item.icon ? item.icon : <CheckCircleFilled />;
                return (
                  <li key={idx} className="flex items-start gap-3.5">
                    <span
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-lg text-white [&_.anticon]:!text-white"
                      aria-hidden="true"
                    >
                      {icon}
                    </span>
                    <div className="min-w-0">
                      <strong className="block text-[15px] font-semibold leading-snug text-white">{itemTitle}</strong>
                      {desc && <span className="mt-0.5 block text-sm leading-snug text-sky-100">{desc}</span>}
                    </div>
                  </li>
                );
              })}
            </ul>

            {extraVisual && <div className="mt-6">{extraVisual}</div>}
          </div>

          <p className="relative z-10 m-0 flex items-center gap-2 text-sm text-sky-100">
            <SafetyCertificateOutlined aria-hidden="true" />
            <span>Dữ liệu tài khoản được mã hóa và phân quyền theo vai trò.</span>
          </p>
        </aside>

        {/* Form panel */}
        <div className={`flex flex-col bg-white ${fitScreen ? 'lg:h-[100dvh] lg:overflow-y-auto' : ''}`}>
          <div className={`mx-auto flex w-full flex-1 flex-col px-5 py-6 sm:px-10 sm:py-10 ${wide ? 'max-w-[600px]' : 'max-w-[460px]'}`}>
            <button
              type="button"
              onClick={() => navigate('/')}
              className="mb-6 inline-flex min-h-[44px] w-fit cursor-pointer items-center gap-2 rounded-lg border-0 bg-transparent px-0 text-sm font-medium text-slate-600 transition-colors duration-150 hover:text-[#0369A1] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0369A1]"
            >
              <ArrowLeftOutlined aria-hidden="true" />
              <span>Về trang chủ</span>
            </button>

            <div className="my-auto">
              <div className="mb-6">
                <div className="mb-4 flex items-center gap-2.5 lg:hidden">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#0369A1] text-base font-black text-white">H</span>
                  <strong className="text-base text-slate-900">HR Connect</strong>
                </div>
                <p className="mb-1 text-xs font-bold uppercase tracking-[0.12em] text-[#0369A1]">{eyebrow}</p>
                <h1 className="m-0 text-2xl font-extrabold tracking-[-0.02em] text-[#0C4A6E] sm:text-[28px]">{title}</h1>
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
  'h-11 rounded-xl border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 hover:border-[#0EA5E9] focus:border-[#0369A1] transition-colors duration-150';

export const AUTH_LABEL_CLASS = 'text-sm font-semibold text-slate-700';

/** Primary submit button: solid brand blue, 44px+ tall, visible keyboard focus. */
export const AUTH_PRIMARY_BUTTON_CLASS =
  'flex h-12 w-full items-center justify-center gap-2 rounded-xl border-0 !bg-[#0369A1] text-[15px] font-semibold !text-white shadow-none transition-colors duration-150 hover:!bg-[#075985] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0369A1] disabled:!bg-slate-300';

export const AUTH_LINK_CLASS =
  'font-semibold text-[#0369A1] underline-offset-2 hover:text-[#075985] hover:underline';
