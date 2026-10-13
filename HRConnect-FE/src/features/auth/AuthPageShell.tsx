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
  extraVisual?: React.ReactNode;
}

/** Full-screen background radar layer that sits behind the auth shell card */
const FullscreenRadarBackground: React.FC = () => {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden select-none" aria-hidden="true">
      {/* Central Radar Origin: positioned prominently in the background */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center">
        {/* Radar Concentric Rings with crisp vibrant opacity & glow */}
        <div className="absolute h-[1400px] w-[1400px] rounded-full border border-sky-400/25" />
        <div className="absolute h-[1150px] w-[1150px] rounded-full border-2 border-sky-400/35" />
        <div className="absolute h-[920px] w-[920px] rounded-full border border-sky-400/40 border-dashed" />
        <div className="absolute h-[720px] w-[720px] rounded-full border-2 border-sky-500/50" />
        <div className="absolute h-[520px] w-[520px] rounded-full border border-sky-400/55 border-dashed" />
        <div className="absolute h-[340px] w-[340px] rounded-full border-2 border-sky-500/60" />
        <div className="absolute h-[160px] w-[160px] rounded-full border border-sky-400/70" />

        {/* Center Origin Radar Pulse */}
        <div className="relative flex h-6 w-6 items-center justify-center">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400 opacity-75" />
          <span className="relative inline-flex h-3 w-3 rounded-full bg-[#1E9EDB] shadow-[0_0_12px_#1E9EDB]" />
        </div>

        {/* Crosshair coordinate axes */}
        <div className="absolute h-[1400px] w-[1.5px] bg-gradient-to-b from-transparent via-sky-500/45 to-transparent" />
        <div className="absolute h-[1.5px] w-[1400px] bg-gradient-to-r from-transparent via-sky-500/45 to-transparent" />

        {/* Diagonal radar guide lines */}
        <div className="absolute h-[1150px] w-[1px] rotate-45 bg-gradient-to-b from-transparent via-sky-400/30 to-transparent" />
        <div className="absolute h-[1150px] w-[1px] -rotate-45 bg-gradient-to-b from-transparent via-sky-400/30 to-transparent" />

        {/* Sweeping Radar Beam with bright scanning head */}
        <div className="pointer-events-none absolute h-[1150px] w-[1150px] animate-[spin_7s_linear_infinite] rounded-full bg-[conic-gradient(from_0deg,_transparent_0deg,_transparent_280deg,_rgba(30,158,219,0.12)_320deg,_rgba(14,165,233,0.38)_360deg)]">
          {/* Leading beam edge */}
          <div className="absolute top-0 left-1/2 h-1/2 w-[2px] bg-gradient-to-t from-transparent via-sky-400 to-[#38bdf8] shadow-[0_0_10px_#38bdf8]" />
        </div>

        {/* Radar targets on rings with connection beam */}
        <div className="absolute -left-[200px] -top-[160px] flex items-center gap-1.5">
          <span className="relative flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-amber-500 shadow-[0_0_8px_#f59e0b]" />
          </span>
        </div>
        <div className="absolute right-[220px] bottom-[140px] flex items-center gap-1.5">
          <span className="relative flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]" />
          </span>
        </div>
      </div>

      {/* Dynamic Laser Line connecting nodes across the background */}
      <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
        <line
          x1="20%"
          y1="25%"
          x2="80%"
          y2="75%"
          stroke="#0284c7"
          strokeWidth="2"
          strokeDasharray="6 4"
          className="animate-pulse opacity-70"
        />
      </svg>

      {/* 4 Floating Radar Badges (z-20 to float crisply without being cut off by card edges) */}
      {/* Node A: Headhunter (Góc trên trái) */}
      <div className="pointer-events-auto absolute left-3 top-3 sm:left-6 sm:top-5 z-20 flex items-center gap-2 rounded-full border border-amber-400/80 bg-white/95 px-3 py-1.5 backdrop-blur-md shadow-md shadow-amber-500/15">
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-amber-500" />
        </span>
        <span className="text-xs font-black tracking-tight text-amber-900">Headhunter</span>
      </div>

      {/* Node B: Doanh nghiệp (Góc dưới phải) */}
      <div className="pointer-events-auto absolute right-3 bottom-3 sm:right-6 sm:bottom-5 z-20 flex items-center gap-2 rounded-full border border-emerald-400/80 bg-white/95 px-3 py-1.5 backdrop-blur-md shadow-md shadow-emerald-500/15">
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
        </span>
        <span className="text-xs font-black tracking-tight text-emerald-900">Doanh nghiệp</span>
      </div>

      {/* Node C: AI Matching Indicator (Góc trên phải) */}
      <div className="pointer-events-auto absolute right-3 top-3 sm:right-6 sm:top-5 z-20 flex items-center gap-2 rounded-full border border-sky-400/80 bg-white/95 px-3 py-1.5 backdrop-blur-md shadow-md shadow-sky-500/15">
        <span className="h-2.5 w-2.5 rounded-full bg-[#1E9EDB] animate-pulse shadow-[0_0_6px_#1E9EDB]" />
        <span className="text-xs font-black tracking-tight text-[#0c365a]">AI Match: 98%</span>
      </div>

      {/* Node D: Ứng viên (Góc dưới trái) */}
      <div className="pointer-events-auto absolute left-3 bottom-3 sm:left-6 sm:bottom-5 z-20 flex items-center gap-2 rounded-full border border-blue-400/80 bg-white/95 px-3 py-1.5 backdrop-blur-md shadow-md shadow-blue-500/15">
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-blue-500" />
        </span>
        <span className="text-xs font-black tracking-tight text-blue-950">Ứng viên</span>
      </div>
    </div>
  );
};

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
          ? 'h-screen h-[100dvh] overflow-hidden bg-gradient-to-br from-[#c0e6f8] via-[#e2f3fc] to-[#aee0f7] px-4 py-3 sm:px-8 sm:py-5 flex items-center justify-center'
          : 'min-h-screen overflow-hidden bg-slate-50 px-4 py-5 sm:px-6 lg:flex lg:items-center lg:py-8'
      }`}
    >
      {/* Full-screen AI Talent Radar Background Layer */}
      <FullscreenRadarBackground />

      {/* Background radial soft highlights */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(30,158,219,0.2),_transparent_50%),radial-gradient(circle_at_bottom_right,_rgba(14,165,233,0.2),_transparent_45%)]" />

      {/* Transparent Clear Glass Card: Genuinely see-through so user sees the background radar */}
      <section
        className={`relative z-10 mx-auto grid w-full overflow-hidden rounded-2xl sm:rounded-[28px] border-2 border-white/80 bg-white/10 shadow-[0_25px_80px_-15px_rgba(14,165,233,0.25)] ${
          fitScreen
            ? 'h-full max-h-[94vh] lg:grid-cols-[0.85fr_1.15fr]'
            : 'lg:min-h-[calc(100vh-4rem)] lg:grid-cols-[0.88fr_1.12fr]'
        } ${wide ? 'max-w-[1100px]' : 'max-w-[1020px]'}`}
      >
        {/* Left Side: Transparent Crystal Glass with subtle ombre tint (reveals radar clearly) */}
        <aside className={`relative hidden overflow-hidden bg-gradient-to-br from-white/25 via-sky-100/20 to-transparent text-slate-900 lg:flex lg:flex-col lg:justify-between border-r border-white/60 ${
          fitScreen ? 'p-6 xl:p-8' : 'p-7 xl:p-10'
        }`}>
          {/* Subtle luminous ambient rings */}
          <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/20 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-24 -left-16 h-72 w-72 rounded-full bg-[#80CCEE]/25 blur-3xl" />

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
              <strong className="block text-base font-extrabold leading-none tracking-tight text-slate-900 drop-shadow-[0_1px_2px_rgba(255,255,255,0.8)]">HR Connect</strong>
              <span className="mt-1 block text-[11px] font-bold text-slate-700">Kết nối đúng người, đúng cơ hội</span>
            </span>
          </button>

          {/* Hero text & benefits & extra visual - UI/UX clean balanced distribution */}
          <div className="relative z-10 my-auto py-2 max-w-md flex flex-col justify-center">
            {/* Centered Heading Group */}
            <div className="text-center flex flex-col items-center">
              <span className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-blue-500/30 bg-white/80 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-[0.12em] text-blue-900 shadow-sm">
                <span className="h-1.5 w-1.5 rounded-full bg-[#1E9EDB] animate-pulse" />
                Tuyển dụng rõ ràng hơn
              </span>
              <h2 className="m-0 text-center text-lg xl:text-2xl font-black leading-tight tracking-[-0.02em] text-slate-950 drop-shadow-[0_1px_2px_rgba(255,255,255,0.9)]">
                {sideTitle}
              </h2>
              {sideDescription && (
                <p className="mb-0 mt-1.5 text-center text-xs text-slate-700 font-medium drop-shadow-[0_1px_1px_rgba(255,255,255,0.8)]">
                  {sideDescription}
                </p>
              )}
            </div>

            {/* Feature Highlights: Icon + Key Term + Concise Desc */}
            <div className="mt-3.5 sm:mt-4 space-y-2 sm:space-y-2.5 w-full">
              {benefits.map((item, idx) => {
                const isObject = typeof item !== 'string';
                const title = isObject ? item.title : item;
                const desc = isObject ? item.desc : null;
                const icon = isObject && item.icon ? item.icon : <CheckCircleFilled className="text-[#1E9EDB]" />;

                return (
                  <div
                    key={idx}
                    className="flex items-center gap-2.5 rounded-xl border border-white/60 bg-white/45 p-2 sm:p-2.5 backdrop-blur-sm shadow-sm"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-base shadow-sm border border-white/80">
                      {icon}
                    </span>
                    <div className="min-w-0 flex-1">
                      <strong className="block text-xs font-bold leading-tight text-slate-900">
                        {title}
                      </strong>
                      {desc && (
                        <span className="mt-0.5 block text-[11px] font-medium text-slate-600 leading-tight">
                          {desc}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Extra visual element - seamlessly placed right below the benefits cards */}
            {extraVisual && (
              <div className="mt-2.5 sm:mt-3">
                {extraVisual}
              </div>
            )}
          </div>

          {/* Security footnote */}
          <div className="relative z-10 flex items-center gap-2 text-[11px] text-slate-800 font-extrabold drop-shadow-[0_1px_1px_rgba(255,255,255,0.8)]">
            <SafetyCertificateOutlined className="text-[#1E9EDB] text-sm" />
            <span>Dữ liệu tài khoản được bảo vệ trong suốt quá trình sử dụng.</span>
          </div>
        </aside>

        {/* Right Side: High-transparency Frosted Form Body */}
        <div
          className={`relative flex flex-col justify-between bg-white/35 backdrop-blur-[1px] ${
            fitScreen ? 'h-full overflow-y-auto p-5 sm:p-7 xl:p-8 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden' : 'p-5 sm:p-9 xl:p-12'
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
  'h-11 rounded-xl border border-white/70 bg-white/80 backdrop-blur-md text-slate-900 shadow-sm placeholder:text-slate-400 hover:border-blue-400 focus:border-blue-600 focus:bg-white transition-all';

export const AUTH_LABEL_CLASS = 'text-xs sm:text-sm font-bold text-slate-700';
