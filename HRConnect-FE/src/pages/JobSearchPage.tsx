import React from 'react';
import { Navbar } from '@/features/landing/components/Navbar';
import { JobSearchPortal } from '@/features/jobs/JobSearchPortal';

export const JobSearchPage: React.FC = () => {
  return (
    <div className="bg-[#F8FAFC] min-h-screen text-slate-900 font-sans antialiased selection:bg-blue-100 selection:text-blue-900">
      {/* 1. Header Navbar */}
      <Navbar />

      {/* 2. Ambient Glow & Page Banner */}
      <div className="relative overflow-hidden pt-8 pb-4 px-4 sm:px-6 lg:px-8 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-100/40 via-slate-50 to-[#F8FAFC]">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[720px] h-[260px] bg-gradient-to-b from-blue-400/10 via-indigo-400/5 to-transparent blur-3xl pointer-events-none -z-10" />
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-2">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/90 border border-slate-200/90 shadow-2xs text-xs font-semibold text-slate-700 mb-3">
                <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
                <span>Sàn Tuyển Dụng Công Nghệ &amp; Headhunting COD</span>
                <span className="text-slate-300">|</span>
                <span className="text-emerald-600 font-bold">TopCV UI/UX Standard</span>
              </div>
              <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-slate-900">
                Tìm Kiếm Việc Làm &amp; <span className="text-blue-600">Cơ Hội Đãi Ngộ Cao</span>
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-2xl">
                Khám phá hơn 1.200+ cơ hội việc làm IT &amp; Công nghệ từ các tập đoàn hàng đầu. Tự động chấm điểm ATS Sentence-BERT và nhận hoa hồng COD khi giới thiệu ứng viên.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Main Search Portal Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16 pt-4">
        <JobSearchPortal />
      </main>

      {/* 4. Footer */}
      <footer className="border-t border-slate-200 bg-white py-8 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4">
          <p className="font-medium text-slate-700 mb-1">
            HR Connect © 2026 — Nền tảng Tuyển Dụng &amp; Affiliate Headhunting OPR Hub chuẩn ATS
          </p>
          <p className="text-slate-400">
            Hợp tác với FPT, VNPAY, Viettel, MB Bank, TechCorp, Shopee và hơn 1.200 doanh nghiệp hàng đầu.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default JobSearchPage;
