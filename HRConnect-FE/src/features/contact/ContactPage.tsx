/**
 * @file ContactPage.tsx
 * @description Contact page for HR Connect (mockup 03/11, Page 27: "Liên hệ với HR Connect").
 */
import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { Navbar } from '@/features/landing/components/Navbar';
import type { ContactServiceInterest } from '@/types/api/contact';
import { ContactConsultationForm } from './ContactConsultationForm';

const FONT = "font-['Be_Vietnam_Pro',system-ui,sans-serif]";
const CARD = 'rounded-lg border border-solid border-[#E5E7EB] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)]';

const VALID_SERVICES: ContactServiceInterest[] = ['HEADHUNT_COD', 'CV_SOURCING', 'CV_APPLICATION', 'OTHER'];

export const ContactPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const serviceParam = searchParams.get('service') as ContactServiceInterest | null;
  const initialService = serviceParam && VALID_SERVICES.includes(serviceParam) ? serviceParam : 'HEADHUNT_COD';

  return (
    <div className={`${FONT} min-h-screen bg-[#F7F8FA] text-[14px] text-[#1F2937] [line-height:normal]`}>
      <Navbar />

      <main className="mx-auto max-w-[1048px] px-4 pb-16 pt-8 sm:px-6 animate-[admin-page-in_220ms_cubic-bezier(0.2,0.8,0.2,1)_both]">
        <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_272px]">
          {/* Left: Form Liên hệ với HR Connect */}
          <ContactConsultationForm initialServiceInterest={initialService} />

          {/* Right: Thông tin liên hệ */}
          <aside className="space-y-4">
            <section aria-labelledby="contact-info-title" className={`${CARD} p-5`}>
              <h2 id="contact-info-title" className="m-0 text-[15px] font-bold text-[#1F2937]">
                Thông tin liên hệ
              </h2>
              <div className="mt-3 space-y-2 text-[13.5px] leading-5 text-[#4B5563]">
                <div>
                  Email:{' '}
                  <a
                    href="mailto:contact@hrconnect.vn"
                    className="font-medium text-[#1F2937] no-underline hover:text-[#0369A1] hover:underline"
                  >
                    contact@hrconnect.vn
                  </a>
                </div>
                <div>
                  Điện thoại:{' '}
                  <a
                    href="tel:19006868"
                    className="font-medium text-[#1F2937] no-underline hover:text-[#0369A1] hover:underline"
                  >
                    1900 6868
                  </a>
                </div>
                <div>Giờ làm việc: Thứ Hai – Thứ Sáu, 8:30 – 17:30</div>
              </div>
            </section>
          </aside>
        </div>
      </main>
    </div>
  );
};

export default ContactPage;
