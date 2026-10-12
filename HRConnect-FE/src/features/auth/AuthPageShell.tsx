import React from 'react';
import { ArrowLeftOutlined, CheckCircleFilled, SafetyCertificateOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

interface AuthPageShellProps {
  eyebrow: string;
  title: string;
  description: string;
  sideTitle: string;
  sideDescription: string;
  benefits: string[];
  children: React.ReactNode;
  wide?: boolean;
  fitScreen?: boolean;
}

/** Shared, human-friendly shell for every public authentication screen with soothing ombre blue palette. */
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
}) => {
  const navigate = useNavigate();

  return (
    <main
      className={`relative w-full text-slate-900 ${
        fitScreen
          ? 'h-screen h-[100dvh] overflow-hidden bg-slate-100/90 px-3 py-2 sm:px-6 sm:py-4 flex items-center justify-center'
          : 'min-h-screen overflow-hidden bg-slate-50 px-4 py-5 sm:px-6 lg:flex lg:items-center lg:py-8'
      }`}
    >
      {/* Background radial highlights */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(30,58,138,0.08),_transparent_36%),radial-gradient(circle_at_bottom_right,_rgba(37,99,235,0.06),_transparent_32%)]" />

      <section
        className={`relative mx-auto grid w-full overflow-hidden rounded-2xl sm:rounded-[28px] border border-slate-200/90 bg-white shadow-[0_24px_70px_-24px_rgba(15,23,42,0.22)] ${
          fitScreen
            ? 'h-full max-h-[94vh] lg:grid-cols-[0.88fr_1.12fr]'
            : 'lg:min-h-[calc(100vh-4rem)] lg:grid-cols-[0.88fr_1.12fr]'
        } ${wide ? 'max-w-[1240px]' : 'max-w-[1100px]'}`}
      >
        {/* Left Side: Elegant Soothing Ombre Blue Gradient */}
        <aside className="relative hidden overflow-hidden bg-gradient-to-br from-[#0c2340] via-[#163866] to-[#1e4e8c] p-7 text-white lg:flex lg:flex-col lg:justify-between xl:p-10">
          {/* Subtle light mesh spheres */}
          <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full border border-white/10 bg-white/[0.04] blur-sm" />
          <div className="pointer-events-none absolute -bottom-28 -left-20 h-72 w-72 rounded-full border border-sky-300/10 bg-sky-400/[0.06] blur-sm" />

          {/* Logo brand */}
          <button
            type="button"
            onClick={() => navigate('/')}
            className="relative flex w-fit cursor-pointer items-center gap-3 border-0 bg-transparent p-0 text-left text-white"
            aria-label="Về trang chủ HR Connect"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-lg font-black text-[#163866] shadow-md shadow-slate-950/20">
              H
            </span>
            <span>
              <strong className="block text-base font-extrabold leading-none tracking-tight">HR Connect</strong>
              <span className="mt-1 block text-[11px] font-medium text-slate-200/80">Kết nối đúng người, đúng cơ hội</span>
            </span>
          </button>

          {/* Hero text & benefits */}
          <div className={`relative ${fitScreen ? 'my-auto py-2' : 'my-8'} max-w-md`}>
            <span className="mb-3.5 inline-flex rounded-full border border-white/15 bg-white/[0.08] px-3 py-0.5 text-[11px] font-bold uppercase tracking-[0.14em] text-blue-100 backdrop-blur-sm">
              Tuyển dụng rõ ràng hơn
            </span>
            <h2 className="m-0 text-2xl font-black leading-[1.18] tracking-[-0.03em] text-white xl:text-[32px]">
              {sideTitle}
            </h2>
            <p className="mb-0 mt-3 max-w-sm text-xs sm:text-[13px] leading-6 text-slate-200/90">{sideDescription}</p>

            <div className={`mt-5 ${fitScreen ? 'space-y-2' : 'space-y-3'}`}>
              {benefits.map((benefit) => (
                <div
                  key={benefit}
                  className="flex items-start gap-2.5 rounded-xl border border-white/10 bg-white/[0.07] px-3.5 py-2 text-xs sm:text-[13px] font-medium text-white/95 backdrop-blur-sm"
                >
                  <CheckCircleFilled className="mt-0.5 shrink-0 text-sky-300" />
                  <span>{benefit}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Security footnote */}
          <div className="relative flex items-center gap-2 text-[11px] text-slate-200/70">
            <SafetyCertificateOutlined className="text-sky-300" />
            <span>Dữ liệu tài khoản được bảo vệ trong suốt quá trình sử dụng.</span>
          </div>
        </aside>

        {/* Right Side: Form Body */}
        <div
          className={`relative flex flex-col justify-between ${
            fitScreen ? 'h-full overflow-y-auto lg:overflow-hidden p-5 sm:p-7 xl:p-9' : 'p-5 sm:p-9 xl:p-12'
          }`}
        >
          <div>
            <button
              type="button"
              onClick={() => navigate('/')}
              className="mb-4 inline-flex w-fit cursor-pointer items-center gap-2 rounded-lg border-0 bg-transparent p-0 text-xs sm:text-sm font-semibold text-slate-500 transition hover:text-blue-700"
            >
              <ArrowLeftOutlined />
              <span>Về trang chủ</span>
            </button>

            <div className="mb-4">
              <div className="mb-2 flex items-center gap-2.5 lg:hidden">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#163866] text-base font-black text-white">
                  H
                </span>
                <strong className="text-base text-slate-900">HR Connect</strong>
              </div>
              <p className="mb-1 text-[11px] font-extrabold uppercase tracking-[0.14em] text-blue-700">{eyebrow}</p>
              <h1 className="m-0 text-2xl font-black tracking-[-0.03em] text-slate-950 sm:text-[28px]">{title}</h1>
              <p className="mb-0 mt-1.5 max-w-xl text-xs sm:text-sm leading-5 text-slate-500">{description}</p>
            </div>
          </div>

          <div className="flex-1 flex flex-col justify-center">{children}</div>
        </div>
      </section>
    </main>
  );
};

export const AUTH_INPUT_CLASS =
  'h-11 rounded-xl border-slate-200 bg-white text-slate-900 shadow-sm placeholder:text-slate-400 hover:border-blue-400 focus:border-blue-600 transition-colors';

export const AUTH_LABEL_CLASS = 'text-xs sm:text-sm font-bold text-slate-700';
