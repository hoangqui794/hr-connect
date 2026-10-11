import React from 'react';
import { ArrowRightOutlined, CheckCircleFilled, SafetyCertificateOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { Navbar } from '@/features/landing/components/Navbar';
import { ServicePackages } from '@/features/landing/components/ServicePackages';

const COMPARISON_ROWS = [
  { label: 'Cách tiếp nhận Candidate', cod: 'Mạng lưới Affiliate và đội ngũ tuyển dụng chủ động tìm kiếm', sourcing: 'HR Connect tìm kiếm, chuẩn hóa và bàn giao hồ sơ phù hợp', application: 'Candidate tự ứng tuyển từ tin tuyển dụng công khai' },
  { label: 'Doanh nghiệp nhận được', cod: 'Quy trình tuyển trọn gói đến giai đoạn nhận việc và bảo hành', sourcing: 'Danh sách CV đã được sàng lọc để doanh nghiệp tiếp tục phỏng vấn', application: 'Tin tuyển dụng và công cụ quản lý hồ sơ ứng tuyển tập trung' },
  { label: 'Trách nhiệm sàng lọc', cod: 'HR Connect phối hợp cùng doanh nghiệp trong toàn bộ quy trình', sourcing: 'HR Connect sàng lọc ban đầu, doanh nghiệp quyết định các vòng sau', application: 'Doanh nghiệp chủ động đánh giá và liên hệ Candidate' },
  { label: 'Cách tính phí', cod: 'Phí tuyển dụng thành công theo thỏa thuận dịch vụ', sourcing: 'Phí theo gói hồ sơ được bàn giao', application: 'Phí đăng tin theo gói đã chọn' },
  { label: 'Phù hợp nhất khi', cod: 'Vị trí khó tuyển, cần nguồn chủ động và cam kết kết quả', sourcing: 'HR nội bộ cần thêm nguồn CV chất lượng trong thời gian ngắn', application: 'Nhu cầu tuyển phổ biến, doanh nghiệp có đội ngũ xử lý hồ sơ' },
] as const;

const SERVICE_HEADERS = [
  ['HEADHUNT_COD', 'Tuyển trọn gói'],
  ['CV_SOURCING', 'Cung cấp hồ sơ'],
  ['CV_APPLICATION', 'Đăng tin tuyển dụng'],
] as const;

export const ServicesPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <Navbar />
      <main>
        <section className="relative overflow-hidden border-0 border-b border-solid border-slate-200 bg-white px-6 py-20 lg:px-10 lg:py-24">
          <div className="pointer-events-none absolute -right-32 -top-56 h-[560px] w-[560px] rounded-full bg-blue-100/70 blur-3xl" />
          <div className="relative mx-auto grid max-w-[1240px] items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-solid border-blue-200 bg-blue-50 px-4 py-2 text-sm font-bold text-blue-800"><SafetyCertificateOutlined aria-hidden />Giải pháp tuyển dụng theo nhu cầu thực tế</div>
              <h1 className="mb-0 mt-6 max-w-3xl text-[44px] font-extrabold leading-[1.1] tracking-[-0.045em] text-slate-950 lg:text-[58px]">Chọn đúng mô hình,<span className="block text-blue-700">tuyển đúng người dễ dàng hơn.</span></h1>
              <p className="mb-0 mt-6 max-w-2xl text-lg leading-8 text-slate-600">Từ đăng tin chủ động đến tuyển dụng trọn gói, HR Connect giúp doanh nghiệp hiểu rõ phạm vi dịch vụ, trách nhiệm của từng bên và tiến độ của mỗi hồ sơ.</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <button type="button" onClick={() => document.getElementById('service-models')?.scrollIntoView({ behavior: 'smooth' })} className="inline-flex min-h-12 cursor-pointer items-center gap-2 rounded-xl border-0 bg-blue-700 px-6 text-base font-bold text-white transition hover:bg-blue-800">Xem các mô hình<ArrowRightOutlined aria-hidden /></button>
                <button type="button" onClick={() => navigate('/register?role=CLIENT')} className="min-h-12 cursor-pointer rounded-xl border border-solid border-slate-300 bg-white px-6 text-base font-bold text-slate-800 transition hover:border-blue-300 hover:bg-blue-50">Đăng ký doanh nghiệp</button>
              </div>
            </div>

            <div className="rounded-[28px] border border-solid border-blue-100 bg-blue-50 p-7 shadow-[0_24px_60px_rgba(37,99,235,0.12)]">
              <p className="m-0 text-xs font-bold uppercase tracking-[0.16em] text-blue-700">Cách chọn nhanh</p>
              <h2 className="mb-0 mt-2 text-2xl font-extrabold text-slate-950">Doanh nghiệp đang cần điều gì?</h2>
              <div className="mt-6 space-y-3">
                {[
                  ['Cần tuyển trọn gói và giảm rủi ro', 'HEADHUNT_COD'],
                  ['Cần thêm nguồn CV đã được sàng lọc', 'CV_SOURCING'],
                  ['Cần đăng tin và tự quản lý hồ sơ', 'CV_APPLICATION'],
                ].map(([need, service]) => (
                  <div key={service} className="flex items-start gap-3 rounded-2xl border border-solid border-blue-100 bg-white p-4"><CheckCircleFilled className="mt-1 text-blue-600" aria-hidden /><div><p className="m-0 font-bold text-slate-900">{need}</p><p className="mb-0 mt-1 text-sm font-semibold text-blue-700">Chọn {service}</p></div></div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <ServicePackages />

        <section className="px-6 py-20 lg:px-10">
          <div className="mx-auto max-w-[1240px]">
            <div className="mb-10 max-w-3xl">
              <p className="m-0 text-sm font-bold uppercase tracking-[0.16em] text-blue-700">So sánh minh bạch</p>
              <h2 className="mb-0 mt-3 text-3xl font-extrabold tracking-[-0.03em] text-slate-950 lg:text-4xl">Khác nhau ở cách HR Connect đồng hành</h2>
              <p className="mb-0 mt-4 text-base leading-7 text-slate-600">Bảng dưới đây giúp doanh nghiệp chọn theo nguồn Candidate, mức độ hỗ trợ và trách nhiệm sàng lọc.</p>
            </div>
            <div className="overflow-x-auto rounded-[24px] border border-solid border-slate-200 bg-white shadow-[0_16px_40px_rgba(15,23,42,0.07)]">
              <table className="w-full min-w-[980px] border-collapse text-left">
                <thead><tr className="bg-blue-950 text-white"><th className="w-[18%] px-5 py-5 text-sm">Tiêu chí</th>{SERVICE_HEADERS.map(([code, name]) => <th key={code} className="w-[27.33%] px-5 py-5"><span className="block text-xs font-bold tracking-[0.08em] text-blue-300">{code}</span><span className="mt-1 block text-base">{name}</span></th>)}</tr></thead>
                <tbody>{COMPARISON_ROWS.map((row, index) => <tr key={row.label} className={index % 2 === 0 ? 'bg-white' : 'bg-slate-50/80'}><th className="border-0 border-t border-solid border-slate-200 px-5 py-5 text-sm font-bold text-slate-900">{row.label}</th><td className="border-0 border-t border-solid border-slate-200 px-5 py-5 text-sm leading-6 text-slate-600">{row.cod}</td><td className="border-0 border-t border-solid border-slate-200 px-5 py-5 text-sm leading-6 text-slate-600">{row.sourcing}</td><td className="border-0 border-t border-solid border-slate-200 px-5 py-5 text-sm leading-6 text-slate-600">{row.application}</td></tr>)}</tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="px-6 pb-20 lg:px-10">
          <div className="mx-auto flex max-w-[1240px] flex-col items-start justify-between gap-6 rounded-[28px] bg-gradient-to-br from-blue-950 to-indigo-950 px-8 py-10 text-white lg:flex-row lg:items-center lg:px-12">
            <div><p className="m-0 text-sm font-bold uppercase tracking-[0.14em] text-blue-300">Bắt đầu cùng HR Connect</p><h2 className="mb-0 mt-2 text-3xl font-extrabold">Đưa nhu cầu tuyển dụng vào một quy trình rõ ràng.</h2><p className="mb-0 mt-3 text-slate-300">Đăng ký doanh nghiệp để tạo Job và chọn dịch vụ phù hợp.</p></div>
            <button type="button" onClick={() => navigate('/register?role=CLIENT')} className="inline-flex min-h-12 shrink-0 cursor-pointer items-center gap-2 rounded-xl border-0 bg-blue-600 px-6 text-base font-bold text-white transition hover:bg-blue-500">Đăng ký doanh nghiệp<ArrowRightOutlined aria-hidden /></button>
          </div>
        </section>
      </main>
      <footer className="border-0 border-t border-solid border-slate-200 bg-slate-50 px-6 py-7 text-center text-sm text-slate-500">© 2026 HR Connect. Nền tảng tuyển dụng và kết nối nhân tài.</footer>
    </div>
  );
};
