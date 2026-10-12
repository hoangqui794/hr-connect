import React from 'react';
import { ArrowRightOutlined, CheckCircleFilled, FileSearchOutlined, GlobalOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useI18nStore } from '@/i18n';
import { useAuthStore } from '@/stores/authStore';
import { UserRole } from '@/types/roles';

const PACKAGE_META = [
  { key: 'cod' as const, code: 'HEADHUNT_COD', icon: SafetyCertificateOutlined, label: 'Tuyển trọn gói', fit: 'Phù hợp khi doanh nghiệp cần tuyển vị trí khó và muốn giảm rủi ro tuyển sai.', featured: true },
  { key: 'sourcing' as const, code: 'CV_SOURCING', icon: FileSearchOutlined, label: 'Nhận danh sách hồ sơ', fit: 'Phù hợp khi đội ngũ HR nội bộ cần nhanh chóng có nguồn Candidate để tự phỏng vấn.', featured: false },
  { key: 'application' as const, code: 'CV_APPLICATION', icon: GlobalOutlined, label: 'Đăng tin công khai', fit: 'Phù hợp với nhu cầu tuyển phổ biến và doanh nghiệp muốn chủ động tiếp nhận hồ sơ.', featured: false },
] as const;

export const ServicePackages: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useI18nStore();
  const { isAuthenticated, role } = useAuthStore();

  const handleSelectPackage = (packageCode: string) => {
    if (isAuthenticated && role === UserRole.CLIENT) {
      navigate(`/jobs/create?serviceLine=${packageCode}`);
      return;
    }
    navigate(`/register?role=CLIENT&package=${packageCode}`);
  };

  return (
    <section id="service-models" className="border-0 border-y border-solid border-blue-100 bg-blue-50/55 px-6 py-20 lg:px-10">
      <div className="mx-auto max-w-[1240px]">
        <div className="mx-auto mb-12 max-w-3xl text-center">
          <p className="m-0 text-sm font-bold uppercase tracking-[0.16em] text-blue-700">Ba cách hợp tác rõ ràng</p>
          <h2 className="mb-0 mt-3 text-3xl font-extrabold tracking-[-0.03em] text-slate-950 lg:text-4xl">Chọn dịch vụ theo đúng cách doanh nghiệp muốn tuyển</h2>
          <p className="mb-0 mt-4 text-base leading-7 text-slate-600">Mỗi mô hình có phạm vi, cách thanh toán và trách nhiệm khác nhau. HR Connect giúp doanh nghiệp chọn đúng từ đầu và theo dõi toàn bộ tiến độ trên hệ thống.</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {PACKAGE_META.map((meta) => {
            const service = t.services[meta.key];
            const Icon = meta.icon;
            return (
              <article key={meta.code} className={`relative flex h-full flex-col rounded-[24px] border border-solid bg-white p-7 transition duration-200 hover:-translate-y-1 hover:shadow-[0_22px_45px_rgba(37,99,235,0.12)] ${meta.featured ? 'border-blue-500 shadow-[0_18px_40px_rgba(37,99,235,0.12)]' : 'border-slate-200'}`}>
                {meta.featured && <span className="absolute right-5 top-5 rounded-full bg-blue-700 px-3 py-1 text-xs font-bold text-white">Phổ biến</span>}
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-100 text-xl text-blue-700"><Icon aria-hidden /></span>
                <p className="mb-0 mt-6 text-xs font-bold uppercase tracking-[0.12em] text-blue-700">{meta.label}</p>
                <h3 className="mb-0 mt-2 text-2xl font-extrabold tracking-[-0.02em] text-slate-950">{service.title}</h3>
                <p className="mb-0 mt-3 min-h-[52px] text-sm leading-6 text-slate-600">{meta.fit}</p>
                <div className="my-6 h-px bg-slate-200" />
                <ul className="m-0 flex-1 list-none space-y-3 p-0">
                  {service.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3 text-sm leading-6 text-slate-700">
                      <CheckCircleFilled className="mt-1 shrink-0 text-blue-600" aria-hidden />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <button type="button" onClick={() => handleSelectPackage(meta.code)} className={`mt-8 inline-flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-solid px-4 text-sm font-bold transition ${meta.featured ? 'border-blue-700 bg-blue-700 text-white hover:bg-blue-800' : 'border-blue-200 bg-blue-50 text-blue-800 hover:border-blue-300 hover:bg-blue-100'}`}>
                  {service.cta}<ArrowRightOutlined aria-hidden />
                </button>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
};
