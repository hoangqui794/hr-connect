/**
 * @file AdminDisputesPage.tsx
 * @description Trung Tâm Xử Lý Tranh Chấp Hồ Sơ (Dispute Resolution Center)
 * Tích hợp DisputeResolutionTable với thiết kế đối đầu First-Submission Timestamp và ký số SHA-256.
 */
import React from 'react';
import { Card, Row, Col, Typography, Alert } from 'antd';
import { SafetyCertificateOutlined, CheckCircleOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import { DisputeResolutionTable } from './DisputeResolutionTable';

const { Title, Text } = Typography;

export const AdminDisputesPage: React.FC = () => {
  return (
    <div className="max-w-7xl mx-auto pt-8 pb-16 px-4 font-sans">
      {/* ─── Page Header ────────────────────────────────────────────── */}
      <div className="mb-6">
        <div className="flex items-center gap-2.5 mb-1.5">
          <SafetyCertificateOutlined className="text-2xl text-rose-700" />
          <Title level={2} style={{ margin: 0, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' }}>
            Trung Tâm Xử Lý Tranh Chấp Hồ Sơ
          </Title>
        </div>
        <Text className="text-slate-600 text-sm">
          Phân xử tranh chấp nộp trùng ứng viên giữa các CTV/Headhunter dựa trên bằng chứng bất biến First-Submission Timestamp và mã băm SHA-256.
        </Text>
      </div>

      {/* ─── Summary KPI Cards ──────────────────────────────────────── */}
      <Row gutter={[16, 16]} className="mb-6">
        <Col xs={24} sm={8}>
          <Card className="rounded-xl border border-slate-200/80 shadow-sm bg-white" bodyStyle={{ padding: '20px 24px' }}>
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
              Tranh chấp đang chờ xử lý
            </div>
            <div className="text-3xl font-extrabold text-rose-600 tabular-nums font-mono">
              2
            </div>
            <div className="text-xs text-rose-500 mt-1 flex items-center gap-1 font-medium">
              <ExclamationCircleOutlined /> Cần hoàn tất phán quyết
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={8}>
          <Card className="rounded-xl border border-slate-200/80 shadow-sm bg-white" bodyStyle={{ padding: '20px 24px' }}>
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
              Tranh chấp đã phán quyết xong
            </div>
            <div className="text-3xl font-extrabold text-emerald-600 tabular-nums font-mono">
              1
            </div>
            <div className="text-xs text-emerald-600 mt-1 flex items-center gap-1 font-medium">
              <CheckCircleOutlined /> Đã lưu vào Nhật ký kiểm toán
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={8}>
          <Card className="rounded-xl border border-slate-200/80 shadow-sm bg-white" bodyStyle={{ padding: '20px 24px' }}>
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
              Độ chính xác First-Timestamp
            </div>
            <div className="text-3xl font-extrabold text-sky-600 tabular-nums font-mono">
              100%
            </div>
            <div className="text-xs text-sky-600 mt-1 font-medium">
              Chữ ký băm SHA-256 bất biến
            </div>
          </Card>
        </Col>
      </Row>

      {/* ─── Main Dispute Table ─────────────────────────────────────── */}
      <DisputeResolutionTable />
    </div>
  );
};

export default AdminDisputesPage;
