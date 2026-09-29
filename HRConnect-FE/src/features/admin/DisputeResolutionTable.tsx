/**
 * @file DisputeResolutionTable.tsx
 * @description Màn hình phán quyết tranh chấp nộp trùng (Dispute Resolution Center)
 * Thiết kế đối đầu (Side-by-side comparison) theo nguyên tắc bất biến First-Submission Timestamp:
 *  - Cột trái: CTV Nộp Đầu Tiên (Gốc) gắn nhãn xanh dương kèm thời gian chính xác đến từng giây (17:15:32 18/9/2026 - Hợp lệ).
 *  - Cột phải: CTV Nộp Sau (Trùng lặp) gắn nhãn cam cảnh báo (17:45:10 18/9/2026 - Trùng lặp).
 *  - Nút "Phán quyết" màu đỏ mận sang trọng, click mở Antd Modal xác nhận chuyển nhượng hoa hồng có log mã băm SHA-256.
 */
import React, { useState } from 'react';
import {
  Table,
  Card,
  Tag,
  Button,
  Modal,
  Input,
  Row,
  Col,
  Alert,
  Badge,
  message,
  Typography,
  Space,
  Tooltip,
  Divider,
} from 'antd';
import {
  SafetyCertificateOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  UserOutlined,
  ExclamationCircleOutlined,
  CopyOutlined,
  CheckOutlined,
  DollarCircleOutlined,
  FileProtectOutlined,
  ArrowRightOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

// ─── Interfaces ─────────────────────────────────────────────────────────────

export interface DisputeItem {
  id: string;
  originalSubmissionId: string;
  candidateName: string;
  candidateEmail: string;
  candidatePhone: string;
  jobId: string;
  jobTitle: string;
  commissionAmount: number; // Tiền hoa hồng tranh chấp (VD: 15.000.000 đ)
  originalAffiliateName: string;
  originalAffiliateCode: string;
  originalTimestamp: string; // VD: 17:15:32 18/9/2026
  competingAffiliateName: string;
  competingAffiliateCode: string;
  competingTimestamp: string; // VD: 17:45:10 18/9/2026 (+29m 38s)
  timeDelta: string;
  sha256Proof: string; // Mã băm bất biến SHA-256
  status: 'DISPUTE_PENDING' | 'RESOLVED' | 'REJECTED';
  arbitrationNote?: string;
}

export interface DisputeResolutionTableProps {
  data?: DisputeItem[];
  onResolve?: (disputeId: string, resolution: { rationale: string; sha256: string }) => void;
  className?: string;
}

// ─── Mock Initial Data ──────────────────────────────────────────────────────

const MOCK_DISPUTES: DisputeItem[] = [
  {
    id: 'dsp-001',
    originalSubmissionId: 'sub-099',
    candidateName: 'Bùi Văn Hữu',
    candidateEmail: 'bui.vanhuu@techcorp.io',
    candidatePhone: '0988 123 456',
    jobId: 'job-001',
    jobTitle: 'Kỹ sư Frontend Web / ReactJS Developer',
    commissionAmount: 15000000,
    originalAffiliateName: 'David Trần',
    originalAffiliateCode: 'AFF-001',
    originalTimestamp: '17:15:32 18/09/2026',
    competingAffiliateName: 'Sarah Lê',
    competingAffiliateCode: 'AFF-042',
    competingTimestamp: '17:45:10 18/09/2026',
    timeDelta: '+29 phút 38 giây',
    sha256Proof: '7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069',
    status: 'DISPUTE_PENDING',
  },
  {
    id: 'dsp-002',
    originalSubmissionId: 'sub-102',
    candidateName: 'Lê Thành Đạt',
    candidateEmail: 'le.thanhdat@fintech.vn',
    candidatePhone: '0912 999 888',
    jobId: 'job-002',
    jobTitle: 'Tech Lead / Frontend Architect',
    commissionAmount: 22000000,
    originalAffiliateName: 'Minh Vũ Recruiter',
    originalAffiliateCode: 'AFF-015',
    originalTimestamp: '08:20:00 15/09/2026',
    competingAffiliateName: 'Nguyễn Văn Talent',
    competingAffiliateCode: 'AFF-088',
    competingTimestamp: '14:30:22 15/09/2026',
    timeDelta: '+6 giờ 10 phút',
    sha256Proof: '4b227777d4dd1fc61c6f884f48641d02b4d121d3fd328cb08b5531fcacdabf8a',
    status: 'DISPUTE_PENDING',
  },
  {
    id: 'dsp-003',
    originalSubmissionId: 'sub-088',
    candidateName: 'Hoàng Nam Anh',
    candidateEmail: 'hoang.namanh@devops.io',
    candidatePhone: '0903 456 789',
    jobId: 'job-003',
    jobTitle: 'DevOps & Cloud Lead Specialist',
    commissionAmount: 18000000,
    originalAffiliateName: 'David Trần',
    originalAffiliateCode: 'AFF-001',
    originalTimestamp: '09:00:15 10/09/2026',
    competingAffiliateName: 'Headhunt Agency Pro',
    competingAffiliateCode: 'AFF-021',
    competingTimestamp: '16:12:00 10/09/2026',
    timeDelta: '+7 giờ 11 phút',
    sha256Proof: 'ef2d127de37b942baad06145e54b0c619a1f22327b2ebbcfbec78f5564afe39d',
    status: 'RESOLVED',
    arbitrationNote:
      'Công nhận quyền sở hữu hồ sơ và hoa hồng cho CTV David Trần dựa trên dấu thời gian First-Submission nộp sớm 7h11m.',
  },
];

export const DisputeResolutionTable: React.FC<DisputeResolutionTableProps> = ({
  data = MOCK_DISPUTES,
  onResolve,
  className = '',
}) => {
  const [disputes, setDisputes] = useState<DisputeItem[]>(data);
  const [selectedDispute, setSelectedDispute] = useState<DisputeItem | null>(null);
  const [resolveModalOpen, setResolveModalOpen] = useState<boolean>(false);
  const [arbitrationRationale, setArbitrationRationale] = useState<string>('');
  const [copiedHash, setCopiedHash] = useState<boolean>(false);

  // Mở modal phán quyết
  const handleOpenResolve = (dispute: DisputeItem) => {
    setSelectedDispute(dispute);
    setArbitrationRationale(
      `Căn cứ kiểm toán hệ thống First-Submission Timestamp: CTV [${dispute.originalAffiliateName} (${dispute.originalAffiliateCode})] nộp hồ sơ vào lúc ${dispute.originalTimestamp}, sớm hơn CTV khiếu nại [${dispute.competingAffiliateName}] (${dispute.timeDelta}). Quyết định: Phán quyết 100% quyền sở hữu hồ sơ và chuyển nhượng ${dispute.commissionAmount.toLocaleString('vi-VN')} đ hoa hồng cho [${dispute.originalAffiliateName}].`
    );
    setResolveModalOpen(true);
  };

  // Xác nhận phán quyết & ghi nhận mã băm SHA-256
  const handleConfirmResolution = () => {
    if (!selectedDispute) return;

    setDisputes((prev) =>
      prev.map((d) =>
        d.id === selectedDispute.id
          ? {
              ...d,
              status: 'RESOLVED',
              arbitrationNote: arbitrationRationale,
            }
          : d
      )
    );

    if (onResolve) {
      onResolve(selectedDispute.id, {
        rationale: arbitrationRationale,
        sha256: selectedDispute.sha256Proof,
      });
    }

    message.success(
      `Phán quyết thành công! Hoa hồng ${selectedDispute.commissionAmount.toLocaleString(
        'vi-VN'
      )} đ đã được trao quyền cho CTV gốc ${selectedDispute.originalAffiliateName}.`
    );
    setResolveModalOpen(false);
  };

  const handleCopyProof = (proof: string) => {
    navigator.clipboard.writeText(proof);
    setCopiedHash(true);
    message.success('Đã sao chép mã băm chứng thực SHA-256 vào clipboard.');
    setTimeout(() => setCopiedHash(false), 2500);
  };

  // Cấu hình bảng so sánh đối đầu (Side-by-side comparison table)
  const columns: ColumnsType<DisputeItem> = [
    {
      title: 'Ứng viên & Công việc',
      key: 'candidateInfo',
      width: 250,
      render: (_, record) => (
        <div>
          <div className="font-bold text-slate-900 text-sm">
            {record.candidateName}
          </div>
          <div className="text-xs text-slate-500 font-mono">
            {record.candidateEmail}
          </div>
          <div className="mt-1 flex items-center gap-1.5 flex-wrap">
            <Tag color="cyan" className="rounded-md font-semibold text-[11px] m-0 border-cyan-200">
              {record.jobTitle}
            </Tag>
          </div>
          <div className="text-xs font-bold text-emerald-700 mt-1 tabular-nums currency-kpi">
            💰 Hoa hồng: {record.commissionAmount.toLocaleString('vi-VN')} đ
          </div>
        </div>
      ),
    },
    {
      // ==============================================================
      // BÊN TRÁI: CTV NỘP ĐẦU TIÊN (GỐC) — NHÃN XANH DƯƠNG + TIMESTAMP
      // ==============================================================
      title: (
        <div className="flex items-center gap-1.5 text-blue-700 font-bold">
          <SafetyCertificateOutlined />
          <span>CTV Nộp Đầu Tiên (Gốc)</span>
        </div>
      ),
      key: 'originalSubmission',
      width: 280,
      render: (_, record) => (
        <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-200/80">
          <div className="flex items-center justify-between gap-1 mb-1">
            <span className="font-extrabold text-blue-900 text-xs flex items-center gap-1">
              <UserOutlined className="text-blue-600" />
              {record.originalAffiliateName}
            </span>
            <Tag color="blue" className="rounded-full text-[10px] font-bold m-0 px-2 py-0 border-blue-300">
              {record.originalAffiliateCode}
            </Tag>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-blue-800 font-mono font-bold mt-1">
            <ClockCircleOutlined className="text-blue-600" />
            <span className="tabular-nums">{record.originalTimestamp}</span>
          </div>

          <div className="mt-2">
            <Tag color="success" className="rounded-md font-bold text-[10px] px-2 py-0.5 border-emerald-300 bg-emerald-50 text-emerald-800">
              ✓ Hợp lệ (First-Submission Earliest)
            </Tag>
          </div>
        </div>
      ),
    },
    {
      // ==============================================================
      // BÊN PHẢI: CTV NỘP SAU (TRÙNG LẶP) — NHÃN CAM CẢNH BÁO
      // ==============================================================
      title: (
        <div className="flex items-center gap-1.5 text-amber-700 font-bold">
          <ExclamationCircleOutlined />
          <span>CTV Nộp Sau (Trùng Lặp)</span>
        </div>
      ),
      key: 'competingSubmission',
      width: 280,
      render: (_, record) => (
        <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-200/80">
          <div className="flex items-center justify-between gap-1 mb-1">
            <span className="font-extrabold text-amber-900 text-xs flex items-center gap-1">
              <UserOutlined className="text-amber-600" />
              {record.competingAffiliateName}
            </span>
            <Tag color="warning" className="rounded-full text-[10px] font-bold m-0 px-2 py-0 border-amber-300">
              {record.competingAffiliateCode}
            </Tag>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-amber-800 font-mono font-bold mt-1">
            <ClockCircleOutlined className="text-amber-600" />
            <span className="tabular-nums">{record.competingTimestamp}</span>
          </div>

          <div className="mt-2 flex items-center gap-1.5">
            <Tag color="warning" className="rounded-md font-bold text-[10px] px-2 py-0.5 border-amber-300 bg-amber-100/60 text-amber-900">
              ⚠ Trùng lặp ghi nhận ({record.timeDelta})
            </Tag>
          </div>
        </div>
      ),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      width: 140,
      render: (s: string) => (
        <div>
          {s === 'RESOLVED' ? (
            <Tag color="success" className="font-bold text-xs py-0.5 px-2.5 rounded-full border-emerald-300">
              ✓ Đã phán quyết
            </Tag>
          ) : s === 'DISPUTE_PENDING' ? (
            <Tag color="warning" className="font-bold text-xs py-0.5 px-2.5 rounded-full border-amber-300 animate-pulse">
              ● Chờ phân xử
            </Tag>
          ) : (
            <Tag color="default" className="font-bold text-xs py-0.5 px-2.5 rounded-full">
              {s}
            </Tag>
          )}
        </div>
      ),
    },
    {
      title: 'Hành động',
      key: 'action',
      width: 130,
      render: (_, record) =>
        record.status === 'DISPUTE_PENDING' ? (
          <Button
            type="primary"
            onClick={() => handleOpenResolve(record)}
            className="rounded-lg font-bold text-xs h-8 px-3.5 shadow-sm text-white border-none transition-all duration-200 hover:scale-105"
            style={{
              background: 'linear-gradient(135deg, #be123c, #9f1239)', // Đỏ mận sang trọng
              boxShadow: '0 2px 8px rgba(190, 18, 60, 0.3)',
            }}
          >
            Phán quyết
          </Button>
        ) : (
          <Tooltip title={record.arbitrationNote || 'Đã phân xử xong'}>
            <span className="text-emerald-700 font-bold text-xs flex items-center gap-1 cursor-help">
              <CheckCircleOutlined /> Đã giải quyết
            </span>
          </Tooltip>
        ),
    },
  ];

  return (
    <div className={`w-full font-sans ${className}`}>
      {/* ─── Header Tiêu đề & Thông báo Nguyên tắc ─────────────────── */}
      <div className="mb-5">
        <div className="flex items-center gap-2 mb-1">
          <FileProtectOutlined className="text-rose-700 text-xl" />
          <h2 className="text-xl lg:text-2xl font-black text-slate-900 tracking-tight m-0">
            Trung Tâm Xử Lý Tranh Chấp Hồ Sơ (Dispute Resolution Center)
          </h2>
        </div>
        <p className="text-xs text-slate-500 m-0">
          Cơ chế giải quyết tranh chấp trùng lặp ứng viên minh bạch dựa trên bằng chứng bất biến First-Submission Timestamp và chữ ký băm SHA-256.
        </p>
      </div>

      {/* Alert banner nguyên tắc */}
      <Alert
        type="info"
        showIcon
        message={
          <span className="font-bold text-slate-900 text-xs">
            Nguyên tắc First-Submission Timestamp Audit (Bảo chứng nộp trước)
          </span>
        }
        description="Mỗi hồ sơ nộp vào hệ thống được ghi nhận nhãn thời gian thực chuẩn UTC+7 chính xác đến từng giây. Quyền ghi nhận hoa hồng COD 100% thuộc về CTV có mốc thời gian nộp đầu tiên hợp lệ."
        className="mb-5 rounded-xl border-blue-200 bg-blue-50/50"
      />

      {/* Bảng so sánh đối đầu Clean White / Light Slate */}
      <Card
        className="border border-slate-200/90 shadow-sm rounded-xl overflow-hidden bg-white"
        bodyStyle={{ padding: 0 }}
      >
        <Table
          dataSource={disputes}
          columns={columns}
          rowKey="id"
          pagination={false}
          scroll={{ x: 1000 }}
        />
      </Card>

      {/* ─── Modal Phán Quyết & Xác Nhận Chuyển Nhượng Hoa Hồng ───────── */}
      <Modal
        title={
          <div className="flex items-center gap-2 text-rose-800">
            <SafetyCertificateOutlined className="text-xl" />
            <span className="font-extrabold text-base">
              Phán Quyết & Chuyển Nhượng Hoa Hồng Tranh Chấp
            </span>
          </div>
        }
        open={resolveModalOpen}
        onCancel={() => setResolveModalOpen(false)}
        width={680}
        footer={[
          <Button
            key="cancel"
            onClick={() => setResolveModalOpen(false)}
            className="rounded-lg font-semibold h-9"
          >
            Hủy bỏ
          </Button>,
          <Button
            key="confirm"
            type="primary"
            onClick={handleConfirmResolution}
            className="rounded-lg font-bold h-9 px-5 text-white border-none shadow-sm"
            style={{
              background: 'linear-gradient(135deg, #be123c, #9f1239)', // Đỏ mận sang trọng
            }}
          >
            Xác nhận Phán Quyết & Ký Số Audit
          </Button>,
        ]}
      >
        {selectedDispute && (
          <div className="py-2 space-y-4">
            {/* Box Tóm tắt đối đầu */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3.5 bg-blue-50 rounded-xl border border-blue-200">
                <span className="text-[11px] font-extrabold text-blue-700 uppercase tracking-wider block mb-1">
                  CTV Được Trao Quyền (Nộp Gốc)
                </span>
                <div className="font-black text-slate-900 text-sm">
                  {selectedDispute.originalAffiliateName}
                </div>
                <div className="text-xs text-blue-800 font-mono font-bold mt-1">
                  ⏱ {selectedDispute.originalTimestamp}
                </div>
                <div className="text-xs text-emerald-700 font-extrabold mt-1.5 tabular-nums currency-kpi">
                  Nhận 100% hoa hồng: {selectedDispute.commissionAmount.toLocaleString('vi-VN')} đ
                </div>
              </div>

              <div className="p-3.5 bg-amber-50 rounded-xl border border-amber-200">
                <span className="text-[11px] font-extrabold text-amber-700 uppercase tracking-wider block mb-1">
                  CTV Nộp Sau (Bị Thu Hồi Yêu Cầu)
                </span>
                <div className="font-black text-slate-900 text-sm">
                  {selectedDispute.competingAffiliateName}
                </div>
                <div className="text-xs text-amber-800 font-mono font-bold mt-1">
                  ⏱ {selectedDispute.competingTimestamp}
                </div>
                <div className="text-xs text-amber-700 font-semibold mt-1.5">
                  Trễ hơn: <span className="font-bold">{selectedDispute.timeDelta}</span>
                </div>
              </div>
            </div>

            {/* Bằng chứng mã băm SHA-256 bất biến */}
            <div className="bg-slate-900 text-slate-200 p-3.5 rounded-xl border border-slate-800">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Mã băm chứng thực bất biến (SHA-256 Genesis Hash):
                </span>
                <Button
                  size="small"
                  type="text"
                  icon={copiedHash ? <CheckOutlined className="text-emerald-400" /> : <CopyOutlined className="text-slate-300" />}
                  onClick={() => handleCopyProof(selectedDispute.sha256Proof)}
                  className="text-xs text-slate-300 hover:text-white"
                >
                  {copiedHash ? 'Đã chép' : 'Sao chép'}
                </Button>
              </div>
              <div className="font-mono text-xs text-emerald-400 break-all select-all">
                {selectedDispute.sha256Proof}
              </div>
            </div>

            {/* Form rationale / Lý do phán quyết */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Nội dung phán quyết ghi vào Nhật Ký Kiểm Toán Hệ Thống:
              </label>
              <TextArea
                rows={4}
                value={arbitrationRationale}
                onChange={(e) => setArbitrationRationale(e.target.value)}
                className="rounded-lg text-xs leading-relaxed"
              />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default DisputeResolutionTable;
