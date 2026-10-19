import React from 'react';
import {
  SafetyCertificateOutlined,
  PhoneOutlined,
  MailOutlined,
  ClockCircleOutlined,
  CompassOutlined,
  CheckCircleOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { Navbar } from '@/features/landing/components/Navbar';
import { ContactConsultationForm } from './ContactConsultationForm';

export const ContactPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <Navbar />

      <main>
        {/* Hero Banner */}
        <section className="relative overflow-hidden border-0 border-b border-solid border-slate-200 bg-white px-6 py-14 lg:px-10 lg:py-20">
          <div className="pointer-events-none absolute -right-24 -top-32 h-[450px] w-[450px] rounded-full bg-blue-100/60 blur-3xl" />
          <div className="pointer-events-none absolute -left-20 bottom-0 h-64 w-64 rounded-full bg-indigo-50 blur-2xl" />

          <div className="relative mx-auto max-w-[1240px] text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-solid border-blue-200 bg-blue-50 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-blue-800">
              <SafetyCertificateOutlined />
              Tư vấn giải pháp nhân sự & tuyển dụng
            </div>

            <h1 className="mb-0 mt-5 text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl lg:text-5xl">
              Đồng hành cùng doanh nghiệp xây dựng <span className="text-blue-600">đội ngũ nhân tài</span>
            </h1>

            <p className="mx-auto mb-0 mt-4 max-w-2xl text-base text-slate-600 sm:text-lg">
              Dù bạn cần dịch vụ Headhunt trọn gói (COD), gói cung cấp hồ sơ (CV Sourcing) hay đăng tin
              tuyển dụng, đội ngũ tư vấn viên của HRConnect luôn sẵn sàng hỗ trợ.
            </p>
          </div>
        </section>

        {/* Content Section: Form & Info Cards */}
        <section className="px-6 py-12 lg:px-10 lg:py-16">
          <div className="mx-auto grid max-w-[1240px] grid-cols-1 gap-10 lg:grid-cols-12">
            {/* Left: Contact Info & Value Props */}
            <div className="space-y-6 lg:col-span-5">
              <div className="rounded-2xl border border-solid border-slate-200 bg-white p-6 sm:p-7 shadow-sm">
                <h3 className="mb-4 text-lg font-bold text-slate-900">
                  Thông tin liên hệ trực tiếp
                </h3>
                <ul className="m-0 list-none space-y-4 p-0">
                  <li className="flex items-start gap-3.5">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                      <PhoneOutlined className="text-base" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold uppercase text-slate-400">Hotline tư vấn</div>
                      <a
                        href="tel:19006868"
                        className="text-base font-bold text-slate-900 transition hover:text-blue-600"
                      >
                        1900 6868 (Ext: 101)
                      </a>
                    </div>
                  </li>

                  <li className="flex items-start gap-3.5">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                      <MailOutlined className="text-base" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold uppercase text-slate-400">Email tiếp nhận</div>
                      <a
                        href="mailto:contact@hrconnect.vn"
                        className="text-base font-bold text-slate-900 transition hover:text-blue-600"
                      >
                        contact@hrconnect.vn
                      </a>
                    </div>
                  </li>

                  <li className="flex items-start gap-3.5">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                      <ClockCircleOutlined className="text-base" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold uppercase text-slate-400">Thời gian làm việc</div>
                      <div className="text-sm font-medium text-slate-800">
                        Thứ Hai – Thứ Sáu: 08:30 – 17:30
                      </div>
                    </div>
                  </li>

                  <li className="flex items-start gap-3.5">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                      <CompassOutlined className="text-base" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold uppercase text-slate-400">Trụ sở chính</div>
                      <div className="text-sm font-medium text-slate-800">
                        Tòa nhà Landmark 81, P. 22, Q. Bình Thạnh, TP. Hồ Chí Minh
                      </div>
                    </div>
                  </li>
                </ul>
              </div>

              {/* Guarantees */}
              <div className="rounded-2xl border border-solid border-blue-100 bg-gradient-to-br from-blue-50 to-indigo-50/50 p-6 sm:p-7 shadow-sm">
                <h4 className="mb-3 text-base font-bold text-slate-950">
                  Cam kết dịch vụ từ HRConnect
                </h4>
                <div className="space-y-3 text-sm text-slate-700">
                  <div className="flex items-start gap-2.5">
                    <ThunderboltOutlined className="mt-0.5 text-blue-600" />
                    <span>
                      <strong>Phản hồi trong 24 giờ:</strong> Đội ngũ tư vấn sẽ liên hệ ngay khi tiếp
                      nhận thông tin yêu cầu.
                    </span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <CheckCircleOutlined className="mt-0.5 text-emerald-600" />
                    <span>
                      <strong>Tư vấn đúng mô hình:</strong> Định hướng gói dịch vụ tuyển dụng phù hợp với
                      ngân sách và tiến độ của doanh nghiệp.
                    </span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <SafetyCertificateOutlined className="mt-0.5 text-indigo-600" />
                    <span>
                      <strong>Tuân thủ pháp luật:</strong> Thu thập và quản lý thông tin minh bạch theo{' '}
                      <strong>Nghị định 13/2023/NĐ-CP</strong>.
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Consultation Form */}
            <div className="lg:col-span-7">
              <ContactConsultationForm />
            </div>
          </div>
        </section>
      </main>

      <footer className="border-0 border-t border-solid border-slate-200 bg-white px-6 py-8 text-center text-sm text-slate-500">
        © 2026 HR Connect. Nền tảng tuyển dụng và kết nối nhân tài toàn diện.
      </footer>
    </div>
  );
};

export default ContactPage;
