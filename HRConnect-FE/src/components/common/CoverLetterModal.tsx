import React, { useState } from 'react';
import { Modal, Button, Radio, Input, message, Tag, Space } from 'antd';
import {
  FileTextOutlined,
  CopyOutlined,
  CheckOutlined,
  EditOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { useAuthStore } from '@/stores/authStore';

const { TextArea } = Input;

interface CoverLetterModalProps {
  open: boolean;
  onClose: () => void;
  initialType?: 'standard' | 'fresher' | 'switch' | 'lead';
}

const TEMPLATES = {
  standard: {
    id: 'standard',
    title: 'Ứng viên có kinh nghiệm',
    tag: 'Tiêu chuẩn B2B/Tech',
    content: (name: string, company: string, jobTitle: string) => `Kính gửi Bộ phận Tuyển dụng và Quản lý Tuyển dụng tại ${company},

Tôi viết thư này để bày tỏ sự quan tâm đặc biệt đối với vị trí ${jobTitle} mà Quý công ty đang tìm kiếm. Với hơn 3 năm kinh nghiệm thực chiến trong lĩnh vực chuyên môn cùng sự am hiểu sâu sắc về văn hóa đổi mới sáng tạo, tôi tin tưởng bản thân có thể đóng góp hiệu quả vào sự phát triển vượt bậc của ${company}.

Tại các vị trí công tác trước đây, tôi đã chịu trách nhiệm dẫn dắt và triển khai các dự án trọng điểm, tối ưu quy trình làm việc và luôn hoàn thành vượt mức các chỉ tiêu KPI cam kết. Tôi đặc biệt ấn tượng với những thành tựu gần đây của ${company} và mong muốn mang các kỹ năng chuyên môn, tư duy giải quyết vấn đề cùng tinh thần trách nhiệm cao nhất vào đội ngũ của Quý công ty.

Tôi đã đính kèm CV chi tiết để Quý vị tham khảo thêm. Rất mong có cơ hội được trao đổi trực tiếp trong buổi phỏng vấn để chia sẻ rõ hơn về những giá trị thiết thực tôi có thể mang lại cho ${company}.

Xin chân thành cảm ơn Quý công ty đã dành thời gian xem xét hồ sơ!

Trân trọng,
${name}
Email: liên hệ qua CV | Số điện thoại: liên hệ qua CV`,
  },
  fresher: {
    id: 'fresher',
    title: 'Fresher / Mới tốt nghiệp',
    tag: 'Tràn đầy năng lượng',
    content: (name: string, company: string, jobTitle: string) => `Kính gửi Quý công ty ${company},

Tôi là ${name}, một ứng viên trẻ nhiệt huyết vừa tốt nghiệp chuyên ngành liên quan và đang tìm kiếm cơ hội khởi đầu sự nghiệp với vai trò ${jobTitle} tại ${company}.

Trong suốt quá trình học tập tại trường đại học, tôi đã tích lũy nền tảng kiến thức bài bản, đạt thành tích học tập loại Giỏi và tích cực tham gia các dự án thực tế, các cuộc thi chuyên môn cũng như hoạt động ngoại khóa rèn luyện kỹ năng làm việc nhóm. Dù là một ứng viên mới tốt nghiệp, tôi tự tin vào khả năng học hỏi nhanh, tinh thần cầu tiến không ngại thử thách và sự tỉ mỉ trong từng nhiệm vụ được giao.

Môi trường chuyên nghiệp, đề cao tính sáng tạo tại ${company} là nơi lý tưởng để tôi rèn giũa và cống hiến hết mình. Tôi rất hy vọng sẽ có cơ hội được tham gia buổi phỏng vấn để trình bày chi tiết hơn về định hướng phát triển bản thân phù hợp với mục tiêu của Quý công ty.

Xin chân thành cảm ơn Quý nhà tuyển dụng!

Trân trọng,
${name}`,
  },
  switch: {
    id: 'switch',
    title: 'Chuyển đổi ngành nghề',
    tag: 'Kỹ năng chuyển giao',
    content: (name: string, company: string, jobTitle: string) => `Kính gửi Nhà tuyển dụng tại ${company},

Tôi viết thư này để ứng tuyển vào vị trí ${jobTitle} tại ${company}. Với quá trình làm việc trước đây cùng niềm đam mê mãnh liệt đối với lĩnh vực mới, tôi mong muốn đem những kỹ năng chuyển giao giá trị nhất (Transferable Skills) để đồng hành cùng sự phát triển của Quý công ty.

Trong những năm qua, tôi đã chủ động hoàn thành các khóa đào tạo chuyên sâu, tích lũy kiến thức thực hành và xây dựng các sản phẩm cá nhân chứng minh năng lực thực tế. Kinh nghiệm trước đây đã trang bị cho tôi góc nhìn đa chiều, tư duy phản biện sắc bén cùng khả năng thích ứng linh hoạt với mọi môi trường làm việc tốc độ cao.

Tôi rất mong được trao đổi thêm cùng Quý công ty về cách thức những kỹ năng đa ngành của tôi có thể mang lại giá trị độc đáo và bứt phá cho vị trí ${jobTitle}.

Trân trọng cảm ơn,
${name}`,
  },
  lead: {
    id: 'lead',
    title: 'Cấp Quản lý / Team Lead',
    tag: 'Chiến lược & Lãnh đạo',
    content: (name: string, company: string, jobTitle: string) => `Kính gửi Ban Lãnh đạo và Bộ phận Tuyển dụng ${company},

Tôi gửi thư này bày tỏ sự quan tâm đối với vị trí Lãnh đạo / Quản lý ${jobTitle} tại ${company}. Với hơn 5 năm kinh nghiệm quản trị đội ngũ, hoạch định chiến lược kinh doanh và tối ưu hóa hiệu suất vận hành, tôi tin tưởng sẽ mang lại những chuyển biến tích cực và bền vững cho Quý công ty.

Thành tựu nổi bật trong các giai đoạn trước của tôi bao gồm việc xây dựng và dẫn dắt đội ngũ tinh gọn từ 10 - 25 nhân sự, thúc đẩy tăng trưởng doanh thu 40% hàng năm và triển khai thành công hệ thống quy trình chuẩn hóa. Tôi đánh giá rất cao tầm nhìn dài hạn của ${company} và mong muốn đóng vai trò đầu tàu trong việc hiện thực hóa các mục tiêu chiến lược tiếp theo.

Rất mong được gặp gỡ Quý Ban Lãnh đạo trong buổi trao đổi trực tiếp để thảo luận sâu hơn về định hướng phát triển.

Kính chúc Quý công ty ngày càng phát triển thịnh vượng!

Trân trọng,
${name}`,
  },
};

export const CoverLetterModal: React.FC<CoverLetterModalProps> = ({
  open,
  onClose,
  initialType = 'standard',
}) => {
  const currentUser = useAuthStore((s) => s.user);
  const [selectedKey, setSelectedKey] = useState<keyof typeof TEMPLATES>(initialType);
  const [companyName, setCompanyName] = useState<string>('Doanh nghiệp Tuyển dụng');
  const [jobTitle, setJobTitle] = useState<string>('Vị trí Ứng tuyển');
  const [copied, setCopied] = useState<boolean>(false);

  const candidateName = currentUser?.name || 'Nguyễn Minh Trang';
  const currentTemplate = TEMPLATES[selectedKey] || TEMPLATES.standard;
  const letterBody = currentTemplate.content(candidateName, companyName, jobTitle);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(letterBody);
      setCopied(true);
      void message.success('Đã sao chép nội dung Cover Letter vào Clipboard!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      void message.error('Không thể tự động sao chép. Vui lòng bôi đen và nhấn Ctrl + C.');
    }
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width={760}
      title={
        <div className="flex items-center gap-2.5 text-slate-900 pb-2 border-b border-slate-100">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center text-base">
            <FileTextOutlined />
          </div>
          <div>
            <div className="font-bold text-base leading-tight">Mẫu Thư Ứng Tuyển (Cover Letter) Chuyên Nghiệp</div>
            <div className="text-xs font-normal text-slate-500 mt-0.5">
              Tùy chỉnh thông điệp ứng tuyển ấn tượng gửi kèm CV giúp tăng 80% cơ hội nhận lời mời phỏng vấn
            </div>
          </div>
        </div>
      }
      className="cover-letter-modal"
    >
      <div className="py-3 space-y-4">
        {/* Template Type Selector */}
        <div className="flex flex-wrap items-center gap-2">
          {(Object.keys(TEMPLATES) as Array<keyof typeof TEMPLATES>).map((k) => {
            const item = TEMPLATES[k];
            const isSelected = selectedKey === k;
            return (
              <button
                key={k}
                type="button"
                onClick={() => setSelectedKey(k)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:border-emerald-300 hover:text-emerald-700'
                }`}
              >
                <span>{item.title}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-medium ${
                    isSelected ? 'bg-emerald-700 text-emerald-100' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {item.tag}
                </span>
              </button>
            );
          })}
        </div>

        {/* Input variables: Công ty & Vị trí */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200/80">
          <div>
            <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block mb-1">
              Tên Công ty / Doanh nghiệp ứng tuyển:
            </label>
            <Input
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Ví dụ: Công ty Cổ phần Công nghệ NovaTech"
              className="rounded-lg text-xs"
            />
          </div>
          <div>
            <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block mb-1">
              Chức danh / Vị trí công việc:
            </label>
            <Input
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              placeholder="Ví dụ: Frontend Developer / Trưởng nhóm Kinh doanh"
              className="rounded-lg text-xs"
            />
          </div>
        </div>

        {/* Letter Preview Box */}
        <div className="relative">
          <TextArea
            value={letterBody}
            readOnly
            rows={12}
            className="font-sans text-xs text-slate-800 leading-relaxed rounded-xl p-4 bg-white border border-slate-200 focus:border-emerald-500"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-slate-100">
          <div className="text-xs text-slate-500 flex items-center gap-1.5">
            <ThunderboltOutlined className="text-amber-500" />
            <span>Mẹo: Bạn có thể dán nội dung này vào ô <strong>Thư giới thiệu</strong> khi nộp hồ sơ ứng tuyển.</span>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={onClose} className="rounded-lg">
              Đóng
            </Button>
            <Button
              type="primary"
              icon={copied ? <CheckOutlined /> : <CopyOutlined />}
              onClick={handleCopy}
              className={`rounded-lg font-semibold ${
                copied
                  ? 'bg-emerald-600 hover:bg-emerald-700'
                  : 'bg-emerald-600 hover:bg-emerald-700'
              }`}
            >
              {copied ? 'Đã sao chép!' : 'Sao chép nội dung'}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};

