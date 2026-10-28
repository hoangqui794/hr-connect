import React from 'react';
import { Modal, Button, Tag, Divider } from 'antd';
import {
  BookOutlined,
  CheckCircleFilled,
  CloseCircleFilled,
  ThunderboltOutlined,
  TrophyOutlined,
  SafetyCertificateOutlined,
  FormOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

interface CvGuideModalProps {
  open: boolean;
  onClose: () => void;
}

export const CvGuideModal: React.FC<CvGuideModalProps> = ({ open, onClose }) => {
  const navigate = useNavigate();

  const handleStartBuilding = () => {
    onClose();
    navigate('/candidate/cv-builder');
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width={780}
      title={
        <div className="flex items-center gap-2.5 text-slate-900 pb-2 border-b border-slate-100">
          <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center text-base">
            <BookOutlined />
          </div>
          <div>
            <div className="font-bold text-base leading-tight">Hướng Dẫn & Cẩm Nang Viết CV Chuyên Nghiệp</div>
            <div className="text-xs font-normal text-slate-500 mt-0.5">
              Bí quyết tối ưu hóa CV vượt qua bộ lọc ATS và chinh phục nhà tuyển dụng trong 6 giây đầu
            </div>
          </div>
        </div>
      }
      className="cv-guide-modal"
    >
      <div className="py-3 space-y-6 text-slate-700 max-h-[70vh] overflow-y-auto pr-1">
        {/* Banner Highlight ATS */}
        <div className="p-4 rounded-xl bg-gradient-to-r from-blue-50 via-indigo-50 to-emerald-50 border border-blue-100/80">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-blue-600 text-white shrink-0 shadow-xs">
              <ThunderboltOutlined className="text-lg" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-slate-900 text-sm">Bộ lọc ATS (Applicant Tracking System) là gì?</span>
                <Tag color="blue" className="rounded-full text-[10px] font-semibold m-0">Chuẩn tuyển dụng 2026</Tag>
              </div>
              <p className="text-xs text-slate-600 mt-1 mb-0 leading-relaxed">
                Hơn 90% doanh nghiệp lớn và công ty công nghệ dùng hệ thống tự động để quét từ khóa, bố cục và kinh nghiệm liên quan trước khi gửi tới HR. CV trên HR Connect được tối ưu hóa sẵn cấu trúc 1 cột hoặc 2 cột giúp bạn đạt trên <strong>95% ATS Match</strong>.
              </p>
            </div>
          </div>
        </div>

        {/* 1. Bố cục 5 phần chuẩn */}
        <section className="space-y-3">
          <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2 m-0">
            <span className="w-5 h-5 rounded-full bg-slate-900 text-white text-[11px] flex items-center justify-center font-bold">1</span>
            Bố cục 5 phần cốt lõi bắt buộc phải có
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-lg border border-slate-200/90 bg-white">
              <div className="font-bold text-slate-800 mb-1 flex items-center gap-1.5 text-blue-600">
                <CheckCircleFilled className="text-xs" /> Thông tin cá nhân & Liên hệ
              </div>
              <p className="text-slate-500 m-0 leading-relaxed">
                Họ tên viết hoa rõ ràng, chức danh ứng tuyển mục tiêu, số điện thoại, email công việc chỉn chu và link LinkedIn/Portfolio. Không cần ghi số CCCD hay địa chỉ cụ thể từng số nhà.
              </p>
            </div>

            <div className="p-3 rounded-lg border border-slate-200/90 bg-white">
              <div className="font-bold text-slate-800 mb-1 flex items-center gap-1.5 text-blue-600">
                <CheckCircleFilled className="text-xs" /> Mục tiêu nghề nghiệp / Tóm tắt
              </div>
              <p className="text-slate-500 m-0 leading-relaxed">
                Ngắn gọn từ 2 - 3 câu: Nêu bật số năm kinh nghiệm, thế mạnh kỹ năng cốt lõi và giá trị mang lại cho vị trí doanh nghiệp đang tuyển dụng.
              </p>
            </div>

            <div className="p-3 rounded-lg border border-slate-200/90 bg-white">
              <div className="font-bold text-slate-800 mb-1 flex items-center gap-1.5 text-blue-600">
                <CheckCircleFilled className="text-xs" /> Kinh nghiệm làm việc thực tế
              </div>
              <p className="text-slate-500 m-0 leading-relaxed">
                Sắp xếp theo thứ tự thời gian đảo ngược (mới nhất lên đầu). Ghi rõ tên công ty, chức danh, thời gian làm việc và các gạch đầu dòng hành động cụ thể.
              </p>
            </div>

            <div className="p-3 rounded-lg border border-slate-200/90 bg-white">
              <div className="font-bold text-slate-800 mb-1 flex items-center gap-1.5 text-blue-600">
                <CheckCircleFilled className="text-xs" /> Kỹ năng chuyên môn & Công cụ
              </div>
              <p className="text-slate-500 m-0 leading-relaxed">
                Liệt kê các kỹ năng cứng (Hard skills) khớp với bản mô tả công việc (JD), công cụ phần mềm chuyên dụng và kỹ năng mềm phù hợp môi trường làm việc.
              </p>
            </div>
          </div>
        </section>

        {/* 2. Công thức STAR */}
        <section className="space-y-3">
          <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2 m-0">
            <span className="w-5 h-5 rounded-full bg-slate-900 text-white text-[11px] flex items-center justify-center font-bold">2</span>
            Nguyên tắc STAR: Biến nhiệm vụ thành thành tích đo lường được
          </h4>
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs space-y-2">
            <p className="m-0 leading-relaxed text-slate-600">
              Nhà tuyển dụng không chỉ muốn biết bạn <em>làm gì</em>, họ muốn biết bạn <em>đạt được kết quả ra sao</em>:
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center pt-1">
              <div className="p-2 rounded bg-white border border-slate-200">
                <div className="font-extrabold text-blue-600">S (Situation)</div>
                <div className="text-[11px] text-slate-500 mt-0.5">Bối cảnh vấn đề</div>
              </div>
              <div className="p-2 rounded bg-white border border-slate-200">
                <div className="font-extrabold text-indigo-600">T (Task)</div>
                <div className="text-[11px] text-slate-500 mt-0.5">Nhiệm vụ được giao</div>
              </div>
              <div className="p-2 rounded bg-white border border-slate-200">
                <div className="font-extrabold text-emerald-600">A (Action)</div>
                <div className="text-[11px] text-slate-500 mt-0.5">Hành động cụ thể</div>
              </div>
              <div className="p-2 rounded bg-white border border-slate-200">
                <div className="font-extrabold text-amber-600">R (Result)</div>
                <div className="text-[11px] text-slate-500 mt-0.5">Số liệu đo lường</div>
              </div>
            </div>
            <div className="p-2.5 rounded-lg bg-emerald-50/70 border border-emerald-200 text-emerald-800 text-xs mt-2">
              <strong>Ví dụ chuẩn:</strong> "Xây dựng lại luồng thanh toán (Action) cho ứng dụng mobile thương mại điện tử, giúp giảm 18% tỷ lệ bỏ rơi giỏ hàng và tăng doanh thu bán lẻ thêm 2.1 tỷ VNĐ/quý (Result)."
            </div>
          </div>
        </section>

        {/* 3. Lỗi phổ biến cần tránh */}
        <section className="space-y-3">
          <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2 m-0">
            <span className="w-5 h-5 rounded-full bg-slate-900 text-white text-[11px] flex items-center justify-center font-bold">3</span>
            4 lỗi phổ biến khiến CV bị loại ngay lập tức
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            <div className="flex items-start gap-2 p-2.5 rounded-lg bg-rose-50/60 border border-rose-200 text-slate-700">
              <CloseCircleFilled className="text-rose-500 text-sm shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-rose-800">Sai chính tả & lỗi ngữ pháp:</span> Tuyệt đối kiểm tra kỹ dấu câu, tên công nghệ và cách viết hoa trước khi xuất file.
              </div>
            </div>
            <div className="flex items-start gap-2 p-2.5 rounded-lg bg-rose-50/60 border border-rose-200 text-slate-700">
              <CloseCircleFilled className="text-rose-500 text-sm shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-rose-800">Email thiếu nghiêm túc:</span> Luôn dùng email chuyên nghiệp theo tên (vd: hoang.nguyen@email.com thay vì nickname).
              </div>
            </div>
            <div className="flex items-start gap-2 p-2.5 rounded-lg bg-rose-50/60 border border-rose-200 text-slate-700">
              <CloseCircleFilled className="text-rose-500 text-sm shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-rose-800">Dùng chung 1 CV cho mọi vị trí:</span> Hãy điều chỉnh từ khóa kỹ năng để sát với từng yêu cầu tuyển dụng riêng biệt.
              </div>
            </div>
            <div className="flex items-start gap-2 p-2.5 rounded-lg bg-rose-50/60 border border-rose-200 text-slate-700">
              <CloseCircleFilled className="text-rose-500 text-sm shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-rose-800">Độ dài quá lan man:</span> Ứng viên dưới 5 năm kinh nghiệm nên gói gọn CV trong 1 trang A4 để đạt mật độ thông tin tối ưu.
              </div>
            </div>
          </div>
        </section>

        {/* Footer CTA */}
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-100">
          <span className="text-xs text-slate-500">
            Sẵn sàng áp dụng các nguyên tắc trên vào CV của bạn?
          </span>
          <div className="flex items-center gap-2">
            <Button onClick={onClose} className="rounded-lg">
              Đóng
            </Button>
            <Button
              type="primary"
              icon={<FormOutlined />}
              onClick={handleStartBuilding}
              className="rounded-lg bg-blue-600 hover:bg-blue-700 font-semibold"
            >
              Tạo CV ngay với CV Builder
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};

