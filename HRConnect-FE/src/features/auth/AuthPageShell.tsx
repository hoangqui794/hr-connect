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
  extraVisual?: React.ReactNode;
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
  extraVisual,
}) => {
  const navigate = useNavigate();

  return (
    <main
      className={`relative w-full text-slate-900 ${
        fitScreen
          ? 'h-screen h-[100dvh] overflow-hidden bg-gradient-to-br from-[#E2F3FB]/60 via-slate-50 to-[#B1E0F4]/35 px-3 py-2 sm:px-5 sm:py-3 flex items-center justify-center'
          : 'min-h-screen overflow-hidden bg-slate-50 px-4 py-5 sm:px-6 lg:flex lg:items-center lg:py-8'
      }`}
    >
      {/* Background radial highlights */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(30,158,219,0.10),_transparent_40%),radial-gradient(circle_at_bottom_right,_rgba(83,183,232,0.10),_transparent_36%)]" />

      <section
        className={`relative mx-auto grid w-full overflow-hidden rounded-2xl sm:rounded-[26px] border border-slate-200/90 bg-white shadow-[0_24px_70px_-24px_rgba(15,23,42,0.22)] ${
          fitScreen
            ? 'h-full max-h-[96vh] lg:grid-cols-[0.86fr_1.14fr]'
            : 'lg:min-h-[calc(100vh-4rem)] lg:grid-cols-[0.88fr_1.12fr]'
        } ${wide ? 'max-w-[1260px]' : 'max-w-[1100px]'}`}
      >
        {/* Left Side: Exact User Pastel Ombre Blue Gradient (#1E9EDB -> #53B7E8 -> #80CCEE -> #B1E0F4 -> #E2F3FB) */}
        <aside className={`relative hidden overflow-hidden bg-[linear-gradient(155deg,#1E9EDB_0%,#53B7E8_28%,#80CCEE_58%,#B1E0F4_84%,#E2F3FB_100%)] text-slate-900 lg:flex lg:flex-col lg:justify-between ${
          fitScreen ? 'p-5 xl:p-7' : 'p-7 xl:p-10'
        }`}>
          {/* Subtle luminous ambient rings */}
          <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/25 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-24 -left-16 h-72 w-72 rounded-full bg-[#80CCEE]/30 blur-3xl" />

          {/* Logo brand */}
          <button
            type="button"
            onClick={() => navigate('/')}
            className="relative z-10 flex w-fit cursor-pointer items-center gap-3 border-0 bg-transparent p-0 text-left text-white"
            aria-label="Về trang chủ HR Connect"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[linear-gradient(135deg,#1E9EDB_0%,#53B7E8_100%)] text-lg font-black text-white shadow-md shadow-[#1E9EDB]/30 border border-white/70">
              H
            </span>
            <span>
              <strong className="block text-base font-extrabold leading-none tracking-tight text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.15)]">HR Connect</strong>
              <span className="mt-1 block text-[11px] font-medium text-white/90">Kết nối đúng người, đúng cơ hội</span>
            </span>
          </button>

          {/* Hero text & benefits & extra visual */}
          <div className={`relative ${fitScreen ? 'my-auto py-1' : 'my-8'} max-w-md`}>
            <span className="mb-2.5 inline-flex rounded-full border border-white/60 bg-white/30 px-3 py-0.5 text-[11px] font-extrabold uppercase tracking-[0.14em] text-white backdrop-blur-md shadow-sm">
              Tuyển dụng rõ ràng hơn
            </span>
            <h2 className="m-0 text-xl font-black leading-[1.2] tracking-[-0.03em] text-white drop-shadow-[0_2px_4px_rgba(10,50,85,0.25)] xl:text-[28px]">
              {sideTitle}
            </h2>
            <p className="mb-0 mt-2 max-w-sm text-xs leading-5 text-white/95 font-medium drop-shadow-[0_1px_2px_rgba(0,0,0,0.1)]">{sideDescription}</p>

            <div className={`mt-3.5 ${fitScreen ? 'space-y-2' : 'space-y-3'}`}>
              {benefits.map((benefit) => (
                <div
                  key={benefit}
                  className="flex items-center gap-2.5 text-xs sm:text-[13px] font-semibold text-white drop-shadow-[0_1px_2px_rgba(10,50,85,0.2)]"
                >
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/25 text-[11px] text-white">
                    ✓
                  </span>
                  <span>{benefit}</span>
                </div>
              ))}
            </div>

            {/* Extra visual element (stickers, preview card, badges) */}
            {extraVisual && (
              <div className="mt-3.5">
                {extraVisual}
              </div>
            )}
          </div>

          {/* Security footnote */}
          <div className="relative flex items-center gap-2 text-[11px] text-[#0c365a] font-bold">
            <SafetyCertificateOutlined className="text-[#1E9EDB] text-sm" />
            <span>Dữ liệu tài khoản được bảo vệ trong suốt quá trình sử dụng.</span>
          </div>
        </aside>

        {/* Right Side: Form Body */}
        <div
          className={`relative flex flex-col justify-between ${
            fitScreen ? 'h-full overflow-y-auto p-4 sm:p-6 xl:p-8 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden' : 'p-5 sm:p-9 xl:p-12'
          }`}
        >
          <div>
            <button
              type="button"
              onClick={() => navigate('/')}
              className="mb-2.5 inline-flex w-fit cursor-pointer items-center gap-2 rounded-lg border-0 bg-transparent p-0 text-xs sm:text-sm font-semibold text-slate-500 transition hover:text-blue-700"
            >
              <ArrowLeftOutlined />
              <span>Về trang chủ</span>
            </button>

            <div className="mb-2.5 sm:mb-3">
              <div className="mb-1.5 flex items-center gap-2.5 lg:hidden">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[linear-gradient(135deg,#1E9EDB_0%,#53B7E8_100%)] text-sm font-black text-white shadow-sm shadow-[#1E9EDB]/30">
                  H
                </span>
                <strong className="text-base text-slate-900">HR Connect</strong>
              </div>
              <p className="mb-0.5 text-[10px] sm:text-[11px] font-extrabold uppercase tracking-[0.14em] text-blue-700">{eyebrow}</p>
              <h1 className="m-0 text-xl font-black tracking-[-0.03em] text-slate-950 sm:text-2xl">{title}</h1>
              <p className="mb-0 mt-1 max-w-xl text-xs sm:text-[13px] leading-4 sm:leading-5 text-slate-500">{description}</p>
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
