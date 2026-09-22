/**
 * @file ClientWarrantyPage.tsx
 * @path src/pages/client/ClientWarrantyPage.tsx
 * @description Enterprise 60-Day Probation & Warranty Tracker for Client / Company (Role: CLIENT / COMPANY).
 * 
 * Spec A-04 Compliance (Mục 6 - Probation):
 * 1. Strictly displays HIRED & STARTED candidates under HEADHUNT_COD (Tuyển dụng trọn gói - Bảo hành 60 ngày).
 * 2. Antd Table Columns:
 *    - Ứng viên: Họ tên, Vị trí tuyển dụng, Ngày bắt đầu đi làm (Start Date).
 *    - Gói dịch vụ: Tag [Tuyển dụng trọn gói (COD) - Bảo hành 60 ngày].
 *    - Thời hạn bảo hành: Antd <Progress> countdown bar (ví dụ: "Đã thử việc 35/60 ngày").
 *    - Trạng thái thử việc: Tag [Đang thử việc] / [Đã đạt thử việc - PASS] / [Nghỉ việc sớm - FAIL].
 *    - Thao tác:
 *      * Nút [Xác nhận Đạt (PASS)]: Gọi clientService.confirmProbationResult(id, 'PASS').
 *      * Nút [Báo Nghỉ việc / Kích hoạt Bảo hành]: Gọi clientService.confirmProbationResult(id, 'FAIL', note).
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Table, Tag, Progress, Button, Card, Row, Col, Typography, Space,
  Avatar, Modal, Form, DatePicker, Select, Input, Alert, message, Popconfirm,
  Spin,
} from 'antd';
import {
  SafetyCertificateOutlined, CheckCircleOutlined, AlertOutlined,
  ClockCircleOutlined, ExclamationCircleOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { useAuthStore } from '@/stores/authStore';
import clientService from '@/services/clientService';
import type { ProbationWarrantyDTO, WarrantyStatus } from '@/types/client';

const { Title, Text } = Typography;
const { TextArea } = Input;

export const ClientWarrantyPage: React.FC = () => {
  const [records, setRecords] = useState<ProbationWarrantyDTO[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');

  // Modal State for Early Resignation & Replacement Trigger
  const [isFailModalOpen, setIsFailModalOpen] = useState<boolean>(false);
  const [selectedRecord, setSelectedRecord] = useState<ProbationWarrantyDTO | null>(null);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [failForm] = Form.useForm();

  const { user } = useAuthStore();
  const isDemoClient = user?.id === 'client-001' || user?.company?.includes('TechCorp');
  const companyId = isDemoClient ? 'client-001' : user?.id;

  // Load data from ClientService
  const loadWarrantyData = useCallback(async () => {
    try {
      setLoading(true);
      const data = await clientService.getWarrantyList(companyId);
      setRecords(data);
    } catch (error) {
      message.error('Không thể tải danh sách bảo hành thử việc');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    loadWarrantyData();
  }, [loadWarrantyData]);

  // Action: Confirm PASS
  const handleConfirmPass = async (recordId: string) => {
    try {
      setActionLoading(true);
      await clientService.confirmProbationResult(recordId, 'PASS');
      message.success('Đã xác nhận ứng viên VƯỢT QUA thử việc (PASS)! Chu kỳ bảo hành kết thúc thành công.');
      await loadWarrantyData();
    } catch (error) {
      message.error('Xử lý thất bại, vui lòng thử lại.');
    } finally {
      setActionLoading(false);
    }
  };

  // Open Fail / Warranty Trigger Modal
  const openFailModal = (record: ProbationWarrantyDTO) => {
    setSelectedRecord(record);
    failForm.setFieldsValue({
      candidateName: record.candidateName,
      jobTitle: record.jobTitle,
      resignationDate: dayjs(),
      reason: 'CANDIDATE_RESIGNED',
      notes: '',
    });
    setIsFailModalOpen(true);
  };

  // Submit Fail / Warranty Replacement
  const handleFailSubmit = async () => {
    try {
      const values = await failForm.validateFields();
      if (!selectedRecord) return;

      setActionLoading(true);
      const fullNote = `Nghỉ việc ngày: ${values.resignationDate.format('DD/MM/YYYY')}. Lý do: ${values.reason}. Ghi chú: ${values.notes || 'Không'}`;
      await clientService.confirmProbationResult(selectedRecord.id, 'FAIL', fullNote);

      message.warning(
        `Đã kích hoạt bảo hành tìm ứng viên thay thế miễn phí cho vị trí "${selectedRecord.jobTitle}". Yêu cầu đã chuyển đến Headhunter phụ trách!`
      );
      setIsFailModalOpen(false);
      await loadWarrantyData();
    } catch {
      // Form validation failure or error
    } finally {
      setActionLoading(false);
    }
  };

  // Filtered List
  const filteredRecords = useMemo(() => {
    if (filterStatus === 'ALL') return records;
    return records.filter((r) => r.status === filterStatus);
  }, [records, filterStatus]);

  // Status Tag Renderer
  const renderStatusTag = (status: WarrantyStatus) => {
    switch (status) {
      case 'IN_PROBATION':
        return (
          <Tag color="processing" icon={<ClockCircleOutlined />}>
            Đang thử việc
          </Tag>
        );
      case 'PASSED':
        return (
          <Tag color="success" icon={<CheckCircleOutlined />}>
            Đã đạt thử việc (PASS)
          </Tag>
        );
      case 'FAILED_WARRANTY_TRIGGERED':
        return (
          <Tag color="error" icon={<AlertOutlined />}>
            Nghỉ việc sớm (Kích hoạt BH)
          </Tag>
        );
    }
  };

  // Columns definition
  const columns: ColumnsType<ProbationWarrantyDTO> = [
    {
      title: 'Ứng viên & Vị trí tuyển dụng',
      key: 'candidate',
      minWidth: 260,
      render: (_: any, record: ProbationWarrantyDTO) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Avatar src={record.avatar} size={42} style={{ border: '2px solid #e2e8f0' }}>
            {record.candidateName.charAt(0)}
          </Avatar>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14, color: '#0f172a' }}>{record.candidateName}</div>
            <div style={{ fontSize: 12, color: '#2563eb', fontWeight: 500 }}>{record.jobTitle}</div>
            <div style={{ fontSize: 11, color: '#64748b' }}>
              Bắt đầu làm: <strong>{dayjs(record.startDate).format('DD/MM/YYYY')}</strong>
            </div>
          </div>
        </div>
      ),
    },
    {
      title: 'Gói dịch vụ',
      key: 'package',
      minWidth: 230,
      render: () => (
        <Tag color="purple" icon={<SafetyCertificateOutlined />} style={{ padding: '4px 8px', fontSize: 12 }}>
          Tuyển dụng trọn gói (COD) - Bảo hành 60 ngày
        </Tag>
      ),
    },
    {
      title: 'Thời hạn bảo hành (Đếm ngược 60 ngày)',
      key: 'progress',
      minWidth: 260,
      render: (_: any, record: ProbationWarrantyDTO) => {
        const percent = Math.min(100, Math.round((record.passedDays / record.probationDaysTotal) * 100));
        const isCompleted = record.status === 'PASSED';
        const isFailed = record.status === 'FAILED_WARRANTY_TRIGGERED';

        return (
          <div style={{ width: '100%', maxWidth: 240 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
              <span style={{ fontWeight: 600, color: isFailed ? '#dc2626' : isCompleted ? '#16a34a' : '#0284c7' }}>
                {isFailed
                  ? 'Đã dừng bảo hành'
                  : `Đã thử việc ${record.passedDays}/${record.probationDaysTotal} ngày`}
              </span>
              <span style={{ color: '#64748b', fontSize: 11 }}>Hạn: {dayjs(record.warrantyEndDate).format('DD/MM')}</span>
            </div>
            <Progress
              percent={percent}
              size="small"
              strokeColor={isFailed ? '#ef4444' : isCompleted ? '#16a34a' : '#2563eb'}
              status={isFailed ? 'exception' : isCompleted ? 'success' : 'active'}
              format={() => `${percent}%`}
            />
          </div>
        );
      },
    },
    {
      title: 'Trạng thái thử việc',
      dataIndex: 'status',
      key: 'status',
      minWidth: 190,
      render: (status: WarrantyStatus) => renderStatusTag(status),
    },
    {
      title: 'Thao tác',
      key: 'actions',
      minWidth: 250,
      render: (_: any, record: ProbationWarrantyDTO) => {
        if (record.status === 'PASSED') {
          return <Tag color="green">Đã hoàn tất bảo hành</Tag>;
        }
        if (record.status === 'FAILED_WARRANTY_TRIGGERED') {
          return <Tag color="red">Đang tìm nhân sự thay thế</Tag>;
        }

        return (
          <Space size={8}>
            <Popconfirm
              title="Xác nhận Đạt Thử việc (PASS)?"
              description={`Xác nhận ứng viên ${record.candidateName} hoàn tất thử việc và kết thúc chu kỳ bảo hành 60 ngày?`}
              onConfirm={() => handleConfirmPass(record.id)}
              okText="Xác nhận PASS"
              cancelText="Hủy"
            >
              <Button
                type="primary"
                size="small"
                loading={actionLoading}
                style={{ background: '#16a34a', borderColor: '#16a34a' }}
              >
                Xác nhận Đạt (PASS)
              </Button>
            </Popconfirm>

            <Button
              danger
              size="small"
              icon={<AlertOutlined />}
              onClick={() => openFailModal(record)}
            >
              Báo Nghỉ việc / Kích hoạt BH
            </Button>
          </Space>
        );
      },
    },
  ];

  return (
    <div style={{ maxWidth: 1240, margin: '0 auto' }}>
      {/* ─── PAGE HEADER ──────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 20 }}>
        <Title level={3} style={{ margin: 0, color: '#0f172a' }}>
          Theo dõi Bảo hành 60 ngày (Gói HEADHUNT_COD)
        </Title>
        <Text style={{ color: '#64748b' }}>
          Doanh nghiệp: <strong style={{ color: '#0f172a' }}>TechCorp Việt Nam</strong> • Giám sát ứng viên thử việc & cam kết bảo hành tìm nhân sự thay thế miễn phí
        </Text>
      </div>

      {/* ─── OVERVIEW METRICS ─────────────────────────────────────────────────── */}
      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col xs={24} sm={8}>
          <Card style={{ borderRadius: 8, border: '1px solid #e2e8f0' }}>
            <Text type="secondary" style={{ fontSize: 13 }}>Đang trong thời hạn bảo hành</Text>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#2563eb', marginTop: 4 }}>
              {records.filter((r) => r.status === 'IN_PROBATION').length} Ứng viên
            </div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
              Theo dõi sát sao tiến độ 60 ngày
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card style={{ borderRadius: 8, border: '1px solid #e2e8f0' }}>
            <Text type="secondary" style={{ fontSize: 13 }}>Đã thử việc thành công (PASS)</Text>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#16a34a', marginTop: 4 }}>
              {records.filter((r) => r.status === 'PASSED').length} Ứng viên
            </div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
              Ký HĐLĐ chính thức & hoàn tất hợp đồng
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card style={{ borderRadius: 8, border: '1px solid #e2e8f0' }}>
            <Text type="secondary" style={{ fontSize: 13 }}>Kích hoạt bảo hành thay thế</Text>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#dc2626', marginTop: 4 }}>
              {records.filter((r) => r.status === 'FAILED_WARRANTY_TRIGGERED').length} Hồ sơ
            </div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
              Headhunter tìm kiếm nhân sự thay thế miễn phí
            </div>
          </Card>
        </Col>
      </Row>

      {/* ─── POLICY NOTICE ────────────────────────────────────────────────────── */}
      <Alert
        message="Chính sách Bảo hành 60 ngày theo Đặc tả Mục 6 - Probation"
        description="Ứng viên tuyển qua gói Tuyển dụng trọn gói (COD) được bảo hành đổi người miễn phí 01 lần trong 60 ngày nếu ứng viên tự ý nghỉ việc hoặc không đáp ứng chuyên môn. Khi Doanh nghiệp bấm [Xác nhận Đạt], chu kỳ bảo hành chính thức hoàn thành."
        type="info"
        showIcon
        icon={<SafetyCertificateOutlined style={{ color: '#2563eb' }} />}
        style={{ marginBottom: 20, borderRadius: 8 }}
      />

      {/* ─── FILTER CONTROL ───────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
        <Select
          value={filterStatus}
          onChange={setFilterStatus}
          style={{ width: 240 }}
          options={[
            { value: 'ALL', label: 'Tất cả trạng thái' },
            { value: 'IN_PROBATION', label: 'Đang thử việc (Đếm ngược)' },
            { value: 'PASSED', label: 'Đã đạt thử việc (PASS)' },
            { value: 'FAILED_WARRANTY_TRIGGERED', label: 'Nghỉ việc sớm (Kích hoạt BH)' },
          ]}
        />
      </div>

      {/* ─── WARRANTY TABLE ───────────────────────────────────────────────────── */}
      <Card
        style={{ borderRadius: 8, border: '1px solid #e2e8f0' }}
        styles={{ body: { padding: 0 } }}
      >
        <Spin spinning={loading}>
          <Table<ProbationWarrantyDTO>
            columns={columns}
            dataSource={filteredRecords}
            rowKey="id"
            pagination={{ pageSize: 10, showTotal: (total) => `Tổng cộng ${total} nhân sự bảo hành` }}
            scroll={{ x: 1100 }}
            locale={{ emptyText: 'Chưa có dữ liệu ứng viên trúng tuyển gói COD.' }}
          />
        </Spin>
      </Card>

      {/* ─── MODAL: BÁO NGHỈ VIỆC / KÍCH HOẠT BẢO HÀNH ──────────────────────── */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#dc2626' }}>
            <ExclamationCircleOutlined />
            <span>Kích hoạt Yêu cầu Bảo hành Đổi người Miễn phí</span>
          </div>
        }
        open={isFailModalOpen}
        onCancel={() => setIsFailModalOpen(false)}
        onOk={handleFailSubmit}
        confirmLoading={actionLoading}
        okText="Kích hoạt Bảo hành ngay"
        okButtonProps={{ danger: true }}
        cancelText="Hủy"
        destroyOnClose
        width={560}
      >
        <div style={{ margin: '12px 0' }}>
          <Text type="secondary">
            Ghi nhận ứng viên nghỉ việc trong thời gian thử việc 60 ngày. Hệ thống sẽ lập tức gọi Service Layer gửi yêu cầu ưu tiên tới Internal HR / Affiliate phụ trách để kích hoạt điều khoản tìm nhân sự thay thế không tính thêm phí.
          </Text>
        </div>

        <Form form={failForm} layout="vertical">
          <Form.Item label="Ứng viên nghỉ việc" name="candidateName">
            <Input disabled />
          </Form.Item>

          <Form.Item label="Vị trí tuyển dụng" name="jobTitle">
            <Input disabled />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="Ngày nghỉ việc chính thức"
                name="resignationDate"
                rules={[{ required: true, message: 'Vui lòng chọn ngày nghỉ việc' }]}
              >
                <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="Lý do nghỉ việc"
                name="reason"
                rules={[{ required: true, message: 'Vui lòng chọn lý do' }]}
              >
                <Select
                  options={[
                    { value: 'CANDIDATE_RESIGNED', label: 'Ứng viên chủ động xin nghỉ' },
                    { value: 'NOT_QUALIFIED', label: 'Không đạt yêu cầu chuyên môn' },
                    { value: 'CULTURE_MISFIT', label: 'Không phù hợp văn hóa' },
                    { value: 'HEALTH_REASON', label: 'Lý do sức khỏe / cá nhân' },
                  ]}
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item label="Ghi chú chi tiết hoặc yêu cầu cho nhân sự thay thế" name="notes">
            <TextArea
              rows={3}
              placeholder="Mô tả cụ thể những điểm cần cải thiện hoặc lưu ý cho đợt sourcing ứng viên thay thế tiếp theo..."
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ClientWarrantyPage;
