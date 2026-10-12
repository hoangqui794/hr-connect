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
}

/** Shared, human-friendly shell for every public authentication screen. */
export const AuthPageShell: React.FC<AuthPageShellProps> = ({
  eyebrow,
  title,
  description,
  sideTitle,
  sideDescription,
  benefits,
  children,
  wide = false,
}) => {
  const navigate = useNavigate();

  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-50 px-4 py-5 text-slate-900 sm:px-6 lg:flex lg:items-center lg:py-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(37,99,235,0.10),_transparent_34%),radial-gradient(circle_at_bottom_right,_rgba(14,165,233,0.08),_transparent_30%)]" />

      <section
        className={`relative mx-auto grid w-full overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_28px_80px_-36px_rgba(15,23,42,0.35)] lg:min-h-[calc(100vh-4rem)] lg:grid-cols-[0.88fr_1.12fr] ${
          wide ? 'max-w-[1240px]' : 'max-w-[1120px]'
        }`}
      >
        <aside className="relative hidden overflow-hidden bg-gradient-to-br from-blue-700 via-blue-600 to-sky-500 p-10 text-white lg:flex lg:flex-col lg:justify-between xl:p-12">
          <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full border border-white/15 bg-white/5" />
          <div className="pointer-events-none absolute -bottom-28 -left-20 h-72 w-72 rounded-full border border-white/10 bg-sky-300/10" />

          <button
            type="button"
            onClick={() => navigate('/')}
            className="relative flex w-fit cursor-pointer items-center gap-3 border-0 bg-transparent p-0 text-left text-white"
            aria-label="Về trang chủ HR Connect"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-xl font-black text-blue-700 shadow-lg shadow-blue-950/15">
              H
            </span>
            <span>
              <strong className="block text-lg leading-none">HR Connect</strong>
              <span className="mt-1 block text-xs font-medium text-blue-100">Kết nối đúng người, đúng cơ hội</span>
            </span>
          </button>

          <div className="relative my-10 max-w-md">
            <span className="mb-4 inline-flex rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-blue-50">
              Tuyển dụng rõ ràng hơn
            </span>
            <h2 className="m-0 text-4xl font-black leading-[1.12] tracking-[-0.035em] text-white xl:text-[44px]">
              {sideTitle}
            </h2>
            <p className="mb-0 mt-5 max-w-sm text-[15px] leading-7 text-blue-50/90">{sideDescription}</p>

            <div className="mt-8 space-y-3">
              {benefits.map((benefit) => (
                <div key={benefit} className="flex items-start gap-3 rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm font-medium text-white backdrop-blur-sm">
                  <CheckCircleFilled className="mt-0.5 shrink-0 text-sky-200" />
                  <span>{benefit}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="relative flex items-center gap-2 text-xs text-blue-100">
            <SafetyCertificateOutlined />
            <span>Dữ liệu tài khoản được bảo vệ trong suốt quá trình sử dụng.</span>
          </div>
        </aside>

        <div className={`relative flex flex-col ${wide ? 'p-5 sm:p-8 xl:p-10' : 'p-5 sm:p-9 xl:p-12'}`}>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="mb-7 inline-flex w-fit cursor-pointer items-center gap-2 rounded-lg border-0 bg-transparent p-0 text-sm font-semibold text-slate-500 transition hover:text-blue-700"
          >
            <ArrowLeftOutlined />
            <span>Về trang chủ</span>
          </button>

          <div className="mb-7">
            <div className="mb-3 flex items-center gap-3 lg:hidden">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-lg font-black text-white">H</span>
              <strong className="text-lg text-slate-900">HR Connect</strong>
            </div>
            <p className="mb-2 text-xs font-extrabold uppercase tracking-[0.16em] text-blue-600">{eyebrow}</p>
            <h1 className="m-0 text-3xl font-black tracking-[-0.03em] text-slate-950 sm:text-[34px]">{title}</h1>
            <p className="mb-0 mt-3 max-w-xl text-sm leading-6 text-slate-500">{description}</p>
          </div>

          <div className="flex-1">{children}</div>
        </div>
      </section>
    </main>
  );
};

export const AUTH_INPUT_CLASS =
  'h-12 rounded-xl border-slate-200 bg-white text-slate-900 shadow-sm placeholder:text-slate-400 hover:border-blue-300 focus:border-blue-500';

export const AUTH_LABEL_CLASS = 'text-sm font-bold text-slate-700';

